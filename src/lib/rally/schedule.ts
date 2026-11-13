import "server-only";

/**
 * 受付時間（設計書 5.6）。開催日の RALLY_OPEN〜RALLY_CLOSE（日本時間）だけ受け付ける
 *
 * - RALLY_DATES      開催日（カンマ区切り、例: 2026-11-21,2026-11-22）。"*" なら毎日（準備・テスト用）
 *                    未設定のとき、開発中は毎日・本番は受け付けない
 * - RALLY_OPEN       開始時刻（既定 10:00）
 * - RALLY_CLOSE      スタンプ取得の締め切り（既定 16:00。この時刻ちょうどからは受け付けない）
 * - RALLY_EXCHANGE_CLOSE  景品交換の締め切り（既定は RALLY_CLOSE と同じ）
 */

export type RallyWindow = "stamp" | "exchange";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "10:00" → 600（0時からの分）。形が違えば null */
function parseTime(value: string | undefined): number | null {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getHours() {
  const openText = process.env.RALLY_OPEN || "10:00";
  const closeText = process.env.RALLY_CLOSE || "16:00";
  const exchangeCloseText = process.env.RALLY_EXCHANGE_CLOSE || closeText;
  return {
    openText,
    closeText,
    exchangeCloseText,
    open: parseTime(openText) ?? 10 * 60,
    close: parseTime(closeText) ?? 16 * 60,
    exchangeClose: parseTime(exchangeCloseText) ?? parseTime(closeText) ?? 16 * 60,
  };
}

/** 画面に出す受付時間。例: "10:00〜16:00" */
export function formatRallyHours(window: RallyWindow = "stamp"): string {
  const hours = getHours();
  return `${hours.openText}〜${window === "exchange" ? hours.exchangeCloseText : hours.closeText}`;
}

export function isRallyOpen(window: RallyWindow, now: Date = new Date()): boolean {
  // サーバーの時計はUTCのことが多いので、9時間ずらしてから UTC の値として読む
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const date = jst.toISOString().slice(0, 10);
  const minutes = jst.getUTCHours() * 60 + jst.getUTCMinutes();

  const dates = (process.env.RALLY_DATES ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const isFestivalDay =
    dates.length === 0 ? process.env.NODE_ENV !== "production" : dates.includes("*") || dates.includes(date);
  if (!isFestivalDay) return false;

  const hours = getHours();
  const close = window === "exchange" ? hours.exchangeClose : hours.close;
  return hours.open <= minutes && minutes < close;
}
