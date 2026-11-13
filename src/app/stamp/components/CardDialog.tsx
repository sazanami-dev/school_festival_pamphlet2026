"use client";

import { useId, useRef } from "react";

/** スタンプカード右上の小さなボタン（「遊び方」「引き継ぎコード」）と、押すと出るダイアログ */
export default function CardDialog({
  icon,
  label,
  title = label,
  children,
}: {
  icon: React.ReactNode;
  /** ボタンの文字 */
  label: string;
  /** ダイアログの見出し。省くとボタンの文字と同じ */
  title?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-[#555555] active:opacity-60"
      >
        {icon}
        {label}
      </button>

      {/* 背景（::backdrop）を押しても閉じる */}
      <dialog
        ref={dialogRef}
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
    </>
  );
}
