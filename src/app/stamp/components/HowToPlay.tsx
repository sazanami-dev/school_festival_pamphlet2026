"use client";

import { useRef } from "react";
import { MdInfoOutline } from "react-icons/md";

/** スタンプカード右上の「遊び方」ボタンと、その説明を出すダイアログ */
export default function HowToPlay({ children }: { children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex items-center gap-0.5 text-xs font-bold text-[#555555] active:opacity-60"
      >
        <MdInfoOutline aria-hidden className="size-5" />
        遊び方
      </button>

      {/* 背景（::backdrop）を押しても閉じる */}
      <dialog
        ref={dialogRef}
        aria-labelledby="how-to-play-title"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 text-foreground backdrop:bg-black/40"
      >
        <div className="space-y-3 p-5">
          <h2 id="how-to-play-title" className="text-lg font-bold">
            遊び方
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
