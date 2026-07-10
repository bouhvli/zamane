// One-off: applies db/schema.sql against DATABASE_URL. Not part of the
// app runtime — run manually after provisioning a fresh Neon database.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8");

const client = new Client(process.env.DATABASE_URL);
await client.connect();
try {
  await client.query(sql);
  console.log("Schema applied successfully.");
} finally {
  await client.end();
}
