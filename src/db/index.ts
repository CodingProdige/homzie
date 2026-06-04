import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

type PostgresClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as typeof globalThis & {
  homziePostgresClient?: PostgresClient;
};

const client =
  globalForDb.homziePostgresClient ??
  postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.homziePostgresClient = client;
}

export const db = drizzle(client, { schema });
export { client as sql };
