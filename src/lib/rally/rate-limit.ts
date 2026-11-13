import "server-only";
import { headers } from "next/headers";

/**
 * 総当たり対策の回数制限（設計書 5.2）。同じIPから10分に20回まで失敗できる
 * アプリは1台構成なのでメモリ上で数える（再起動で消えてよい）
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 20;

type Entry = { failures: number; resetAt: number };

// 開発時のHMRで消えないよう globalThis に保持する
const globalForRateLimit = globalThis as unknown as { rallyRateLimit?: Map<string, Entry> };
const entries = (globalForRateLimit.rallyRateLimit ??= new Map());

function getEntry(key: string, now: number): Entry | undefined {
  const entry = entries.get(key);
  if (entry && entry.resetAt <= now) {
    entries.delete(key);
    return undefined;
  }
  return entry;
}

export function isRateLimited(key: string): boolean {
  return (getEntry(key, Date.now())?.failures ?? 0) >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = getEntry(key, now);
  if (entry) {
    entry.failures++;
  } else {
    entries.set(key, { failures: 1, resetAt: now + WINDOW_MS });
  }

  // 期限切れのものが溜まり続けないよう、ときどき掃除する
  if (entries.size > 10_000) {
    for (const [k, e] of entries) if (e.resetAt <= now) entries.delete(k);
  }
}

/**
 * 接続元のIP。本番はHTTPSを終端するプロキシの後ろなので X-Forwarded-For から取る。
 * 左側は利用者が自由に書けるため、自分たちのプロキシが追記した一番右の値を使う（プロキシが1段の前提）
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last) return last;
  }
  return headerList.get("x-real-ip")?.trim() || "unknown";
}
