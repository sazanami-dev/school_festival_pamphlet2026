/**
 * ジャンル絞り込みチップの見た目（出展一覧・タイムテーブルで共通）
 * 丸いチップで、選択中（aria-pressed が true）は青くする。
 */
export const genreChipClass =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors aria-pressed:border-blue-500 aria-pressed:bg-blue-500 aria-pressed:text-white";
