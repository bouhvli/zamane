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
//
// One request per query also means physical distance to the database shows up
// in every single one of them. This project's Neon instance is in
// eu-central-1, and Vercel functions default to iad1 — a transatlantic hop
// each way, paid at least twice in series by every endpoint here (the session
// lookup, then the data it guards). `regions: ["fra1"]` in vercel.json puts
// the functions in the same city as the database; keep the two in step if
// either ever moves.
export const sql = neon(databaseUrl);
