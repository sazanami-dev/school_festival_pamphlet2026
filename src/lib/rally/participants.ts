import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { participants, redemptions, stamps } from "@/db/schema";
import { bytesToCode } from "./code";
import { checkpoints, rallyConfig } from "./config";

/**
 * スタンプラリーのDB操作（Data Access Layer）
 * Cookie や受付時間は見ない。呼び出し側（service.ts）で確認してから呼ぶ
 */

export type Participant = { id: string; recoveryCode: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 設定ファイルに今あるチェックポイントだけを数える（消したものの記録はDBに残る） */
const checkpointIds = checkpoints.map((cp) => cp.id);

export async function createParticipant(): Promise<Participant> {
  // 引き継ぎコードが既存のものと重なったら作り直す（約 8.5×10¹¹ 通りなので、まず起きない）
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await getDb()
      .insert(participants)
      .values({ id: randomUUID(), recoveryCode: bytesToCode(randomBytes(16)) })
      .onConflictDoNothing({ target: participants.recoveryCode })
      .returning({ id: participants.id, recoveryCode: participants.recoveryCode });
    if (row) return row;
  }
  throw new Error("引き継ぎコードを発行できませんでした");
}

/** Cookie の中身は書き換えられるので、UUID の形でなければDBに問い合わせずに null を返す */
export async function findParticipantById(id: string): Promise<Participant | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const [row] = await getDb()
    .select({ id: participants.id, recoveryCode: participants.recoveryCode })
    .from(participants)
    .where(eq(participants.id, id));
  return row ?? null;
}

/** code は normalizeCode 済みのもの */
export async function findParticipantByRecoveryCode(code: string): Promise<Participant | null> {
  const [row] = await getDb()
    .select({ id: participants.id, recoveryCode: participants.recoveryCode })
    .from(participants)
    .where(eq(participants.recoveryCode, code));
  return row ?? null;
}

export async function touchParticipant(id: string): Promise<void> {
  await getDb().update(participants).set({ lastSeenAt: new Date() }).where(eq(participants.id, id));
}

/** スタンプを保存する。すでにあれば何もしない */
export async function addStamp(participantId: string, checkpointId: string): Promise<"new" | "already"> {
  const inserted = await getDb()
    .insert(stamps)
    .values({ participantId, checkpointId })
    .onConflictDoNothing()
    .returning({ checkpointId: stamps.checkpointId });
  await touchParticipant(participantId);
  return inserted.length > 0 ? "new" : "already";
}

export type ParticipantProgress = {
  /** 獲得済みのチェックポイントID（設定ファイルにあるものだけ） */
  stampIds: string[];
  /** 交換日時。未交換なら null */
  redeemedAt: Date | null;
};

export async function getProgress(participantId: string): Promise<ParticipantProgress> {
  const db = getDb();
  const [stampRows, [redemption]] = await Promise.all([
    checkpointIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ checkpointId: stamps.checkpointId })
          .from(stamps)
          .where(and(eq(stamps.participantId, participantId), inArray(stamps.checkpointId, checkpointIds))),
    db
      .select({ redeemedAt: redemptions.redeemedAt })
      .from(redemptions)
      .where(eq(redemptions.participantId, participantId)),
  ]);
  return {
    stampIds: stampRows.map((row) => row.checkpointId),
    redeemedAt: redemption?.redeemedAt ?? null,
  };
}

export type RedeemResult =
  | { status: "ok"; redeemedAt: Date; stampCount: number }
  | { status: "already"; redeemedAt: Date }
  | { status: "not_enough"; stampCount: number };

/** 景品交換を記録する。条件をDBの値で確かめ直し、2回目は "already" になる */
export async function redeem(participantId: string): Promise<RedeemResult> {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ redeemedAt: redemptions.redeemedAt })
      .from(redemptions)
      .where(eq(redemptions.participantId, participantId));
    if (existing) return { status: "already", redeemedAt: existing.redeemedAt };

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(stamps)
      .where(and(eq(stamps.participantId, participantId), inArray(stamps.checkpointId, checkpointIds)));
    if (count < rallyConfig.requiredStamps) return { status: "not_enough", stampCount: count };

    // 同時に2台で確定されても、主キーで1件にしかならない
    const [row] = await tx
      .insert(redemptions)
      .values({ participantId, stampCount: count })
      .onConflictDoNothing()
      .returning({ redeemedAt: redemptions.redeemedAt });
    if (!row) {
      const [other] = await tx
        .select({ redeemedAt: redemptions.redeemedAt })
        .from(redemptions)
        .where(eq(redemptions.participantId, participantId));
      return { status: "already", redeemedAt: other.redeemedAt };
    }
    return { status: "ok", redeemedAt: row.redeemedAt, stampCount: count };
  });
}
