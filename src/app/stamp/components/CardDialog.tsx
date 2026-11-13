"use client";

import { useRef } from "react";
import Modal from "./Modal";

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
      <Modal ref={dialogRef} title={title}>
        {children}
      </Modal>
    </>
  );
}
