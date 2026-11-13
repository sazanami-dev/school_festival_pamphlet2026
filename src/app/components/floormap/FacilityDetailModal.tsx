"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { CircleAlert, CreditCard, XIcon } from "lucide-react";
import type { Facility } from "./roomData";

type FacilityDetailModalProps = {
  /** 表示する設備。null のときは閉じる */
  facility: Facility | null;
  onClose: () => void;
};

/** 設備（マックスマートなど）の案内。使える支払い方法と注意書きを出す */
export default function FacilityDetailModal({ facility, onClose }: FacilityDetailModalProps) {
  // 閉じるアニメーションの間も中身を表示し続けるため、最後に開いた設備を覚えておく
  const [shown, setShown] = useState(facility);
  if (facility && facility !== shown) {
    setShown(facility);
  }

  return (
    <Dialog.Root
      open={facility !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-70 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-70 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-background text-foreground shadow-xl outline-none transition-[scale,opacity] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {shown && (
            <>
              <div className="flex items-start gap-3 border-b px-4 py-3">
                <div className="min-w-0 flex-1 pt-1">
                  <Dialog.Title className="text-lg font-bold wrap-anywhere">{shown.name}</Dialog.Title>
                  <p className="text-sm text-muted-foreground">{shown.floor}F</p>
                </div>
                <Dialog.Close
                  aria-label="閉じる"
                  className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                >
                  <XIcon className="size-5" />
                </Dialog.Close>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {shown.description && (
                  <Dialog.Description className="text-sm leading-relaxed whitespace-pre-wrap">
                    {shown.description}
                  </Dialog.Description>
                )}

                {/* 一番大事な注意（現金が使えない など）は最初に目立たせる */}
                {shown.notes.length > 0 && (
                  <ul className="space-y-1 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                    {shown.notes.map((note) => (
                      <li key={note} className="flex items-center gap-2">
                        <CircleAlert aria-hidden className="size-4 shrink-0" />
                        {note}
                      </li>
                    ))}
                  </ul>
                )}

                <section>
                  <h3 className="mb-2 text-sm font-bold">使える支払い方法</h3>
                  <ul className="divide-y rounded-lg border text-sm">
                    {shown.payments.map((payment) => (
                      <li key={payment} className="flex items-center gap-2 px-3 py-2.5">
                        <CreditCard aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        {payment}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
