/**
 * 階ボタンの見た目（マップの階切り替えと、出展一覧の階ジャンプで共通）
 * 四角いボタンで、選択中（data-active が付いている）は青くする。
 * マップは Base UI の Tabs が data-active を付け、出展一覧は自分で付けている。
 *
 * dark: の指定は、tabs.tsx のダークモード用の選択中の色を上書きするためのもの
 */
export const floorButtonClass = [
  "flex size-10 flex-none shrink-0 items-center justify-center rounded-lg border border-border bg-background text-base text-foreground",
  "data-active:border-blue-500 data-active:bg-blue-500 data-active:text-white",
  "dark:data-active:border-blue-500 dark:data-active:bg-blue-500 dark:data-active:text-white",
].join(" ");
