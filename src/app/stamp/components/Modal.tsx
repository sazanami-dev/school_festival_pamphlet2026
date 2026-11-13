"use client";

import { useId } from "react";

/** スタンプ画面で使うダイアログの外枠（見出しと「閉じる」ボタン付き）。開くのは呼び出し側で ref.showModal() する */
export default function Modal({
  ref,
  title,
  children,
}: {
  ref: React.Ref<HTMLDialogElement>;
  title: string;
  children: React.ReactNode;
}) {
  const titleId = useId();

  return (
    // 背景（::backdrop）を押しても閉じる
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="space-y-3 p-5">
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        {children}
        <form method="dialog">
          <button
            type="submit"
            className="mt-2 h-11 w-full rounded-[10px] bg-[#0048FF] text-sm font-bold text-white active:opacity-80"
          >
            閉じる
          </button>
        </form>
      </div>
    </dialog>
  );
}
