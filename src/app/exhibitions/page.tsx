"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import exhibitionData from "@/data/ExhibitionInfo.json";
import eventData from "@/data/event.json";

/* =========================================================
 * 型とデータ
 * ======================================================= */

/** ExhibitionInfo.json の1件分 */
type Exhibition = {
  id: string;
  exhibitionName: string;
  genre: string[];
  floor: string;
  location: string;
  /** 設定がない場合は null */
  startTime: string | null;
  /** 設定がない場合は null */
  endTime: string | null;
  description: string;
};

/** event.json の1件分（DOM の Event と名前がぶつからないよう FestivalEvent にしている） */
type FestivalEvent = {
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
const exhibitions: Exhibition[] = exhibitionData;
const events: FestivalEvent[] = eventData;

/** 検索語のURLパラメータ名（?q=） */
const QUERY_KEY = "q";
/** ジャンルのURLパラメータ名（?genre=飲食&genre=展示） */
const GENRE_KEY = "genre";
/** 入力が止まってから絞り込むまでの時間 */
const DEBOUNCE_MS = 200;

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

function getGenreColor(genre: string): GenreColor {
  return GENRE_COLORS[genre] ?? DEFAULT_GENRE_COLOR;
}

/** ジャンルを GENRE_COLORS の順に並べる（一覧にないものは後ろ） */
function sortGenres(genres: string[]): string[] {
  const order = Object.keys(GENRE_COLORS);
  const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : order.length);
  return [...genres].sort((a, b) => rank(a) - rank(b));
}

/* =========================================================
 * 表示用・検索用の小さな関数
 * ======================================================= */

/** 「12:00〜13:00」の形にする。どちらも null なら「終日」 */
function formatTimeRange(start: string | null, end: string | null): string {
  if (start && end) return `${start}〜${end}`;
  if (start) return `${start}〜`;
  if (end) return `〜${end}`;
  return "終日";
}

/** 「2F T28」の形にする。場所が空なら「2F」だけ */
function formatPlace(item: { floor: string; location: string }): string {
  return item.location ? `${item.floor}F ${item.location}` : `${item.floor}F`;
}

/**
 * 検索で比べる前に文字の表記ゆれをそろえる。
 * 1. NFKC 正規化（全角英数→半角、半角カナ→全角カナ、全角スペース→半角）
 * 2. 英字を小文字に
 * 3. カタカナ（ァ〜ヶ）をひらがなに
 * 1 を先にしないと、半角カナがひらがなに変換されない。
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** 並び順: 階の昇順 → 教室名の昇順（T9 → T28 のように数字は数値として比べる） */
function compareExhibitions(a: Exhibition, b: Exhibition): number {
  const floorDiff = Number(a.floor) - Number(b.floor);
  if (floorDiff !== 0) return floorDiff;
  const locationDiff = a.location.localeCompare(b.location, "ja", { numeric: true });
  if (locationDiff !== 0) return locationDiff;
  return a.id.localeCompare(b.id, "ja", { numeric: true });
}

type FloorGroup = { floor: string; items: Exhibition[] };

/** 並べ替え済みの配列を階ごとにまとめる（同じ階が連続している前提） */
function groupByFloor(sorted: Exhibition[]): FloorGroup[] {
  const groups: FloorGroup[] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.floor === item.floor) {
      last.items.push(item);
    } else {
      groups.push({ floor: item.floor, items: [item] });
    }
  }
  return groups;
}

/** 検索語をスペースで区切り、すべての語を部分一致で含むか */
function matchesQuery(searchText: string, query: string): boolean {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  return terms.every((term) => searchText.includes(term));
}

/** マップ画面の /?floor=2&room=T28 へのリンク */
function mapHref(item: Exhibition): string {
  const params = new URLSearchParams({ floor: item.floor });
  if (item.location) params.set("room", item.location);
  return `/?${params.toString()}`;
}

/**
 * 今のURLのパラメータを書き換える。
 * replaceState なので履歴は増えない（戻るボタンで1文字ずつ戻ったりしない）。
 * Next.js が検知して useSearchParams の値も更新される。
 */
function updateSearchParams(update: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search);
  update(params);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

// 並べ替えと検索用の文字列はデータが変わらないので、最初に1回だけ作る
const sortedEntries = [...exhibitions].sort(compareExhibitions).map((exhibition) => ({
  exhibition,
  // 出展名・場所・詳細文を正規化してつなげる（改行でつなぎ、項目をまたいでヒットしないようにする）
  searchText: normalizeText(
    [exhibition.exhibitionName, formatPlace(exhibition), exhibition.description].join("\n"),
  ),
}));

/** 出展がある全ての階（階ジャンプボタン用） */
const allFloors = groupByFloor(sortedEntries.map((e) => e.exhibition)).map((g) => g.floor);

/** データに出てくる全ジャンル（絞り込みチップ用） */
const allGenres = sortGenres([...new Set(exhibitions.flatMap((e) => e.genre))]);

/* =========================================================
 * 部品
 * ======================================================= */

/** ジャンルの数だけ色付きバッジを並べる */
function GenreBadges({ genres, className }: { genres: string[]; className?: string }) {
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

const chipClass =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

/** ジャンル絞り込みチップ（横スクロール・複数選択可） */
function GenreChips({
  selected,
  onToggle,
  onClear,
}: {
  selected: string[];
  onToggle: (genre: string) => void;
  onClear: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="ジャンルで絞り込み"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button type="button" aria-pressed={selected.length === 0} onClick={onClear} className={chipClass}>
        すべて
      </button>
      {allGenres.map((genre) => (
        <button
          key={genre}
          type="button"
          aria-pressed={selected.includes(genre)}
          onClick={() => onToggle(genre)}
          className={chipClass}
        >
          <span aria-hidden className={cn("size-2 rounded-full", getGenreColor(genre).dot)} />
          {genre}
        </button>
      ))}
    </div>
  );
}

/**
 * 階ジャンプボタン。スクロールしても上部に残る（sticky）。
 * 高さ h-14 は、階見出しの top-14 と各階セクションの scroll-mt-14 と合わせている。
 */
function FloorJumpBar({ activeFloors }: { activeFloors: Set<string> }) {
  function jump(floor: string) {
    document.getElementById(`floor-${floor}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="階へ移動"
      className="sticky top-0 z-20 flex h-14 items-center gap-2 overflow-x-auto border-b bg-background px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {allFloors.map((floor) => (
        <button
          key={floor}
          type="button"
          disabled={!activeFloors.has(floor)}
          onClick={() => jump(floor)}
          className="flex h-9 min-w-11 shrink-0 items-center justify-center rounded-lg border px-2 text-sm font-medium hover:bg-muted disabled:opacity-30"
        >
          {floor}F
        </button>
      ))}
    </nav>
  );
}

/** 一覧の1項目。項目全体がタップ範囲 */
function ExhibitionListItem({
  exhibition,
  onSelect,
}: {
  exhibition: Exhibition;
  onSelect: (exhibition: Exhibition) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(exhibition)}
      className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      <span className="font-bold">{exhibition.exhibitionName}</span>
      <span className="text-sm text-muted-foreground">
        {formatPlace(exhibition)}
        <span className="mx-1.5">・</span>
        {formatTimeRange(exhibition.startTime, exhibition.endTime)}
      </span>
      <GenreBadges genres={exhibition.genre} className="mt-0.5" />
    </button>
  );
}

/** 出展の詳細モーダル（画面下からせり上がるシート） */
function ExhibitionDetailModal({ exhibition, onClose }: { exhibition: Exhibition | null; onClose: () => void }) {
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
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-background text-foreground shadow-xl outline-none transition-transform duration-200 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full">
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

              <div className="border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Link
                  href={mapHref(shown)}
                  onClick={onClose}
                  className={buttonVariants({ size: "lg", className: "h-11 w-full text-base" })}
                >
                  マップで場所を見る
                </Link>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* =========================================================
 * 画面本体
 * ======================================================= */

function ExhibitionsView() {
  const searchParams = useSearchParams();

  // 絞り込みに使う値は URL から読む（詳細を閉じたり、マップから戻ったりしても条件が残る）
  const query = searchParams.get(QUERY_KEY) ?? "";
  const selectedGenres = useMemo(
    () => searchParams.getAll(GENRE_KEY).filter((g) => allGenres.includes(g)),
    [searchParams],
  );

  // 入力欄の表示は自分の状態で持つ（URL に直結すると日本語入力が崩れるため）
  const [inputValue, setInputValue] = useState(query);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selected, setSelected] = useState<Exhibition | null>(null);

  // 画面を離れるときに、待っているデバウンスを取り消す
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  function handleInputChange(value: string) {
    setInputValue(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    // 入力が 200ms 止まったら URL に保存 → useSearchParams が変わって絞り込みが走る
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      updateSearchParams((params) => {
        if (value) params.set(QUERY_KEY, value);
        else params.delete(QUERY_KEY);
      });
    }, DEBOUNCE_MS);
  }

  function toggleGenre(genre: string) {
    updateSearchParams((params) => {
      // 素早く連続で押しても取りこぼさないよう、今の URL から読んで更新する
      const current = params.getAll(GENRE_KEY);
      const next = current.includes(genre) ? current.filter((g) => g !== genre) : [...current, genre];
      params.delete(GENRE_KEY);
      for (const g of next) params.append(GENRE_KEY, g);
    });
  }

  function clearGenres() {
    updateSearchParams((params) => params.delete(GENRE_KEY));
  }

  function clearAll() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
    setInputValue("");
    updateSearchParams((params) => {
      params.delete(QUERY_KEY);
      params.delete(GENRE_KEY);
    });
  }

  // 絞り込み → 階ごとにまとめる。該当0件の階はグループが作られないので見出しも出ない
  const groups = useMemo(() => {
    const filtered = sortedEntries
      .filter(
        ({ exhibition, searchText }) =>
          (selectedGenres.length === 0 || exhibition.genre.some((g) => selectedGenres.includes(g))) &&
          matchesQuery(searchText, query),
      )
      .map(({ exhibition }) => exhibition);
    return groupByFloor(filtered);
  }, [selectedGenres, query]);

  const activeFloors = useMemo(() => new Set(groups.map((g) => g.floor)), [groups]);

  return (
    <div className="mx-auto w-full max-w-md pb-24">
      <div className="space-y-3 px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold">出展一覧</h1>
        <input
          type="search"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter でスマホのキーボードを閉じる
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          enterKeyHint="search"
          placeholder="出展名・場所・内容で検索"
          aria-label="出展を検索"
          className="h-11 w-full rounded-lg border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <GenreChips selected={selectedGenres} onToggle={toggleGenre} onClear={clearGenres} />
      </div>

      <FloorJumpBar activeFloors={activeFloors} />

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
          <p className="text-muted-foreground">該当する出展がありません</p>
          <Button variant="outline" size="lg" onClick={clearAll}>
            条件をクリア
          </Button>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.floor} id={`floor-${group.floor}`} className="scroll-mt-14">
            {/* スクロール中もこの階の間は上部に残る（top-14 は階ジャンプバーの高さ） */}
            <h2 className="sticky top-14 z-10 border-b bg-muted px-4 py-1.5 text-sm font-bold">{group.floor}F</h2>
            <ul className="divide-y">
              {group.items.map((item) => (
                <li key={item.id}>
                  <ExhibitionListItem exhibition={item} onSelect={setSelected} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <ExhibitionDetailModal exhibition={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** 読み込み中に表示する枠 */
function ExhibitionsFallback() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4">
      <h1 className="text-xl font-bold">出展一覧</h1>
      <p className="py-16 text-center text-sm text-muted-foreground">読み込み中…</p>
    </div>
  );
}

export default function ExhibitionsPage() {
  // useSearchParams を使う部分は Suspense で囲む（無いと本番ビルドが失敗する）
  return (
    <Suspense fallback={<ExhibitionsFallback />}>
      <ExhibitionsView />
    </Suspense>
  );
}
