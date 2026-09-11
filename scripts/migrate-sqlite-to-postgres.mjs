import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString || connectionString.includes("COLE_AQUI")) {
  throw new Error("DATABASE_URL do Supabase não foi configurada.");
}

const legacyFile = process.env.LEGACY_DATABASE_PATH
  || process.env.DATABASE_PATH
  || path.join(process.cwd(), "data", "telas-jort.sqlite");
const markerFile = `${legacyFile}.migrated-to-postgres`;

if (existsSync(legacyFile) && !existsSync(markerFile)) {
  const source = new DatabaseSync(legacyFile, { readOnly: true });
  const target = postgres(connectionString, {
    ssl: "require",
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
    prepare: false,
  });

  const tables = [
    "customer_accounts",
    "orders",
    "order_items",
    "visitor_sessions",
    "analytics_events",
    "webhook_events",
    "audit_logs",
    "product_configs",
    "store_settings",
    "integration_configs",
    "coupons",
    "refund_requests",
    "fiscal_documents",
  ];

  const booleanColumns = {
    integration_configs: new Set(["enabled"]),
    coupons: new Set(["active"]),
  };
  const jsonColumns = new Set(["measurement_json", "metadata_json", "config_json", "public_config_json"]);

  try {
    await target`select 1 from public.customer_accounts limit 1`;
    await target.begin(async (tx) => {
      for (const table of tables) {
        const exists = source.prepare("select 1 from sqlite_master where type = 'table' and name = ?").get(table);
        if (!exists) continue;
        const sourceColumns = source.prepare(`pragma table_info(${table})`).all().map((column) => String(column.name));
        const targetColumns = await tx`
          select column_name from information_schema.columns where table_schema = 'public' and table_name = ${table}`;
        const allowed = new Set(targetColumns.map((column) => column.column_name));
        const columns = sourceColumns.filter((column) => allowed.has(column));
        if (!columns.length) continue;
        const sourceRows = source.prepare(`select * from ${table}`).all()
          .filter((sourceRow) => table !== "integration_configs" || sourceRow.provider !== "supabase");
        const rows = sourceRows.map((sourceRow) => {
          const row = {};
          for (const column of columns) {
            let value = sourceRow[column];
            if (booleanColumns[table]?.has(column)) value = Boolean(value);
            if (jsonColumns.has(column) && typeof value === "string" && value) {
              try { value = JSON.parse(value); } catch { value = {}; }
            }
            row[column] = value;
          }
          return row;
        });
        if (!rows.length) continue;
        await tx`insert into ${tx(table)} ${tx(rows, ...columns)} on conflict do nothing`;
        console.log(`[database] ${rows.length} registro(s) de ${table} verificados para migração.`);
      }
    });
    writeFileSync(markerFile, `${new Date().toISOString()}\n`, { mode: 0o600 });
    console.log("[database] Migração do SQLite para o Supabase concluída.");
  } finally {
    source.close();
    await target.end({ timeout: 5 });
  }
}
