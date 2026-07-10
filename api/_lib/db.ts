import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Create a Neon project, run db/schema.sql against it, " +
      "and put the connection string in your .env file (see .env.example).",
  );
}

// Neon's HTTP driver — one query per call, no persistent pool to manage,
// which is what makes it safe to reuse across serverless invocations.
export const sql = neon(databaseUrl);
