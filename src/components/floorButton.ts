/**
 * 出展一覧の階ジャンプボタンの見た目
 * 四角いボタンで、選択中（data-active が付いている）は青くする。
 */
export const floorButtonClass = [
  "flex size-10 flex-none shrink-0 items-center justify-center rounded-lg border border-border bg-background text-base text-foreground",
  "data-active:border-[#0048FF] data-active:bg-[#0048FF] data-active:text-white",
  "dark:data-active:border-[#0048FF] dark:data-active:bg-[#0048FF] dark:data-active:text-white",
].join(" ");
