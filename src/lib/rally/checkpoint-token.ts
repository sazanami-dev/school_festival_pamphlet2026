import "server-only";
import { timingSafeEqual } from "node:crypto";
import { computeCheckpointToken } from "./checkpoint-token-core";
import { isWellFormedCode, normalizeCode } from "./code";
import { checkpoints, type Checkpoint } from "./config";
import { requireSecret } from "./env";

/**
 * QRのURL・手入力のトークンからチェックポイントを探す（設計書 5.3）
 * 全チェックポイントのトークンを計算して比べる（数十件なので一瞬）。見つからなければ null
 */
export function findCheckpointByToken(input: string): Checkpoint | null {
  const token = normalizeCode(input);
  if (!isWellFormedCode(token)) return null;

  const secret = requireSecret("CHECKPOINT_SECRET");
  const given = Buffer.from(token);
  return (
    checkpoints.find((cp) => timingSafeEqual(given, Buffer.from(computeCheckpointToken(secret, cp.id)))) ?? null
  );
}
