"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatTimeRange, GenreBadges, MODAL_ACTION_CLASS } from "@/components/ExhibitionDetailModal";
import { cn } from "@/lib/utils";
import { isOngoing, toMinutes, useNowInMinutes, type Exhibition, type RoomInfo } from "./roomData";

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

  // イベントは始まる順に並べ、今やっているものと次に始まるものに印を付ける（時刻はサーバーでは分からないので印なし）
  const now = useNowInMinutes();
  // 見出しの下に出す階（教室の出展かイベントから取る）
  const floor = shown?.info.exhibitions[0]?.floor ?? shown?.info.events[0]?.floor;
  const sortedEvents = [...(shown?.info.events ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const liveId = now === null ? null : (sortedEvents.find((ev) => isOngoing(ev, now))?.id ?? null);
  const nextId =
    now === null ? null : (sortedEvents.find((ev) => toMinutes(ev.startTime) > now)?.id ?? null);

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
                <div className="min-w-0 flex-1 pt-1">
                  <Dialog.Title className="text-lg font-bold wrap-anywhere">{shown.name}</Dialog.Title>
                  {floor && <p className="text-sm text-muted-foreground">{floor}F</p>}
                </div>
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
                      {sortedEvents.map((ev) => (
                        <li
                          key={ev.id}
                          className={cn("px-3 py-3", ev.id === liveId && "bg-red-50 dark:bg-red-950")}
                        >
                          <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground tabular-nums">
                            {formatTimeRange(ev.startTime, ev.endTime)}
                            {/* マップの「開催中」バッジと同じ赤。次に始まるものは青 */}
                            {ev.id === liveId && (
                              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                                開催中
                              </span>
                            )}
                            {ev.id === nextId && (
                              <span className="rounded-full bg-[#0048FF] px-2 py-0.5 text-xs font-bold text-white">
                                次
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block font-bold wrap-anywhere">{ev.eventName}</span>
                          <GenreBadges genres={ev.genre} className="mt-1" />
                          <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                            {ev.description}
                          </span>
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
                    className={cn(buttonVariants({ size: "lg" }), MODAL_ACTION_CLASS)}
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
