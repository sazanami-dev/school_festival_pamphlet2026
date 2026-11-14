import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { findCheckpointByToken } from "./checkpoint-token";
import { isWellFormedCode, normalizeCode } from "./code";
import { rallyConfig, type Checkpoint } from "./config";
import { requireSecret } from "./env";
import {
  addStamp,
  createParticipant,
  findParticipantById,
  findParticipantByRecoveryCode,
  getProgress,
  redeem,
  touchParticipant,
  type Participant,
  type RedeemResult,
} from "./participants";
import { getClientIp, isRateLimited, recordFailure } from "./rate-limit";
import { isRallyOpen } from "./schedule";
import { readParticipantCookie, setParticipantCookie, setRoleCookie, type PinRole } from "./session";
import { createSignedToken, verifySignedToken } from "./signed-token";

/**
 * スタンプラリーの処理の中身（設計書 7章）
 * Server Action と Route Handler の両方から呼ぶ。Action 側は入力を受け取ってこれを呼ぶだけにする
 */

/** 交換用QRの有効期限 */
const EXCHANGE_TOKEN_TTL_MS = 5 * 60 * 1000;

/* ---------- 参加者 ---------- */

/** Cookie の参加者。Cookie が無い・DBに無いIDなら null（未参加として扱う） */
export async function getCurrentParticipant(): Promise<Participant | null> {
  const id = await readParticipantCookie();
  return id ? findParticipantById(id) : null;
}

/** 参加する。このブラウザですでに参加していれば、新しいIDは作らずそれを使う */
export async function joinRally(): Promise<Participant> {
  const current = await getCurrentParticipant();
  if (current) return current;

  const participant = await createParticipant();
  await setParticipantCookie(participant.id);
  return participant;
}

export type RecoverResult =
  | { status: "ok"; participant: Participant }
  | { status: "invalid" }
  | { status: "rate_limited" };

/** 引き継ぎコードで参加者を探し、Cookie を付け直す（別のIDがあれば上書き） */
export async function recoverRally(input: string): Promise<RecoverResult> {
  const ip = await getClientIp();
  const key = `recover:${ip}`;
  if (isRateLimited(key)) return { status: "rate_limited" };

  const code = normalizeCode(input);
  const participant = isWellFormedCode(code) ? await findParticipantByRecoveryCode(code) : null;
  if (!participant) {
    recordFailure(key);
    console.info(`[rally] 引き継ぎコードの不一致 ip=${ip}`);
    return { status: "invalid" };
  }

  await setParticipantCookie(participant.id);
  await touchParticipant(participant.id);
  return { status: "ok", participant };
}

/* ---------- スタンプ ---------- */

export type CollectResult =
  | { status: "new" | "already"; checkpoint: Checkpoint }
  | { status: "invalid" }
  | { status: "closed" };

/** トークンのチェックポイントのスタンプを付ける。同じものを何度付けても1つにしかならない */
export async function collectStamp(participantId: string, token: string): Promise<CollectResult> {
  const checkpoint = findCheckpointByToken(token);
  if (!checkpoint) return { status: "invalid" };
  if (!isRallyOpen("stamp")) return { status: "closed" };

  const status = await addStamp(participantId, checkpoint.id);
  return { status, checkpoint };
}

/** スタンプを付けたあとに移る /stamp のURL（/stamp は got / already / error を見て結果を出す） */
export function collectResultUrl(result: CollectResult): string {
  if (result.status === "invalid" || result.status === "closed") return `/stamp?error=${result.status}`;
  const params = new URLSearchParams({ got: result.checkpoint.id });
  if (result.status === "already") params.set("already", "1");
  return `/stamp?${params.toString()}`;
}

/* ---------- 景品交換 ---------- */

export type IssueExchangeResult =
  | { status: "ok"; token: string; expiresAt: number }
  | { status: "closed" }
  | { status: "not_enough" }
  | { status: "redeemed" };

/** 交換用QRのトークンを発行する。時間内・必要数あり・未交換のときだけ */
export async function issueExchangeToken(participant: Participant): Promise<IssueExchangeResult> {
  const progress = await getProgress(participant.id);
  if (progress.redeemedAt) return { status: "redeemed" };
  if (progress.stampIds.length < rallyConfig.requiredStamps) return { status: "not_enough" };
  if (!isRallyOpen("exchange")) return { status: "closed" };

  const expiresAt = Date.now() + EXCHANGE_TOKEN_TTL_MS;
  return { status: "ok", token: createSignedToken("exchange", participant.id, expiresAt), expiresAt };
}

export type InspectExchangeResult =
  | { status: "ok"; participantId: string; stampCount: number; redeemedAt: Date | null }
  | { status: "invalid" }
  | { status: "expired" };

/** スタッフ画面で読んだ交換用QRの中身を確かめる（呼び出し側でスタッフか確認すること） */
export async function inspectExchangeToken(token: string): Promise<InspectExchangeResult> {
  const verified = verifySignedToken("exchange", token);
  if (verified.status !== "ok") return verified;

  const participant = await findParticipantById(verified.payload);
  if (!participant) return { status: "invalid" };

  const progress = await getProgress(participant.id);
  return {
    status: "ok",
    participantId: participant.id,
    stampCount: progress.stampIds.length,
    redeemedAt: progress.redeemedAt,
  };
}

/** 交換を確定する（呼び出し側でスタッフか確認すること） */
export async function confirmExchange(
  token: string,
): Promise<RedeemResult | { status: "invalid" } | { status: "expired" }> {
  const verified = verifySignedToken("exchange", token);
  if (verified.status !== "ok") return verified;

  const participant = await findParticipantById(verified.payload);
  if (!participant) return { status: "invalid" };
  return redeem(participant.id);
}

/* ---------- スタッフ・管理画面 ---------- */

export type PinLoginResult = { status: "ok" } | { status: "invalid" } | { status: "rate_limited" };

const ROLE_PINS = {
  staff: { secret: "STAFF_PIN", label: "スタッフ" },
  admin: { secret: "ADMIN_PIN", label: "管理画面" },
} as const satisfies Record<PinRole, unknown>;

/** PINを確かめ、正しければその画面用の Cookie を発行する */
async function pinLogin(role: PinRole, pin: string): Promise<PinLoginResult> {
  const ip = await getClientIp();
  const key = `${role}:${ip}`;
  if (isRateLimited(key)) return { status: "rate_limited" };

  // 長さの違う値も時間一定で比べられるよう、ハッシュにしてから比べる
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(pin.trim()), digest(requireSecret(ROLE_PINS[role].secret)))) {
    recordFailure(key);
    console.info(`[rally] ${ROLE_PINS[role].label}PINの不一致 ip=${ip}`);
    return { status: "invalid" };
  }

  await setRoleCookie(role);
  return { status: "ok" };
}

export async function staffLogin(pin: string): Promise<PinLoginResult> {
  return pinLogin("staff", pin);
}

export async function adminLogin(pin: string): Promise<PinLoginResult> {
  return pinLogin("admin", pin);
}
