// テーブル定義をここに追加し、npm run db:generate でマイグレーションを生成する
import { integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/* =========================================================
 * スタンプラリー（docs/stamp-rally-design.md 6章）
 * チェックポイントと景品は設定ファイル（src/data/checkpoints.json, rally.json）にあるので、
 * DB には「誰が何を取ったか」だけを置く。個人情報を含む列はない。
 * ======================================================= */

/** 参加者。id は Cookie（sr_pid）の値 */
export const participants = pgTable("participants", {
  id: uuid("id").primaryKey(),
  /** 引き継ぎコード（ハイフンなしの8文字） */
  recoveryCode: text("recovery_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** 最後に使った日時（集計用） */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 獲得スタンプ。主キーで同じスタンプの重複を防ぐ */
export const stamps = pgTable(
  "stamps",
  {
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    /** checkpoints.json の id */
    checkpointId: text("checkpoint_id").notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.participantId, table.checkpointId] })],
);

/** 景品交換。participant_id が主キーなので1人1回になる */
export const redemptions = pgTable("redemptions", {
  participantId: uuid("participant_id")
    .primaryKey()
    .references(() => participants.id, { onDelete: "cascade" }),
  /** 交換時点の獲得数（記録用） */
  stampCount: integer("stamp_count").notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
});
