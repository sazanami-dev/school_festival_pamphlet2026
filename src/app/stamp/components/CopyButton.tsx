"use client";

import { useEffect, useState } from "react";
import { MdCheck, MdContentCopy } from "react-icons/md";
import { cn } from "@/lib/utils";

/** コピーしたあと「コピーしました」を出しておく時間 */
const DONE_MS = 2000;

/** 引き継ぎコードなどをクリップボードにコピーするボタン */
export default function CopyButton({ text, className }: { text: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), DONE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      // HTTPS（または localhost）でないと navigator.clipboard は無い
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={cn(
        "flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#0048FF] bg-white text-sm font-bold text-[#0048FF] transition active:opacity-60",
        className,
      )}
    >
      {state === "done" ? (
        <MdCheck aria-hidden className="size-5" />
      ) : (
        <MdContentCopy aria-hidden className="size-4.5" />
      )}
      {state === "done" ? "コピーしました" : state === "failed" ? "コピーできませんでした" : "コピーする"}
    </button>
  );
}
