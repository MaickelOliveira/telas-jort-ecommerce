import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";

// Dados apenas. A estrutura versionada deve ser aplicada separadamente.
const tables = ["customer_accounts", "orders", "order_items", "visitor_sessions", "analytics_events", "webhook_events", "audit_logs", "product_configs", "store_settings", "integration_configs", "coupons", "refund_requests", "fiscal_documents"];
const [mode, file] = process.argv.slice(2);
if (!["export", "restore", "verify"].includes(mode) || !file) {
  throw new Error("Uso: node scripts/transfer-postgres.mjs export|restore|verify arquivo.json");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function digest(rows) {
  return createHash("sha256").update(rows.map((row) => JSON.stringify(canonical(row))).sort().join("\n")).digest("hex");
}
function readBackup() {
  const backup = JSON.parse(readFileSync(file, "utf8"));
  if (backup.format !== "telas-jort-postgres-v1") throw new Error("Formato de backup inválido.");
  for (const table of tables) {
    const data = backup.tables[table];
    if (!data || !Array.isArray(data.rows) || data.count !== data.rows.length || data.sha256 !== digest(data.rows)) throw new Error(`Backup inválido: ${table}.`);
  }
  return backup;
}
const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
  max: 1, connect_timeout: 15, idle_timeout: 5, prepare: false,
  transform: { undefined: null },
});
try {
  await sql`set timezone = 'UTC'`;
  if (mode === "export") {
    const backup = { format: "telas-jort-postgres-v1", createdAt: new Date().toISOString(), tables: {} };
    await sql.begin("isolation level repeatable read read only", async (tx) => {
      for (const table of tables) {
        const rows = await tx`select * from ${tx(table)}`;
        const columns = await tx`select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = ${table} order by ordinal_position`;
        backup.tables[table] = { columns, count: rows.length, sha256: digest(rows), rows };
      }
    });
    writeFileSync(file, JSON.stringify(backup), { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ status: "exported", counts: Object.fromEntries(tables.map((table) => [table, backup.tables[table].count])) }));
  } else {
    const backup = readBackup();
    await sql.begin(mode === "verify" ? "isolation level repeatable read read only" : "", async (tx) => {
      if (mode === "restore") {
        for (const table of tables) {
          const [row] = await tx`select count(*)::int as count from ${tx(table)}`;
          if (row.count !== 0) throw new Error(`Destino não está vazio: ${table}. Nenhum dado foi alterado.`);
        }
        for (const table of tables) {
          const { rows, columns } = backup.tables[table];
          const jsonColumns = new Set(columns.filter((column) => ["json", "jsonb"].includes(column.data_type)).map((column) => column.column_name));
          for (let offset = 0; offset < rows.length; offset += 100) {
            const batch = rows.slice(offset, offset + 100).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, jsonColumns.has(key) && value !== null ? tx.json(value) : value])));
            await tx`insert into ${tx(table)} ${tx(batch, ...columns.map((column) => column.column_name))}`;
          }
        }
      }
      for (const table of tables) {
        const rows = await tx`select * from ${tx(table)}`;
        if (rows.length !== backup.tables[table].count || digest(rows) !== backup.tables[table].sha256) throw new Error(`Dados divergentes: ${table}.`);
      }
    });
    console.log(JSON.stringify({ status: mode === "restore" ? "restored_and_verified" : "verified", tables: tables.length }));
  }
} finally {
  await sql.end({ timeout: 5 });
}
