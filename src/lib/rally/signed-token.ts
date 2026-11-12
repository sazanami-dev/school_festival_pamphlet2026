import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireSecret } from "./env";

/**
 * 有効期限つきの署名トークン（交換用QR・スタッフ Cookie で使う。設計書 5.4, 5.5）
 *
 * 形: <中身>.<期限(ミリ秒)>.<署名>
 * 署名は RALLY_SECRET の HMAC。用途（purpose）も署名に含め、別の用途のトークンを流用できないようにする
 */
type Purpose = "exchange" | "staff";

export type VerifyResult = { status: "ok"; payload: string } | { status: "expired" } | { status: "invalid" };

function sign(purpose: Purpose, body: string): string {
  return createHmac("sha256", requireSecret("RALLY_SECRET")).update(`${purpose}:${body}`).digest("base64url");
}

export function createSignedToken(purpose: Purpose, payload: string, expiresAt: number): string {
  const body = `${payload}.${expiresAt}`;
  return `${body}.${sign(purpose, body)}`;
}

export function verifySignedToken(purpose: Purpose, token: string, now: number = Date.now()): VerifyResult {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { status: "invalid" };

  const [payload, expiresText, signature] = parts;
  const expected = Buffer.from(sign(purpose, `${payload}.${expiresText}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { status: "invalid" };

  // 署名が正しいときだけ期限を見る（期限切れかどうかを、偽物のトークンに教えない）
  if (!(Number(expiresText) > now)) return { status: "expired" };
  return { status: "ok", payload };
}
