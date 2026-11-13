"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ExhibitionCard from "@/components/ExhibitionCard";
import PageTitle from "@/components/PageTitle";
import { floorButtonClass } from "@/components/floorButton";
import { genreChipClass } from "@/components/genreChip";
import ExhibitionDetailModal, {
  formatPlace,
  getGenreColor,
  sortGenres,
  type Exhibition,
} from "@/components/ExhibitionDetailModal";
import exhibitionData from "@/data/ExhibitionInfo.json";

/* =========================================================
 * データ（型・ジャンルの色・詳細モーダルは src/components/ExhibitionDetailModal.tsx）
 * ======================================================= */

// 型を付けて代入することで、JSON の形が型と違えばエラーで気づける
const exhibitions: Exhibition[] = exhibitionData;

/** 検索語のURLパラメータ名（?q=） */
const QUERY_KEY = "q";
/** ジャンルのURLパラメータ名（?genre=飲食&genre=展示） */
const GENRE_KEY = "genre";
/** 入力が止まってから絞り込むまでの時間 */
const DEBOUNCE_MS = 200;

/* =========================================================
 * 検索用の小さな関数
 * ======================================================= */

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
    .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
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
      <button type="button" aria-pressed={selected.length === 0} onClick={onClear} className={genreChipClass}>
        すべて
      </button>
      {allGenres.map((genre) => (
        <button
          key={genre}
          type="button"
          aria-pressed={selected.includes(genre)}
          onClick={() => onToggle(genre)}
          className={genreChipClass}
        >
          <span aria-hidden className={cn("size-2 rounded-full", getGenreColor(genre).dot)} />
          {genre}
        </button>
      ))}
    </div>
  );
}

/** 階ジャンプバーの高さ（h-14 = 56px） */
const JUMP_BAR_HEIGHT = 56;
/** スクロールイベントがこの時間来なければ、スクロールが止まったとみなす */
const SCROLL_END_MS = 150;
/** ボタンで移動するとき、押した階に着くまで待つ最長の時間（途中で指で止められたときなど） */
const JUMP_TIMEOUT_MS = 3000;

/** その階の見出しがバーのすぐ下まで来たか（一番下までスクロールしきったときも着いたとみなす） */
function reachedFloor(floor: string) {
  const top = document.getElementById(`floor-${floor}`)?.getBoundingClientRect().top;
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  return atBottom || (top !== undefined && Math.abs(top - JUMP_BAR_HEIGHT) <= 2);
}

/**
 * 階ジャンプボタン。スクロールしても上部に残る（sticky）。
 * 高さ h-14 は、階見出しの top-14 と各階セクションの scroll-mt-14 と合わせている。
 * 今見ている階のボタンは、マップの階ボタンと同じく青くする。
 */
function FloorJumpBar({ activeFloors }: { activeFloors: Set<string> }) {
  const [current, setCurrent] = useState<string | null>(null);
  // ボタンで移動した階（着くまでの間、この階を青くしておく）
  const jumpedTo = useRef<string | null>(null);
  const barRef = useRef<HTMLElement>(null);
  // ボタンで移動している間は、通り過ぎる階を青くしないよう、スクロールが止まるまで押した階のままにする
  const jumping = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpDeadline = useRef(0);
  const endJumpRef = useRef<() => void>(() => {});

  // スクロールに合わせて「今見ている階」を求める
  useEffect(() => {
    const floors = allFloors.filter((f) => activeFloors.has(f));
    function update() {
      // バーの下まで上がってきた階のうち、一番下のもの。まだどこも上がっていなければ最初の階
      let found = floors[0] ?? null;
      for (const f of floors) {
        const top = document.getElementById(`floor-${f}`)?.getBoundingClientRect().top;
        if (top !== undefined && top <= JUMP_BAR_HEIGHT + 1) found = f;
      }
      setCurrent(found);
    }
    function endJump() {
      // スクロールが始まる前や途中で止まっただけなら、押した階に着くまで待ち続ける
      if (jumpedTo.current && !reachedFloor(jumpedTo.current) && performance.now() < jumpDeadline.current) {
        jumping.current = setTimeout(endJump, SCROLL_END_MS);
        return;
      }
      jumping.current = null;
      update();
    }
    endJumpRef.current = endJump;
    let frame = 0;
    function onScroll() {
      if (jumping.current) {
        // スクロールが続いている間は待ち、止まってから今の階を求め直す
        clearTimeout(jumping.current);
        jumping.current = setTimeout(endJump, SCROLL_END_MS);
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [activeFloors]);

  // 青いボタンが横にはみ出していたら、見える位置までバーを横スクロールする
  useEffect(() => {
    const bar = barRef.current;
    const button = bar?.querySelector<HTMLElement>("[data-active]");
    if (!bar || !button) return;
    const left = button.offsetLeft - bar.offsetLeft;
    const right = left + button.offsetWidth;
    if (left < bar.scrollLeft || right > bar.scrollLeft + bar.clientWidth) {
      bar.scrollTo({ left: left - (bar.clientWidth - button.offsetWidth) / 2, behavior: "smooth" });
    }
  }, [current]);

  /** clickedAt はタップした時刻（event.timeStamp。performance.now() と同じ基準） */
  function jump(floor: string, clickedAt: number) {
    jumpedTo.current = floor;
    setCurrent(floor);
    if (jumping.current) clearTimeout(jumping.current);
    jumpDeadline.current = clickedAt + JUMP_TIMEOUT_MS;
    jumping.current = setTimeout(endJumpRef.current, SCROLL_END_MS);
    document.getElementById(`floor-${floor}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      ref={barRef}
      aria-label="階へ移動"
      className="sticky top-0 z-20 flex h-14 items-center gap-2 overflow-x-auto border-b bg-background px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {allFloors.map((floor) => (
        <button
          key={floor}
          type="button"
          disabled={!activeFloors.has(floor)}
          onClick={(e) => jump(floor, e.timeStamp)}
          aria-label={`${floor}階へ移動`}
          aria-current={floor === current ? "location" : undefined}
          data-active={floor === current || undefined}
          className={cn(floorButtonClass, "not-data-active:hover:bg-muted disabled:opacity-30")}
        >
          {floor}
        </button>
      ))}
    </nav>
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
    <div className="mx-auto w-full max-w-md pb-(--bottom-nav-space)">
      <div className="space-y-3 px-4 pt-3 pb-3">
        <PageTitle>出展一覧</PageTitle>
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
        groups.map((group, i) => (
          <section
            key={group.floor}
            id={`floor-${group.floor}`}
            className={cn(
              "scroll-mt-14",
              // 最後の階は出展が少なくても見出しが一番上まで上がるよう、画面の高さから
              // 階ジャンプバー（3.5rem）と下のナビゲーションバーの分を引いた高さを確保する
              // （lvh はアドレスバーが隠れたときの高さ。どちらの状態でも上まで届く）
              i === groups.length - 1 && "min-h-[calc(100lvh-3.5rem-var(--bottom-nav-space))]",
            )}
          >
            {/* スクロール中もこの階の間は上部に残る（top-14 は階ジャンプバーの高さ） */}
            <h2 className="sticky top-14 z-10 border-b bg-muted px-4 py-1.5 text-sm font-bold">{group.floor}階</h2>
            <ul className="px-4">
              {group.items.map((item) => (
                <li key={item.id} className="border-b last:border-b-0">
                  <ExhibitionCard exhibition={item} onSelect={setSelected} />
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
    <div className="mx-auto w-full max-w-md px-4 pt-3">
      <PageTitle>出展一覧</PageTitle>
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
