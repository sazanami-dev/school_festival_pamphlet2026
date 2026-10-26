import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(postgres(url, { max: 10 }), { schema });
}

// 開発時のHMRで接続が増え続けないよう globalThis に保持する
const globalForDb = globalThis as unknown as { db?: Db };

/** ビルド時に接続しないよう、初回アクセス時に生成する */
export function getDb(): Db {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}
