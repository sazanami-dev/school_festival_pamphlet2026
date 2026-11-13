/**
 * 出展一覧の階ジャンプボタンの見た目
 * 四角いボタンで、選択中（data-active が付いている）は青くする。
 */
export const floorButtonClass = [
  "flex size-10 flex-none shrink-0 items-center justify-center rounded-lg border border-border bg-background text-base text-foreground",
  "data-active:border-blue-500 data-active:bg-blue-500 data-active:text-white",
  "dark:data-active:border-blue-500 dark:data-active:bg-blue-500 dark:data-active:text-white",
].join(" ");
