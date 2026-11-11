import { cn } from "@/lib/utils";
import { formatTimeRange, GenreBadges, type Exhibition } from "@/components/ExhibitionDetailModal";

type ExhibitionCardProps = {
  exhibition: Exhibition;
  onSelect: (exhibition: Exhibition) => void;
  /** マップで強調している教室の出展なら true（背景を青くする） */
  selected?: boolean;
};

/**
 * 出展一覧の1項目（マップのボトムシートと出展一覧ページで共通）。項目全体がタップ範囲
 * 左に場所（青いラベル）、右に出展名・時間・ジャンル
 */
export default function ExhibitionCard({ exhibition, onSelect, selected = false }: ExhibitionCardProps) {
  const place = exhibition.locationName ?? (exhibition.location.replaceAll(",", "・") || "―");
  const hasTime = exhibition.startTime !== null || exhibition.endTime !== null;

  return (
    <button
      type="button"
      onClick={() => onSelect(exhibition)}
      aria-current={selected || undefined}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted",
        selected && "bg-blue-50 hover:bg-blue-50 dark:bg-blue-950",
      )}
    >
      <span className="shrink-0 rounded-md bg-blue-600 px-2 py-0.5 text-sm font-bold text-white">{place}</span>
      <span className="min-w-0 flex-1">
        {/* 英語の長い名前でも画面からはみ出さないよう、どこでも折り返せるようにする */}
        <span className="block font-bold wrap-anywhere">{exhibition.exhibitionName}</span>
        {hasTime && (
          <span className="block text-sm text-muted-foreground tabular-nums">
            {formatTimeRange(exhibition.startTime, exhibition.endTime)}
          </span>
        )}
        <GenreBadges genres={exhibition.genre} className="mt-1" />
      </span>
    </button>
  );
}
