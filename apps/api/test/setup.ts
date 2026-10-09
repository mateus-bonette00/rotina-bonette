import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });

const original = process.env.DATABASE_URL;
if (!original) {
  throw new Error("DATABASE_URL ausente. Copie .env.example para .env e suba o Postgres.");
}

const url = new URL(original);
url.pathname = "/rotina_bonette_test";
process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ??= "test-session-secret-32chars";

const adminUrl = new URL(original);
adminUrl.pathname = "/postgres";
const client = new pg.Client({ connectionString: adminUrl.toString() });
await client.connect();
const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = 'rotina_bonette_test'");
if (exists.rowCount === 0) {
  await client.query("CREATE DATABASE rotina_bonette_test");
}
await client.end();
