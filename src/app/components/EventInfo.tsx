"use client";

/**
 * リアルタイム開催イベント表示(ホーム上部)
 *
 * ■ デザイン(variant)
 *   "app"       = 案D シンプル(マップ・出展一覧と同じ見た目。2行ほどの高さでマップを狭めない)
 *   "led"       = 案A 電光掲示板(ダーク)
 *   "pop"       = 案B ポスター
 *   "timetable" = 案C 時刻表(ミニマル)
 *
 * ■ 表示位置(position)
 *   "top"    = ホーム上部(通常の流れ)
 *   "sticky" = スクロールしても上に固定
 *   "bottom" = 画面の下に固定
 *
 * ■ 切り替え方
 *   1) 画面右下の「表示設定」ボタンから切り替え(選んだ内容はその端末に保存)
 *      開発中(npm run dev)だけ表示します。本番では出ません(SHOW_SWITCHER)
 *   2) 下の「★ 設定」の定数を書き換える(初期値)
 *   3) 開発中(npm run dev)だけ URL でも指定できます
 *      ?variant=led&position=bottom&debugNow=12:50
 *      debugNow=HH:MM は、その時刻から進む仮想時計です
 *
 * ■ 仕様
 *   - 開始15分前〜終了までのイベントを表示(静的JSON + 端末の現在時刻のみで判定)
 *   - 30秒ごと + スリープ復帰(visibilitychange)で現在時刻を更新
 *   - ハイドレーションエラー防止のため、マウント後にだけ描画(初回はスケルトン)
 *   - スマホ基準。md(768px〜)でカード幅固定 + 左右の矢印、2xl(1536px〜)で拡大(TV向け)
 *   - 軽量化: 表示が変わる「分」が変わったときだけ再描画 / 画面が隠れている間は更新を止める /
 *     スマホではスクロール監視をしない / フォントは使うときだけ読み込む
 *
 * ■ 必要な shadcn/ui: button, skeleton
 *   npx shadcn@latest add button skeleton
 *
 * ■ フォント(next/font/google)
 *   案A: DotGothic16 / 案B: Dela Gothic One / 案C: Space Grotesk
 *   このファイル内で読み込みます。初回はネットに繋がっている必要があります
 *   (繋がらない場合は代替フォントで表示されます)。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Dela_Gothic_One,
  DotGothic16,
  Space_Grotesk,
} from "next/font/google";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// TODO: event.json の実際の場所に合わせてパスを直してください
import eventData from "@/data/event.json";

/* -------------------------------------------------------------------------- */
/* ★ 設定(ここを書き換える)                                                  */
/* -------------------------------------------------------------------------- */

type Variant = "app" | "led" | "pop" | "timetable";
type Position = "top" | "sticky" | "bottom";

/** デザインの初期値: "app" = 案D / "led" = 案A / "pop" = 案B / "timetable" = 案C */
const DEFAULT_VARIANT: Variant = "app";
/** 表示位置の初期値: "top" / "sticky" / "bottom" */
const DEFAULT_POSITION: Position = "top";
/** position="sticky" のとき、上に固定ヘッダーがあればその高さ(px)。なければ 0 */
const STICKY_TOP_PX = 0;
/**
 * 画面右下の「表示設定」ボタンを出すか(デザイン・位置を選べる)
 * 見比べるための開発用。本番(npm run build / start)では出さず、来場者には初期値のデザインを表示する
 */
const SHOW_SWITCHER = process.env.NODE_ENV === "development";

/* -------------------------------------------------------------------------- */
/* フォント                                                                    */
/* -------------------------------------------------------------------------- */

const ledFont = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false, // 日本語は必要な分だけ遅延読み込み
});

const popFont = Dela_Gothic_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const numFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  preload: false, // 案C を選んだときだけ読み込む
});

/* -------------------------------------------------------------------------- */
/* 型・定数                                                                    */
/* -------------------------------------------------------------------------- */

type EventItem = {
  id: string;
  eventName: string;
  genre: string[];
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  floor: string;
  location: string;
  description: string;
};

type EventStatus = "soon" | "live";

type ActiveEvent = EventItem & {
  status: EventStatus;
  startMin: number;
  endMin: number;
  /** soon: 開始までの残り分 / live: 終了までの残り分 */
  minutesLeft: number;
  /** live のときの進行度 0〜1 */
  progress: number;
};

type Prefs = { variant: Variant; position: Position };

type EventInfoProps = {
  /** 省略時は event.json を使用 */
  events?: EventItem[];
  /** 「タイムテーブルをすべて見る」カードの遷移先 */
  timetableHref?: string;
  /** 省略時は DEFAULT_VARIANT */
  variant?: Variant;
  /** 省略時は DEFAULT_POSITION */
  position?: Position;
  className?: string;
};

const DEFAULT_EVENTS = eventData as EventItem[];

/** 開始の何分前から「まもなく開催」にするか */
const SOON_WINDOW_MIN = 15;
/** カードの最大表示件数(末尾の「すべて見る」カードは含まない) */
const MAX_CARDS = 5;
/** 現在時刻の更新間隔 */
const TICK_MS = 30_000;
/** 表示設定の保存先(localStorage)。初期値を案Dに変えたので、前に保存した選択は使わないよう v2 にした */
const STORAGE_KEY = "eventinfo-prefs-v2";

const STATUS_LABEL: Record<EventStatus, string> = {
  soon: "まもなく開催",
  live: "開催中",
};

const VARIANT_OPTIONS: { value: Variant; letter: string; label: string }[] = [
  { value: "app", letter: "D", label: "シンプル" },
  { value: "led", letter: "A", label: "電光掲示板" },
  { value: "pop", letter: "B", label: "ポスター" },
  { value: "timetable", letter: "C", label: "時刻表" },
];

const POSITION_OPTIONS: { value: Position; label: string }[] = [
  { value: "top", label: "上部" },
  { value: "sticky", label: "上に固定" },
  { value: "bottom", label: "下に固定" },
];

/** 設定パネルに出すデザインの見本(小さな色見本) */
const VARIANT_SWATCH: Record<Variant, { box: string; bar: string }> = {
  app: { box: "border-[#d4d4d4] bg-white", bar: "bg-blue-600" },
  led: { box: "border-[#2e2e3c] bg-[#0d0d12]", bar: "bg-[#ff4d4d]" },
  pop: { box: "border-2 border-[#111] bg-[#ffd60a]", bar: "bg-[#111]" },
  timetable: {
    box: "border-[#d4d4d4] border-t-[3px] border-t-[#1d3cff] bg-white",
    bar: "bg-[#1d3cff]",
  },
};

const POSITION_HINT: Record<Position, string> = {
  top: "ホームの上に表示します。",
  sticky: "スクロールしても、画面の上に表示し続けます。",
  bottom: "画面の下に表示し続けます。",
};

const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function isVariant(v: unknown): v is Variant {
  return v === "app" || v === "led" || v === "pop" || v === "timetable";
}

function isPosition(v: unknown): v is Position {
  return v === "top" || v === "sticky" || v === "bottom";
}

/* -------------------------------------------------------------------------- */
/* useNow: 現在時刻を返すフック                                                */
/* -------------------------------------------------------------------------- */

/** 開発時のみ ?debugNow=HH:MM で仮想時計にする(実時刻との差分を返す) */
function getDebugOffsetMs(): number {
  if (process.env.NODE_ENV !== "development") return 0;
  const raw = new URLSearchParams(window.location.search).get("debugNow");
  const m = raw?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const target = new Date();
  target.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return target.getTime() - Date.now();
}

/**
 * 現在時刻を返す。マウント前は null(SSR とクライアント初回描画を一致させるため)。
 * 30秒ごとに更新し、画面に戻ったとき(スリープ復帰など)にも即更新する。
 */
export function useNow(intervalMs: number = TICK_MS): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const offset = getDebugOffsetMs();
    let id: number | undefined;

    // 表示は「分」単位でしか変わらないので、分が変わったときだけ state を更新する
    // (同じ分のあいだは再描画しない)
    const tick = () =>
      setNow((prev) => {
        const next = new Date(Date.now() + offset);
        return prev &&
          Math.floor(prev.getTime() / 60_000) ===
          Math.floor(next.getTime() / 60_000)
          ? prev
          : next;
      });

    const start = () => {
      tick();
      window.clearInterval(id);
      id = window.setInterval(tick, intervalMs);
    };

    // 画面が隠れている間は止めて(電池・CPUの節約)、戻ったときに即更新して再開する
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") start();
      else window.clearInterval(id);
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);

  return now;
}

/**
 * デザイン・位置の選択状態。
 * 優先順位: URL(開発時のみ) > 保存した選択(SHOW_SWITCHER が true のとき) > 初期値
 */
function usePrefs(defaults: Prefs): [Prefs, (patch: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(defaults);
  const { variant: defVariant, position: defPosition } = defaults;

  useEffect(() => {
    let saved: { variant?: unknown; position?: unknown } = {};
    if (SHOW_SWITCHER) {
      try {
        saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
      } catch {
        // 保存できない環境(プライベートブラウズ等)では無視
      }
    }
    const params =
      process.env.NODE_ENV === "development"
        ? new URLSearchParams(window.location.search)
        : null;
    const qv = params?.get("variant");
    const qp = params?.get("position");

    const next: Prefs = {
      variant: isVariant(qv) ? qv : isVariant(saved.variant) ? saved.variant : defVariant,
      position: isPosition(qp) ? qp : isPosition(saved.position) ? saved.position : defPosition,
    };
    // 初期値と同じなら state を更新しない(無駄な再描画を避ける)
    setPrefs((prev) =>
      prev.variant === next.variant && prev.position === next.position
        ? prev
        : next,
    );
  }, [defVariant, defPosition]);

  const update = useCallback(
    (patch: Partial<Prefs>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 保存できなくても表示の切り替えは続ける
      }
    },
    [prefs],
  );

  return [prefs, update];
}

/* -------------------------------------------------------------------------- */
/* 判定ロジック                                                                */
/* -------------------------------------------------------------------------- */

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 「まもなく開催」「開催中」のイベントを、表示順(まもなく→開催中、同状態は開始順)で返す */
function pickActiveEvents(events: EventItem[], nowMin: number): ActiveEvent[] {
  const result: ActiveEvent[] = [];

  for (const ev of events) {
    const startMin = toMinutes(ev.startTime);
    const endMin = toMinutes(ev.endTime);

    if (nowMin >= endMin) continue; // 終了

    if (nowMin >= startMin) {
      // 開催中
      const duration = Math.max(endMin - startMin, 1);
      result.push({
        ...ev,
        status: "live",
        startMin,
        endMin,
        minutesLeft: Math.max(1, Math.ceil(endMin - nowMin)),
        progress: Math.min(1, Math.max(0, (nowMin - startMin) / duration)),
      });
    } else if (nowMin >= startMin - SOON_WINDOW_MIN) {
      // まもなく開催
      result.push({
        ...ev,
        status: "soon",
        startMin,
        endMin,
        minutesLeft: Math.max(1, Math.ceil(startMin - nowMin)),
        progress: 0,
      });
    }
    // それ以外(開始15分より前)は予定扱いで表示しない
  }

  const order: Record<EventStatus, number> = { soon: 0, live: 1 };
  return result.sort(
    (a, b) => order[a.status] - order[b.status] || a.startMin - b.startMin,
  );
}

/** これから始まる直近のイベント(なければ null = 当日の全イベント終了) */
function findNextEvent(events: EventItem[], nowMin: number): EventItem | null {
  const upcoming = events
    .filter((ev) => toMinutes(ev.startTime) > nowMin)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return upcoming[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* 案D: シンプル(マップ・出展一覧と同じ見た目)                                  */
/* -------------------------------------------------------------------------- */

/** マップ画面で、そのイベントの教室を開く(「T51,T53」のように複数あるときは最初の1つ) */
function mapHref(ev: EventItem): string {
  const params = new URLSearchParams({ floor: ev.floor });
  const room = ev.location.split(",")[0].trim();
  if (room) params.set("room", room);
  return `/?${params.toString()}`;
}

/** 次のカードが少し見えるよう、幅は画面の 90% にする(横にスワイプできると分かるように) */
const APP_CARD_WIDTH = "w-[90%] md:w-[320px] 2xl:w-[440px]";

/** 1件分。左に場所(出展一覧と同じ青いラベル)、右にイベント名と「開催中・時間・残り時間」。タップでマップのその教室へ */
function AppCard({ ev }: { ev: ActiveEvent }) {
  const isLive = ev.status === "live";

  return (
    <li className={cn("shrink-0 snap-start", APP_CARD_WIDTH)}>
      <Link
        href={mapHref(ev)}
        className="flex h-full items-start gap-3 rounded-lg border bg-background px-3 py-2 transition-colors hover:bg-muted active:bg-muted"
      >
        <span className="shrink-0 rounded-md bg-blue-600 px-2 py-0.5 text-sm font-bold text-white">
          {ev.floor}F {ev.location.replaceAll(",", "・")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{ev.eventName}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            {/* 色はマップの教室の詳細(開催中は赤)とそろえる */}
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-px font-bold text-white",
                isLive ? "bg-red-600" : "bg-orange-500",
              )}
            >
              {STATUS_LABEL[ev.status]}
            </span>
            {/* 横幅が狭いので「12:30〜14:30」の両方は出さず、これから気にする方の時刻と残り時間だけ出す */}
            <span className="truncate">
              {isLive ? `${ev.endTime}まで` : `${ev.startTime}から`}・
              <span className="font-bold text-foreground">あと{ev.minutesLeft}分</span>
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

function AppMoreCard({ href }: { href: string }) {
  return (
    <li className="shrink-0 snap-start">
      <Link
        href={href}
        className="flex h-full items-center gap-1 rounded-lg border bg-background px-3 text-sm font-bold text-blue-600 transition-colors hover:bg-muted active:bg-muted"
      >
        タイムテーブル
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* 案A: 電光掲示板                                                             */
/* -------------------------------------------------------------------------- */

const LED_CARD_WIDTH =
  "w-[76%] max-w-[276px] md:w-[320px] md:max-w-none 2xl:w-[440px]";

function LedCard({ ev }: { ev: ActiveEvent }) {
  const isLive = ev.status === "live";

  return (
    <li className={cn("shrink-0 snap-start", LED_CARD_WIDTH)}>
      {/* 将来: タップで EventDetailModal を開く場合はここを button 化 */}
      <div className="flex h-full flex-col gap-2.5 rounded-md border border-[#2e2e3c] bg-[#17171f] p-3.5 text-white 2xl:gap-3.5 2xl:p-6">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-2 text-xs leading-4 font-bold 2xl:text-base",
              isLive
                ? "bg-[#d9141e] py-[3px] text-white"
                : "border border-[#ffc83d] py-0.5 text-[#ffc83d]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                isLive ? "bg-white" : "bg-[#ffc83d]",
              )}
            />
            {STATUS_LABEL[ev.status]}
          </span>
          <span
            className={cn(
              ledFont.className,
              "text-sm leading-5 text-[#a9a9bb] tabular-nums 2xl:text-xl",
            )}
          >
            {ev.startTime}〜{ev.endTime}
          </span>
        </div>

        <h3 className="line-clamp-2 text-lg leading-[1.35] font-bold text-white 2xl:text-3xl">
          {ev.eventName}
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-sm border border-[#454558] px-2 py-0.5 text-[13px] leading-5 font-medium text-[#d4d4e0] 2xl:text-lg">
            <MapPin className="size-3.5 2xl:size-5" aria-hidden />
            {ev.floor}F {ev.location}
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-xs font-medium text-[#a9a9bb] 2xl:text-base">
              {isLive ? "終了まで" : "あと"}
            </span>
            <span
              className={cn(
                ledFont.className,
                "text-[44px] leading-none tabular-nums 2xl:text-[72px]",
                isLive ? "text-[#ff6b6b]" : "text-[#ffc83d]",
              )}
            >
              {ev.minutesLeft}
            </span>
            <span className="text-sm font-bold text-[#d4d4e0] 2xl:text-2xl">分</span>
          </span>
        </div>

        {isLive && (
          // LEDのセグメント風の進行バー
          <div
            className="h-2 bg-[repeating-linear-gradient(90deg,#2e2e3c_0_9px,transparent_9px_12px)]"
            role="progressbar"
            aria-label="イベントの進行状況"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ev.progress * 100)}
          >
            <div
              className="h-full bg-[repeating-linear-gradient(90deg,#ff4d4d_0_9px,transparent_9px_12px)] transition-[width] duration-500"
              style={{ width: `${ev.progress * 100}%` }}
            />
          </div>
        )}
      </div>
    </li>
  );
}

function LedMoreCard({ href }: { href: string }) {
  return (
    <li className="w-[150px] shrink-0 snap-start md:w-[200px] 2xl:w-[260px]">
      <Link
        href={href}
        className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2.5 rounded-md border border-dashed border-[#454558] p-3.5 text-center text-[15px] leading-[1.35] font-bold text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc83d] 2xl:text-xl"
      >
        <span>
          タイムテーブルを
          <br />
          すべて見る
        </span>
        <ArrowRight
          className="size-[22px] text-[#ffc83d] 2xl:size-7"
          strokeWidth={2.5}
          aria-hidden
        />
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* 案B: ポスター                                                               */
/* -------------------------------------------------------------------------- */

const POP_CARD_WIDTH =
  "w-[75%] max-w-[280px] md:w-[320px] md:max-w-none 2xl:w-[440px]";

function PopCard({ ev }: { ev: ActiveEvent }) {
  const isLive = ev.status === "live";
  const remaining = isLive
    ? `終了まであと${ev.minutesLeft}分`
    : `あと${ev.minutesLeft}分`;

  return (
    <li className={cn("shrink-0 snap-start", POP_CARD_WIDTH)}>
      {/* 将来: タップで EventDetailModal を開く場合はここを button 化 */}
      <div className="flex h-full flex-col gap-3 rounded-lg border-[3px] border-[#111] bg-white p-3.5 text-[#111] shadow-[5px_5px_0_#111] 2xl:gap-4 2xl:p-5 2xl:shadow-[7px_7px_0_#111]">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              popFont.className,
              "inline-block -rotate-[4deg] rounded border-[2.5px] border-[#111] px-2.5 py-0.5 text-[13px] leading-5 font-normal shadow-[2px_2px_0_#111] 2xl:text-base",
              isLive ? "bg-[#ff3d81]" : "bg-[#3ddcff]",
            )}
          >
            {STATUS_LABEL[ev.status]}
          </span>
          <span className="rounded-full bg-[#111] px-2.5 py-[3px] text-[13px] leading-[18px] font-bold text-white tabular-nums 2xl:px-3 2xl:text-lg 2xl:leading-6">
            {remaining}
          </span>
        </div>

        <h3
          className={cn(
            popFont.className,
            "line-clamp-2 text-xl leading-[1.3] font-normal 2xl:text-3xl",
          )}
        >
          {ev.eventName}
        </h3>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span
            className={cn(
              popFont.className,
              "text-[15px] leading-6 font-normal tabular-nums 2xl:text-xl",
            )}
          >
            {ev.startTime}〜{ev.endTime}
          </span>
          <span className="rounded bg-[#111] px-2 py-0.5 text-[13px] leading-5 font-bold text-white 2xl:text-base">
            {ev.floor}F {ev.location}
          </span>
        </div>

        {isLive && (
          <div
            className="h-3.5 overflow-hidden rounded-full border-[2.5px] border-[#111] bg-white"
            role="progressbar"
            aria-label="イベントの進行状況"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ev.progress * 100)}
          >
            <div
              className={cn(
                "h-full bg-[#ff3d81] transition-[width] duration-500",
                ev.progress > 0.03 && "border-r-[2.5px] border-[#111]",
              )}
              style={{ width: `${ev.progress * 100}%` }}
            />
          </div>
        )}
      </div>
    </li>
  );
}

function PopMoreCard({ href }: { href: string }) {
  return (
    <li className="w-[150px] shrink-0 snap-start md:w-[200px] 2xl:w-[260px]">
      <Link
        href={href}
        className={cn(
          popFont.className,
          "flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border-[3px] border-[#111] bg-[#ff3d81] p-3.5 text-center text-[15px] leading-[1.4] font-normal text-[#111] shadow-[5px_5px_0_#111] transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111] focus-visible:ring-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[3px_3px_0_#111] 2xl:text-xl 2xl:shadow-[7px_7px_0_#111]",
        )}
      >
        <span>
          タイムテーブル
          <br />
          すべて見る
        </span>
        <ArrowRight className="size-6 2xl:size-8" strokeWidth={3} aria-hidden />
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* 案C: 時刻表                                                                 */
/* -------------------------------------------------------------------------- */

function TableColumn({ ev }: { ev: ActiveEvent }) {
  const isLive = ev.status === "live";

  return (
    <li className="mr-4 w-[244px] shrink-0 snap-start border-r border-[#0a0a0a] pr-4 md:mr-6 md:w-[300px] md:pr-6 2xl:mr-8 2xl:w-[400px] 2xl:pr-8">
      {/* 将来: タップで EventDetailModal を開く場合はここを button 化 */}
      <div className="flex h-full flex-col">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs leading-4 font-black 2xl:text-base",
            isLive ? "text-[#1d3cff]" : "text-[#0a0a0a]",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              isLive ? "bg-[#1d3cff]" : "border-2 border-[#0a0a0a]",
            )}
          />
          {STATUS_LABEL[ev.status]}
        </span>

        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-[13px] leading-5 font-medium text-[#5c5c5c] 2xl:text-lg">
            {isLive ? "終了まで" : "あと"}
          </span>
          <span
            className={cn(
              numFont.className,
              "text-[76px] leading-[0.95] font-bold tracking-[-0.04em] tabular-nums 2xl:text-[112px]",
              isLive ? "text-[#1d3cff]" : "text-[#0a0a0a]",
            )}
          >
            {ev.minutesLeft}
          </span>
          <span className="text-xl leading-6 font-bold 2xl:text-3xl">分</span>
        </div>

        {isLive ? (
          <div
            className="mt-2.5 h-[3px] bg-[#dcdcdc]"
            role="progressbar"
            aria-label="イベントの進行状況"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ev.progress * 100)}
          >
            <div
              className="h-full bg-[#1d3cff] transition-[width] duration-500"
              style={{ width: `${ev.progress * 100}%` }}
            />
          </div>
        ) : (
          // まだ始まっていないので点線
          <div
            aria-hidden
            className="mt-2.5 h-[3px] bg-[repeating-linear-gradient(90deg,#0a0a0a_0_4px,transparent_4px_8px)]"
          />
        )}

        <h3 className="mt-3.5 line-clamp-2 text-lg leading-[1.35] font-black 2xl:text-3xl">
          {ev.eventName}
        </h3>

        <p className="mt-auto pt-2.5 text-[13px] leading-5 text-[#5c5c5c] 2xl:text-lg">
          <span className={cn(numFont.className, "font-bold text-[#0a0a0a]")}>
            {ev.startTime}〜{ev.endTime}
          </span>{" "}
          ・ {ev.floor}F {ev.location}
        </p>
      </div>
    </li>
  );
}

function TableMoreColumn({ href }: { href: string }) {
  return (
    <li className="w-[150px] shrink-0 snap-start pr-4 md:w-[200px] md:pr-8 2xl:w-[260px]">
      <Link
        href={href}
        className="flex h-full min-h-[150px] flex-col justify-between gap-3 text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d3cff]"
      >
        <span className="text-[15px] leading-[1.4] font-black 2xl:text-xl">
          タイムテーブルを
          <br />
          すべて見る
        </span>
        <ArrowRight
          className="size-11 text-[#1d3cff] 2xl:size-14"
          strokeWidth={2.5}
          aria-hidden
        />
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* 共通: セクション枠・カルーセル・待機表示                                     */
/* -------------------------------------------------------------------------- */

/** セクションの背景・余白・枠線(position が bottom のときは下側の線を消す) */
function frameClass(variant: Variant, atBottom: boolean): string {
  switch (variant) {
    case "app":
      // 見出しも時計も出さず、カードだけを並べて低くする
      return cn("bg-background py-2 text-foreground", !atBottom && "border-b");
    case "led":
      return "bg-[#0d0d12] pt-3.5 pb-4 text-white 2xl:pt-6 2xl:pb-6";
    case "pop":
      return cn(
        "border-[#111] bg-[#ffd60a] pt-3.5 pb-1.5 text-[#111] 2xl:pt-6 2xl:pb-3",
        atBottom ? "border-t-[3px]" : "border-y-[3px]",
      );
    case "timetable":
      return cn(
        "border-t-4 border-t-[#1d3cff] bg-white pt-3.5 pb-4 text-[#0a0a0a] 2xl:pt-6 2xl:pb-6",
        !atBottom && "border-b border-b-[#0a0a0a]",
      );
  }
}

const LIST_CLASS: Record<Variant, string> = {
  app: "scroll-px-4 gap-2 px-4 md:scroll-px-8 md:px-8",
  led: "scroll-px-4 gap-2.5 px-4 pb-0.5 md:scroll-px-8 md:gap-4 md:px-8",
  pop: "scroll-px-4 gap-3.5 px-4 pb-3 md:scroll-px-8 md:gap-5 md:px-8 2xl:pb-4",
  timetable: "scroll-pl-4 pl-4 md:scroll-pl-8 md:pl-8",
};

const ARROW_TONE: Record<Variant, string> = {
  app: "bg-blue-600 text-white hover:bg-blue-700",
  led: "bg-[#ffc83d] text-[#0d0d12] hover:bg-[#ffc83d]/90",
  pop: "border-2 border-[#111] bg-[#111] text-[#ffd60a] hover:bg-[#111]/85",
  timetable: "bg-[#1d3cff] text-white hover:bg-[#1d3cff]/90",
};

function SectionFrame({
  variant,
  position,
  clock,
  children,
}: {
  variant: Variant;
  position: Position;
  clock: string;
  children: ReactNode;
}) {
  const atBottom = position === "bottom";

  return (
    <section
      aria-label="リアルタイム開催イベント"
      className={cn(
        frameClass(variant, atBottom),
        atBottom && "shadow-[0_-4px_16px_rgba(0,0,0,0.15)]",
      )}
    >
      <div className={cn("mb-3.5 flex items-center justify-between px-4 md:px-8 2xl:mb-5", variant === "app" && "hidden")}>
        {variant === "led" && (
          <>
            <h2 className="flex items-center gap-2 text-[13px] leading-5 font-bold tracking-[0.04em] text-[#d4d4e0] 2xl:text-lg">
              <span aria-hidden className="size-2 rounded-full bg-[#ff4d4d]" />
              リアルタイム開催イベント
            </h2>
            <time
              className={cn(
                ledFont.className,
                "text-[22px] leading-6 tracking-[0.04em] text-[#ffc83d] tabular-nums 2xl:text-4xl 2xl:leading-10",
              )}
            >
              {clock}
            </time>
          </>
        )}
        {variant === "pop" && (
          <>
            <h2
              className={cn(
                popFont.className,
                "text-base leading-6 font-normal 2xl:text-2xl",
              )}
            >
              リアルタイム開催イベント
            </h2>
            <time
              className={cn(
                popFont.className,
                "rounded-full bg-[#111] px-2.5 py-0.5 text-sm leading-[22px] font-normal text-[#ffd60a] tabular-nums 2xl:px-4 2xl:text-xl 2xl:leading-8",
              )}
            >
              {clock}
            </time>
          </>
        )}
        {variant === "timetable" && (
          <>
            <h2 className="text-[13px] leading-5 font-black 2xl:text-lg">
              リアルタイム開催イベント
            </h2>
            <time className="inline-flex items-baseline gap-1.5 text-xs leading-5 text-[#5c5c5c] 2xl:text-base">
              現在
              <span
                className={cn(
                  numFont.className,
                  "text-base font-bold text-[#1d3cff] 2xl:text-2xl",
                )}
              >
                {clock}
              </span>
            </time>
          </>
        )}
      </div>
      {children}
    </section>
  );
}

function EventItemView({ variant, ev }: { variant: Variant; ev: ActiveEvent }) {
  if (variant === "app") return <AppCard ev={ev} />;
  if (variant === "led") return <LedCard ev={ev} />;
  if (variant === "pop") return <PopCard ev={ev} />;
  return <TableColumn ev={ev} />;
}

function MoreItemView({ variant, href }: { variant: Variant; href: string }) {
  if (variant === "app") return <AppMoreCard href={href} />;
  if (variant === "led") return <LedMoreCard href={href} />;
  if (variant === "pop") return <PopMoreCard href={href} />;
  return <TableMoreColumn href={href} />;
}

/** 横スクロールのカルーセル。md以上のときだけ左右の矢印ボタンを出す(PCのマウス操作用) */
function EventCarousel({
  variant,
  events,
  timetableHref,
}: {
  variant: Variant;
  events: ActiveEvent[];
  timetableHref: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const updateEdge = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    // 変化がないときは state を更新しない(スクロール中の無駄な再描画を防ぐ)
    setEdge((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  // 矢印ボタンは md(768px)以上でしか出さないので、スマホではスクロール監視をしない
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 768px)");
    let stop = () => { };

    const setup = () => {
      stop();
      stop = () => { };
      if (!mq.matches) return;
      updateEdge();
      el.addEventListener("scroll", updateEdge, { passive: true });
      const ro = new ResizeObserver(updateEdge);
      ro.observe(el);
      stop = () => {
        el.removeEventListener("scroll", updateEdge);
        ro.disconnect();
      };
    };

    setup();
    mq.addEventListener("change", setup);
    return () => {
      mq.removeEventListener("change", setup);
      stop();
    };
  }, [updateEdge, events.length, variant]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const arrowClass = cn(
    "absolute top-1/2 z-10 hidden -translate-y-1/2 rounded-full shadow-md md:inline-flex 2xl:size-12",
    ARROW_TONE[variant],
  );

  return (
    <div className="relative">
      <ul
        ref={listRef}
        className={cn(
          "flex overflow-x-auto overscroll-x-contain snap-x snap-mandatory",
          LIST_CLASS[variant],
          NO_SCROLLBAR,
        )}
      >
        {events.map((ev) => (
          <EventItemView key={ev.id} variant={variant} ev={ev} />
        ))}
        <MoreItemView variant={variant} href={timetableHref} />
      </ul>

      {edge.left && (
        <Button
          type="button"
          size="icon"
          aria-label="前のイベントへ"
          onClick={() => scrollByPage(-1)}
          className={cn(arrowClass, "left-2")}
        >
          <ChevronLeft className="size-5 2xl:size-6" />
        </Button>
      )}
      {edge.right && (
        <Button
          type="button"
          size="icon"
          aria-label="次のイベントへ"
          onClick={() => scrollByPage(1)}
          className={cn(arrowClass, "right-2")}
        >
          <ChevronRight className="size-5 2xl:size-6" />
        </Button>
      )}
    </div>
  );
}

/** 該当イベント0件のとき: 次のイベントを控えめに1行だけ */
function NextStrip({
  variant,
  position,
  event,
}: {
  variant: Variant;
  position: Position;
  event: EventItem;
}) {
  const atBottom = position === "bottom";

  const tone =
    variant === "app"
      ? cn("bg-background text-muted-foreground", !atBottom && "border-b")
      : variant === "led"
      ? "bg-[#0d0d12] text-[#a9a9bb]"
      : variant === "pop"
        ? cn(
          "border-[#111] bg-[#ffd60a] font-bold text-[#111]",
          atBottom ? "border-t-2" : "border-b-2",
        )
        : cn(
          "border-t-4 border-t-[#1d3cff] bg-white text-[#5c5c5c]",
          !atBottom && "border-b border-b-[#0a0a0a]",
        );

  return (
    <section
      aria-label="次のイベント"
      className={cn("px-4 py-2 md:px-8 2xl:py-3", tone)}
    >
      <p className="flex items-center gap-1.5 text-[13px] leading-5 2xl:text-lg">
        <Clock className="size-4 shrink-0 2xl:size-5" aria-hidden />
        <span className="truncate">
          次は {event.startTime}〜 {event.eventName}
        </span>
      </p>
    </section>
  );
}

function EventInfoSkeleton({ variant }: { variant: Variant }) {
  const dark = variant === "led";
  return (
    <div
      aria-hidden
      className={cn(
        "px-4 py-3.5 md:px-8",
        variant === "app" && "border-b bg-background py-2",
        variant === "led" && "bg-[#0d0d12]",
        variant === "pop" && "border-y-[3px] border-[#111] bg-[#ffd60a]",
        variant === "timetable" &&
        "border-t-4 border-t-[#1d3cff] border-b border-b-[#0a0a0a] bg-white",
      )}
    >
      {variant === "app" ? (
        <Skeleton className={cn("h-[3.375rem] rounded-lg bg-black/10", APP_CARD_WIDTH)} />
      ) : (
        <>
          <Skeleton
            className={cn("mb-3.5 h-5 w-44", dark ? "bg-white/10" : "bg-black/10")}
          />
          <Skeleton
            className={cn(
              "h-[140px] rounded-lg",
              dark ? "bg-white/10" : "bg-black/10",
              POP_CARD_WIDTH,
            )}
          />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 表示位置(top / sticky / bottom)                                           */
/* -------------------------------------------------------------------------- */

function PositionShell({
  position,
  className,
  onBarHeight,
  children,
}: {
  position: Position;
  className?: string;
  /** bottom のときの固定バーの高さを親に伝える(設定ボタンを避けるため) */
  onBarHeight: (height: number) => void;
  children: ReactNode;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  // bottom のときは、固定バーの高さぶんの空きを通常の流れに作って、ページ末尾が隠れないようにする
  useEffect(() => {
    const el = barRef.current;
    if (position !== "bottom" || !el) return;
    const measure = () => {
      setBarHeight(el.offsetHeight);
      onBarHeight(el.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      onBarHeight(0);
    };
  }, [position, onBarHeight]);

  if (position === "bottom") {
    return (
      <>
        <div aria-hidden style={{ height: barHeight }} />
        <div
          ref={barRef}
          className={cn("fixed inset-x-0 bottom-(--bottom-nav-space) z-40", className)}
        >
          {children}
        </div>
      </>
    );
  }

  if (position === "sticky") {
    // 親が overflow: hidden / auto だと固定されません(その場合は top か bottom を使ってください)
    return (
      <div
        className={cn("sticky z-40", className)}
        style={{ top: STICKY_TOP_PX }}
      >
        {children}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* 切り替えUI(画面右下の「表示設定」ボタン)                                    */
/* -------------------------------------------------------------------------- */

function DisplaySettings({
  prefs,
  onChange,
  bottomOffset,
}: {
  prefs: Prefs;
  onChange: (patch: Partial<Prefs>) => void;
  /** 下に固定のバーがあるときの高さ。ボタンがバーに隠れないようにする */
  bottomOffset: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="fixed right-3 z-50 flex flex-col items-end gap-2"
      style={{ bottom: `calc(var(--bottom-nav-space) + ${bottomOffset + 12}px)` }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="表示設定"
          className="w-[min(92vw,320px)] rounded-xl border bg-background p-3 text-foreground shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold">表示設定</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="閉じる"
              onClick={() => setOpen(false)}
              className="size-8"
            >
              <X className="size-4" />
            </Button>
          </div>

          <fieldset className="mb-3">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
              デザイン
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {VARIANT_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  variant={prefs.variant === o.value ? "default" : "outline"}
                  aria-pressed={prefs.variant === o.value}
                  onClick={() => onChange({ variant: o.value })}
                  className="h-auto flex-col gap-1.5 px-1.5 py-2"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "relative block h-6 w-full rounded-sm border",
                      VARIANT_SWATCH[o.value].box,
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-x-1.5 bottom-1 h-1 rounded-full",
                        VARIANT_SWATCH[o.value].bar,
                      )}
                    />
                  </span>
                  <span className="text-base leading-none font-bold">
                    {o.letter}
                  </span>
                  <span className="text-[11px] leading-tight font-normal">
                    {o.label}
                  </span>
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
              表示位置
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {POSITION_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  size="sm"
                  variant={prefs.position === o.value ? "default" : "outline"}
                  aria-pressed={prefs.position === o.value}
                  onClick={() => onChange({ position: o.value })}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              {POSITION_HINT[prefs.position]}
            </p>
          </fieldset>

          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
            選んだ内容はこの端末に保存されます。
          </p>
        </div>
      )}

      <Button
        type="button"
        size="icon"
        aria-label="表示設定"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="size-11 rounded-full shadow-lg"
      >
        <SlidersHorizontal className="size-5" />
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* メインコンポーネント                                                        */
/* -------------------------------------------------------------------------- */

export function EventInfo({
  events = DEFAULT_EVENTS,
  timetableHref = "/timetable", // TODO: 実際のタイムテーブルのパスに合わせる
  variant: variantProp = DEFAULT_VARIANT,
  position: positionProp = DEFAULT_POSITION,
  className,
}: EventInfoProps) {
  const now = useNow();
  const [prefs, updatePrefs] = usePrefs({
    variant: variantProp,
    position: positionProp,
  });
  const [barHeight, setBarHeight] = useState(0);
  const { variant, position } = prefs;

  const view = useMemo(() => {
    if (!now) return null;
    // 秒は使わない(表示は分単位。同じ分のあいだは再計算しない)
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const active = pickActiveEvents(events, nowMin);
    return {
      clock: formatClock(now),
      active: active.slice(0, MAX_CARDS),
      next: active.length === 0 ? findNextEvent(events, nowMin) : null,
    };
  }, [events, now]);

  let body: ReactNode = null;

  if (!view) {
    // マウント前(SSR / ハイドレーション時)はスケルトンのみ
    body = <EventInfoSkeleton variant={variant} />;
  } else if (view.active.length > 0) {
    body = (
      <SectionFrame variant={variant} position={position} clock={view.clock}>
        <EventCarousel
          variant={variant}
          events={view.active}
          timetableHref={timetableHref}
        />
      </SectionFrame>
    );
  } else if (view.next) {
    // 該当イベント0件 → 次のイベントを控えめに1件だけ
    body = <NextStrip variant={variant} position={position} event={view.next} />;
  }
  // それ以外(当日の全イベント終了後)は body = null で非表示

  return (
    <>
      {body && (
        <PositionShell
          position={position}
          className={className}
          onBarHeight={setBarHeight}
        >
          {body}
        </PositionShell>
      )}
      {/* 切り替えUI: 開発中だけ出す(イベントが無い時間でも試せるよう常に出す) */}
      {SHOW_SWITCHER &&
        now &&
        (body !== null || process.env.NODE_ENV === "development") && (
          <DisplaySettings
            prefs={prefs}
            onChange={updatePrefs}
            bottomOffset={position === "bottom" && body ? barHeight : 0}
          />
        )}
    </>
  );
}

export default EventInfo;