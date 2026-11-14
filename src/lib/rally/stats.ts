import "server-only";
import { and, eq, inArray, sql, type SQLWrapper } from "drizzle-orm";
import { getDb } from "@/db";
import { participants, redemptions, stamps } from "@/db/schema";
import { checkpoints, rallyConfig, type Checkpoint } from "./config";

/**
 * 管理画面（/console）に出す集計（設計書 9.4）
 * 数だけを返し、個々の参加者のIDや引き継ぎコードは返さない。呼び出し側で管理者か確認すること
 *
 * 日付を渡すと、その日（日本時間）に起きたことだけを数える。前の日に参加した人がその日に取ったスタンプも含む
 */

export type RallyStats = {
  /** 参加者数（「参加する」を押した人）。日付指定のときは、その日に参加した人 */
  participants: number;
  /** スタンプを1個以上取った人。日付指定のときは、その日に取った人 */
  activeParticipants: number;
  /** 景品交換に必要な数を集めた人。日付指定のときは、その日に必要数に届いた人 */
  completed: number;
  /** 景品を交換した人 */
  redeemed: number;
  totalStamps: number;
  /** チェックポイントごとの獲得数（checkpoints.json の順） */
  byCheckpoint: { checkpoint: Checkpoint; count: number }[];
  /**
   * 獲得数ごとの人数。添字が獲得数（0〜チェックポイント数）
   * 日付指定のときは、その日に取った数で数える（0個の人数は出せないので 0 のまま）
   */
  distribution: number[];
  /** 日別（日本時間）。何もなかった日は含まない。日付指定をしても全部の日を返す */
  byDay: RallyDayStats[];
};

export type RallyDayStats = { date: string; participants: number; stamps: number; redemptions: number };

/** "2026-11-21" の形で、実在する日付か */
export function isDateText(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** 設定ファイルに今あるチェックポイントだけを数える（participants.ts と同じ） */
const checkpointIds = checkpoints.map((cp) => cp.id);

const countAll = sql<number>`count(*)::int`;

/** 日本時間の日付（"2026-11-21"）。DBのタイムゾーン設定によらないよう、ここで指定する */
function jstDate(column: SQLWrapper) {
  return sql<string>`to_char(${column} at time zone 'Asia/Tokyo', 'YYYY-MM-DD')`;
}

/** date は isDateText で確かめたもの。省くと全期間 */
export async function getRallyStats(date?: string): Promise<RallyStats> {
  const db = getDb();
  const currentStamps = inArray(stamps.checkpointId, checkpointIds);
  /** 集計の対象にするスタンプ（日付指定があればその日のものだけ） */
  const targetStamps = date ? and(currentStamps, eq(jstDate(stamps.acquiredAt), date)) : currentStamps;

  /** 参加者1人あたりの獲得数（1個も取っていない人は含まれない） */
  const perParticipant = db
    .select({ stampCount: countAll.as("stamp_count") })
    .from(stamps)
    .where(targetStamps)
    .groupBy(stamps.participantId)
    .as("per_participant");

  /** 各スタンプが、その人の何個目か。必要数ちょうどの番号のスタンプが「達成した瞬間」になる */
  const numberedStamps = db
    .select({
      acquiredAt: stamps.acquiredAt,
      nth: sql<number>`row_number() over (partition by ${stamps.participantId} order by ${stamps.acquiredAt})`.as("nth"),
    })
    .from(stamps)
    .where(currentStamps)
    .as("numbered_stamps");
  const reachedRequired = eq(numberedStamps.nth, rallyConfig.requiredStamps);

  const participantDay = jstDate(participants.createdAt);
  const stampDay = jstDate(stamps.acquiredAt);
  const redemptionDay = jstDate(redemptions.redeemedAt);

  const [checkpointRows, distributionRows, [completedRow], participantDays, stampDays, redemptionDays] = await Promise.all([
    db
      .select({ checkpointId: stamps.checkpointId, count: countAll })
      .from(stamps)
      .where(targetStamps)
      .groupBy(stamps.checkpointId),
    db
      .select({ stampCount: perParticipant.stampCount, people: countAll })
      .from(perParticipant)
      .groupBy(perParticipant.stampCount),
    db
      .select({ count: countAll })
      .from(numberedStamps)
      .where(date ? and(reachedRequired, eq(jstDate(numberedStamps.acquiredAt), date)) : reachedRequired),
    db.select({ date: participantDay, count: countAll }).from(participants).groupBy(participantDay),
    db.select({ date: stampDay, count: countAll }).from(stamps).where(currentStamps).groupBy(stampDay),
    db.select({ date: redemptionDay, count: countAll }).from(redemptions).groupBy(redemptionDay),
  ]);

  const sum = (rows: { count: number }[]) => rows.reduce((total, row) => total + row.count, 0);

  const countByCheckpoint = new Map(checkpointRows.map((row) => [row.checkpointId, row.count]));

  const distribution: number[] = Array(checkpoints.length + 1).fill(0);
  for (const row of distributionRows) distribution[row.stampCount] = row.people;
  const activeParticipants = distributionRows.reduce((total, row) => total + row.people, 0);

  const days = new Map<string, RallyStats["byDay"][number]>();
  const dayOf = (date: string) => {
    let day = days.get(date);
    if (!day) days.set(date, (day = { date, participants: 0, stamps: 0, redemptions: 0 }));
    return day;
  };
  for (const row of participantDays) dayOf(row.date).participants = row.count;
  for (const row of stampDays) dayOf(row.date).stamps = row.count;
  for (const row of redemptionDays) dayOf(row.date).redemptions = row.count;

  const selectedDay = date ? days.get(date) : undefined;
  const participantCount = date ? (selectedDay?.participants ?? 0) : sum(participantDays);
  if (!date) distribution[0] = participantCount - activeParticipants;

  return {
    participants: participantCount,
    activeParticipants,
    completed: completedRow.count,
    redeemed: date ? (selectedDay?.redemptions ?? 0) : sum(redemptionDays),
    totalStamps: sum(checkpointRows),
    byCheckpoint: checkpoints.map((checkpoint) => ({ checkpoint, count: countByCheckpoint.get(checkpoint.id) ?? 0 })),
    distribution,
    byDay: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
