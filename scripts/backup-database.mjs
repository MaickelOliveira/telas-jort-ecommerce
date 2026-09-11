import { chmodSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

process.umask(0o077);
const databaseFile = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "telas-jort.sqlite");
const backupDirectory = process.env.BACKUP_PATH || path.join(path.dirname(databaseFile), "backups");
const retention = Math.max(1, Math.min(90, Number(process.env.BACKUP_RETENTION || 14)));
mkdirSync(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(backupDirectory, `telas-jort-${stamp}.sqlite`);
const escapedDestination = destination.replaceAll("'", "''");
const db = new DatabaseSync(databaseFile);
db.exec("PRAGMA wal_checkpoint(PASSIVE)");
db.exec(`VACUUM INTO '${escapedDestination}'`);
db.close();
chmodSync(destination, 0o600);

const backups = readdirSync(backupDirectory)
  .filter((name) => /^telas-jort-.*\.sqlite$/.test(name))
  .map((name) => ({ name, modified: statSync(path.join(backupDirectory, name)).mtimeMs }))
  .sort((a, b) => b.modified - a.modified);
for (const old of backups.slice(retention)) unlinkSync(path.join(backupDirectory, old.name));
console.log(destination);
