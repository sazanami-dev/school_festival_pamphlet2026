import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";

// コンテナのヘルスチェック用（DBまで疎通できるかを確認する）
export async function GET() {
  await connection();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_unreachable" }, { status: 503 });
  }
}
