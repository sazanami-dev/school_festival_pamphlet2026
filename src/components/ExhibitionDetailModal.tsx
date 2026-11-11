"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import eventData from "@/data/event.json";

/* =========================================================
 * 型（出展一覧画面とこのモーダルで共通）
 * ======================================================= */

/** ExhibitionInfo.json の1件分 */
export type Exhibition = {
  id: string;
  exhibitionName: string;
  genre: string[];
  floor: string;
  location: string;
  /** location が教室番号ではなく SVG の ID のときの表示名（例: "飲食店エリア"） */
  locationName?: string;
  /** 設定がない場合は null */
  startTime: string | null;
  /** 設定がない場合は null */
  endTime: string | null;
  description: string;
};

/** event.json の1件分（DOM の Event と名前がぶつからないよう FestivalEvent にしている） */
export type FestivalEvent = {
  id: string;
  eventName: string;
  genre: string[];
  startTime: string | null;
  endTime: string | null;
  floor: string;
  location: string;
  description: string;
};

// 型を付けて代入することで、JSON の形が型と違えばエラーで気づける
const events: FestivalEvent[] = eventData;

/* =========================================================
 * ジャンルの色（マップの塗り色と揃える）
 * Tailwind はファイル内の文字列からクラス名を探すので、
 * `bg-${color}-100` のように組み立てず、省略せずに書くこと。
 * ======================================================= */

type GenreColor = { badge: string; dot: string };

const GENRE_COLORS: Record<string, GenreColor> = {
  飲食: { badge: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  物販: { badge: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-500" },
  展示: { badge: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
  体験: { badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  ゲーム: { badge: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
  イベント: { badge: "bg-pink-100 text-pink-800", dot: "bg-pink-500" },
  ステージ: { badge: "bg-rose-100 text-rose-800", dot: "bg-rose-500" },
  ライブ: { badge: "bg-red-100 text-red-800", dot: "bg-red-500" },
  音楽: { badge: "bg-fuchsia-100 text-fuchsia-800", dot: "bg-fuchsia-500" },
  パフォーマンス: { badge: "bg-purple-100 text-purple-800", dot: "bg-purple-500" },
  映像: { badge: "bg-indigo-100 text-indigo-800", dot: "bg-indigo-500" },
  コンテスト: { badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  表彰式: { badge: "bg-lime-100 text-lime-800", dot: "bg-lime-500" },
  参加型: { badge: "bg-teal-100 text-teal-800", dot: "bg-teal-500" },
  休憩: { badge: "bg-cyan-100 text-cyan-800", dot: "bg-cyan-500" },
};

/** 上の一覧にないジャンル（「その他」など）の色 */
const DEFAULT_GENRE_COLOR: GenreColor = { badge: "bg-neutral-100 text-neutral-700", dot: "bg-neutral-400" };

export function getGenreColor(genre: string): GenreColor {
  return GENRE_COLORS[genre] ?? DEFAULT_GENRE_COLOR;
}

/** ジャンルを GENRE_COLORS の順に並べる（一覧にないものは後ろ） */
export function sortGenres(genres: string[]): string[] {
  const order = Object.keys(GENRE_COLORS);
  const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : order.length);
  return [...genres].sort((a, b) => rank(a) - rank(b));
}

/* =========================================================
 * 表示用の小さな関数・部品（出展一覧画面でも使う）
 * ======================================================= */

/** 「12:00〜13:00」の形にする。どちらも null なら「終日」 */
export function formatTimeRange(start: string | null, end: string | null): string {
  if (start && end) return `${start}〜${end}`;
  if (start) return `${start}〜`;
  if (end) return `〜${end}`;
  return "終日";
}

/** 「2F T28」の形にする。場所が空なら「2F」だけ */
export function formatPlace(item: { floor: string; location: string; locationName?: string }): string {
  const place = item.locationName ?? item.location.replaceAll(",", "・");
  return place ? `${item.floor}F ${place}` : `${item.floor}F`;
}

/** ジャンルの数だけ色付きバッジを並べる */
export function GenreBadges({ genres, className }: { genres: string[]; className?: string }) {
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {genres.map((genre) => (
        <span key={genre} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", getGenreColor(genre).badge)}>
          {genre}
        </span>
      ))}
    </span>
  );
}

/**
 * マップ画面（ホーム）へのリンク。例: /?floor=2&room=T28
 * マップは ?floor= の階を開く。?room= は教室の強調用（マップ側が対応したら使われる）。
 * 「T51,T53」のように複数書かれている場所は、マップの教室IDに合わせて最初の1つを渡す。
 */
function mapHref(item: Exhibition): string {
  const params = new URLSearchParams({ floor: item.floor });
  const room = item.location.split(",")[0].trim();
  if (room) params.set("room", room);
  return `/?${params.toString()}`;
}

/* =========================================================
 * 詳細モーダル
 * ======================================================= */

type Props = {
  /** 表示する出展。null のときは閉じる */
  exhibition: Exhibition | null;
  onClose: () => void;
  /** 「マップで場所を見る」を出すか。マップから開くときは隠す */
  showMapLink?: boolean;
};

/** 出展の詳細モーダル（画面中央に表示する） */
export default function ExhibitionDetailModal({ exhibition, onClose, showMapLink = true }: Props) {
  // 閉じるアニメーションの間も中身を表示し続けるため、最後に開いた出展を覚えておく
  const [shown, setShown] = useState(exhibition);
  if (exhibition && exhibition !== shown) {
    setShown(exhibition);
  }

  // event.json から同じ場所のイベントを探し、開始時刻順に並べる
  const relatedEvents =
    shown && shown.location
      ? events
          .filter((ev) => ev.location === shown.location)
          .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
      : [];

  return (
    <Dialog.Root
      open={exhibition !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        {/* 画面中央に配置。少し縮んだ状態からふわっと出てくる */}
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-70 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-background text-foreground shadow-xl outline-none transition-[scale,opacity] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {shown && (
            <>
              <div className="flex items-start gap-3 border-b px-4 py-3">
                <Dialog.Title className="flex-1 pt-1 text-lg font-bold">{shown.exhibitionName}</Dialog.Title>
                <Dialog.Close
                  aria-label="閉じる"
                  className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                >
                  <XIcon className="size-5" />
                </Dialog.Close>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">場所</dt>
                  <dd>{formatPlace(shown)}</dd>
                  <dt className="text-muted-foreground">時間</dt>
                  <dd>{formatTimeRange(shown.startTime, shown.endTime)}</dd>
                  <dt className="text-muted-foreground">ジャンル</dt>
                  <dd>
                    <GenreBadges genres={shown.genre} />
                  </dd>
                </dl>

                <Dialog.Description className="text-sm leading-relaxed whitespace-pre-wrap">
                  {shown.description}
                </Dialog.Description>

                {relatedEvents.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-bold">この場所のイベント</h3>
                    <ul className="divide-y rounded-lg border text-sm">
                      {relatedEvents.map((ev) => (
                        <li key={ev.id} className="flex gap-3 px-3 py-2">
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {formatTimeRange(ev.startTime, ev.endTime)}
                          </span>
                          <span>{ev.eventName}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {showMapLink && (
                <div className="border-t px-4 py-3">
                  <Link
                    href={mapHref(shown)}
                    onClick={onClose}
                    className={buttonVariants({ size: "lg", className: "h-11 w-full text-base" })}
                  >
                    マップで場所を見る
                  </Link>
                </div>
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
