import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

process.umask(0o077);
const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "telas-jort.sqlite");
mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, public_number TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
    payment_status TEXT NOT NULL, fulfillment_status TEXT NOT NULL,
    subtotal_cents INTEGER NOT NULL, shipping_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL,
    customer_encrypted TEXT NOT NULL, shipping_service TEXT NOT NULL, shipping_quote_id TEXT,
    payment_provider_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL, quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL, subtotal_cents INTEGER NOT NULL, weight_kg REAL NOT NULL,
    measurement_json TEXT
  );
  CREATE TABLE IF NOT EXISTS visitor_sessions (
    visitor_id TEXT PRIMARY KEY, ip_hash TEXT NOT NULL, path TEXT NOT NULL, device TEXT NOT NULL,
    first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_idx ON visitor_sessions(last_seen_at);
  CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, event TEXT NOT NULL, path TEXT NOT NULL,
    metadata_json TEXT, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON analytics_events(created_at);
  CREATE TABLE IF NOT EXISTS webhook_events (
    provider TEXT NOT NULL, provider_event_id TEXT NOT NULL, status TEXT NOT NULL,
    received_at TEXT NOT NULL, processed_at TEXT, PRIMARY KEY(provider, provider_event_id)
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT,
    metadata_json TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS product_configs (
    product_id TEXT PRIMARY KEY, config_json TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS store_settings (
    id TEXT PRIMARY KEY, config_json TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS integration_configs (
    provider TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0,
    environment TEXT NOT NULL DEFAULT 'sandbox', public_config_json TEXT NOT NULL DEFAULT '{}',
    secret_config_encrypted TEXT, last_test_status TEXT, last_test_message TEXT,
    last_tested_at TEXT, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
  );
`);
db.close();
console.log(`Banco inicializado em ${file}`);
