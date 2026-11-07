"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_SPACE } from "@/components/BottomNav";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { Floor } from "./floors";
import { getExhibitionsOnFloor, locationsOf, type Exhibition } from "./roomData";

// 閉じたとき（見出しだけ）・半分・ほぼ全画面 の3段階
// ページ側はシートの見出しで隠れないよう、一番下に SHEET_PEEK の余白を空けておく
// 閉じたときも見出しが下のナビゲーションバーより上に出るよう、バーの分だけ高くする
export const SHEET_PEEK = `${80 + BOTTOM_NAV_SPACE}px`;
const SNAP_POINTS = [SHEET_PEEK, 0.45, 0.85];

type SnapPoint = (typeof SNAP_POINTS)[number];

type ExhibitionSheetProps = {
  floor: Floor;
  /** マップで強調している教室のID */
  selectedRoom: string | null;
  /** 出展をタップしたとき、その教室のID */
  onSelectRoom: (room: string) => void;
};

/** 表示中の階の出展一覧。マップの下からのぞかせ、引き上げると一覧が広がる */
export default function ExhibitionSheet({ floor, selectedRoom, onSelectRoom }: ExhibitionSheetProps) {
  const exhibitions = getExhibitionsOnFloor(floor);
  // どの階で開いた高さかも覚えておき、階を切り替えたら閉じた状態に戻す
  const [opened, setOpened] = useState<{ floor: Floor; snap: SnapPoint } | null>(null);
  const snap = opened?.floor === floor ? opened.snap : SHEET_PEEK;
  // 最初の表示では、Base UI がシートの高さを測るまで一瞬「全部開いた位置」になる。
  // そこから閉じた位置へ動くアニメーションが見えないよう、表示が落ち着くまでアニメーションを切っておく
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function select(exhibition: Exhibition) {
    const [room] = locationsOf(exhibition);
    if (!room) return;
    // TODO: 出展詳細モーダルができたら、ここで開く
    onSelectRoom(room);
    // 選んだ教室がマップで見えるよう、シートを下げる
    setOpened(null);
  }

  return (
    // 常に開いたまま。マップも操作できるよう modal にせず、外側のタップでも閉じない
    <Drawer
      open
      modal={false}
      disablePointerDismissal
      snapPoints={SNAP_POINTS}
      snapPoint={snap}
      onSnapPointChange={(next, details) => {
        // 勢いよく下にスワイプすると閉じようとする（null になる）ので、閉じずに一番下の段階に戻す
        if (next === null) details.cancel();
        setOpened(next === null ? null : { floor, snap: next });
      }}
      showSwipeHandle
    >
      {/* ページ（max-w-md）と同じ幅にそろえる
          --drawer-snap-point-offset（画面の下に隠れている高さ）は子要素に引き継がれないので、別の変数に移しておく */}
      <DrawerContent
        className={cn(
          "mx-auto max-w-md shadow-[0_-4px_16px_rgb(0_0_0/0.08)] [--sheet-hidden:var(--drawer-snap-point-offset)]",
          !ready && "transition-none",
        )}
      >
        <DrawerHeader className="flex-row items-baseline justify-between pt-3 pb-3 group-data-[swipe-axis=y]/drawer-popup:text-left">
          <DrawerTitle className="text-lg font-bold">{floor}階の出展</DrawerTitle>
          <span className="text-sm text-muted-foreground">{exhibitions.length}件</span>
        </DrawerHeader>
        {/* シートが途中の高さで止まっていても、一覧の最後まで見えるよう下に隠れている分とナビゲーションバーの分の余白を足す */}
        <ul className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(var(--sheet-hidden)+var(--bottom-nav-space)+1rem)]">
          {exhibitions.map((ex) => {
            const rooms = locationsOf(ex);
            const selected = selectedRoom !== null && rooms.includes(selectedRoom);
            return (
              <li key={ex.id} className="border-b last:border-b-0">
                {/* TODO: 共通の出展カードができたら置き換える */}
                <button
                  type="button"
                  onClick={() => select(ex)}
                  aria-current={selected || undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left",
                    selected && "bg-blue-50 dark:bg-blue-950",
                  )}
                >
                  <span className="shrink-0 rounded-md bg-blue-600 px-2 py-0.5 text-sm font-bold text-white">
                    {rooms.join("・") || "―"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{ex.exhibitionName}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {ex.genre.map((g) => (
                        <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {g}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
