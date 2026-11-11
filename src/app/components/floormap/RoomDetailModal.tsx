"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatTimeRange, GenreBadges } from "@/components/ExhibitionDetailModal";
import type { Exhibition, RoomInfo } from "./roomData";

type RoomDetailModalProps = {
  /** 表示する教室。null のときは閉じる */
  room: { name: string; info: RoomInfo } | null;
  onClose: () => void;
  onSelectExhibition: (exhibition: Exhibition) => void;
};

/** 1つの教室にある出展とイベントの一覧。出展を選ぶと、その詳細モーダルに進む */
export default function RoomDetailModal({ room, onClose, onSelectExhibition }: RoomDetailModalProps) {
  // 閉じるアニメーションの間も中身を表示し続けるため、最後に開いた教室を覚えておく
  const [shown, setShown] = useState(room);
  if (room && room !== shown) {
    setShown(room);
  }

  return (
    <Dialog.Root
      open={room !== null}
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
                <Dialog.Title className="min-w-0 flex-1 pt-1 text-lg font-bold wrap-anywhere">{shown.name}</Dialog.Title>
                <Dialog.Close
                  aria-label="閉じる"
                  className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                >
                  <XIcon className="size-5" />
                </Dialog.Close>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {shown.info.exhibitions.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-bold">出展（{shown.info.exhibitions.length}件）</h3>
                    <ul className="divide-y rounded-lg border">
                      {shown.info.exhibitions.map((ex) => (
                        <li key={ex.id}>
                          <button
                            type="button"
                            onClick={() => onSelectExhibition(ex)}
                            className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                          >
                            <span className="block text-sm font-bold wrap-anywhere">{ex.exhibitionName}</span>
                            <GenreBadges genres={ex.genre} className="mt-1" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {shown.info.events.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-bold">イベント（{shown.info.events.length}件）</h3>
                    <ul className="divide-y rounded-lg border text-sm">
                      {shown.info.events.map((ev) => (
                        <li key={ev.id} className="px-3 py-2.5">
                          <span className="block text-muted-foreground tabular-nums">
                            {formatTimeRange(ev.startTime, ev.endTime)}
                          </span>
                          <span className="block font-bold">{ev.eventName}</span>
                          <span className="mt-1 block text-xs leading-relaxed">{ev.description}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {shown.info.events.length > 0 && (
                <div className="border-t px-4 py-3">
                  <Link
                    href="/timetable"
                    onClick={onClose}
                    className={buttonVariants({ size: "lg", className: "h-11 w-full text-base" })}
                  >
                    タイムテーブルを見る
                  </Link>
                </div>
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
