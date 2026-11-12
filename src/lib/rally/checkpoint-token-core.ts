/**
 * チェックポイントのトークンの計算（設計書 5.3）
 *
 * token = HMAC-SHA256(CHECKPOINT_SECRET, チェックポイントID) を8文字のコードにしたもの。
 * サーバー（checkpoint-token.ts）と掲示物スクリプトの両方から使うので、
 * Node から直接読み込めるよう相対パス・拡張子つきで import する。
 */
import { createHmac } from "node:crypto";
import { bytesToCode } from "./code.ts";

export function computeCheckpointToken(secret: string, checkpointId: string): string {
  return bytesToCode(createHmac("sha256", secret).update(checkpointId).digest());
}
