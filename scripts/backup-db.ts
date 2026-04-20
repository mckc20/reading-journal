/**
 * Create a manual PostgreSQL backup for Supabase (schema + data).
 *
 * Usage:
 *   SUPABASE_DB_URL=postgresql://... npm run backup:db
 *   npm run backup:db -- postgresql://...
 *
 * Prerequisites:
 *   - SUPABASE_DB_URL in environment, or DB URL passed as first argument
 *   - pg_dump must be installed and available in PATH
 *
 * Output:
 *   backups/db/structure-YYYY-MM-DD-HH-MM.sql
 *   backups/db/data-YYYY-MM-DD-HH-MM.sql
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const connectionString = process.argv[2] ?? process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("Missing database URL.");
  console.error("Provide it as SUPABASE_DB_URL env var or pass it as the first argument.");
  console.error("Example: SUPABASE_DB_URL=postgresql://... npm run backup:db");
  process.exit(1);
}

const pgDumpVersion = spawnSync("pg_dump", ["--version"], { stdio: "pipe" });

if (pgDumpVersion.error || pgDumpVersion.status !== 0) {
  console.error("pg_dump is required but was not found. Install PostgreSQL client tools and ensure pg_dump is in PATH.");
  process.exit(1);
}

const now = new Date();

const pad = (value: number): string => String(value).padStart(2, "0");

const timestamp = [
  now.getFullYear(),
  pad(now.getMonth() + 1),
  pad(now.getDate()),
  pad(now.getHours()),
  pad(now.getMinutes()),
].join("-");

const outputDir = join(process.cwd(), "backups", "db");
mkdirSync(outputDir, { recursive: true });

const structureFile = join(outputDir, `structure-${timestamp}.sql`);
const dataFile = join(outputDir, `data-${timestamp}.sql`);

const runDump = (args: string[], outputFile: string): void => {
  const result = spawnSync("pg_dump", args, {
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
    },
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Failed to run pg_dump for ${outputFile}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`pg_dump exited with code ${result.status} while creating ${outputFile}`);
    process.exit(result.status ?? 1);
  }
};

runDump(["--schema-only", "--file", structureFile, connectionString], structureFile);
runDump(["--data-only", "--inserts", "--file", dataFile, connectionString], dataFile);

console.log("Database backup created successfully.");
console.log(`Structure: ${structureFile}`);
console.log(`Data: ${dataFile}`);
