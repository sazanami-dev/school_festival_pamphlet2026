"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_SPACE } from "@/components/BottomNav";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import ExhibitionCard from "@/components/ExhibitionCard";
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
  /** 出展をタップしたとき */
  onSelectExhibition: (exhibition: Exhibition) => void;
  /** この値が変わるたびに、シートを一番下（見出しだけ）まで下げる */
  collapseRequest: number;
  /** マップを操作・拡大している間 true。マップを広く見せるため、シートを透明にして触れなくする */
  hidden: boolean;
};

/** 表示中の階の出展一覧。マップの下からのぞかせ、引き上げると一覧が広がる */
export default function ExhibitionSheet({
  floor,
  selectedRoom,
  onSelectExhibition,
  collapseRequest,
  hidden,
}: ExhibitionSheetProps) {
  const exhibitions = getExhibitionsOnFloor(floor);
  // どの階で開いた高さかも覚えておき、階を切り替えたら閉じた状態に戻す
  const [opened, setOpened] = useState<{ floor: Floor; snap: SnapPoint } | null>(null);
  // 下げる指示が来たら閉じた状態に戻す（React の「描画中に state を調整する」書き方）
  const [prevCollapse, setPrevCollapse] = useState(collapseRequest);
  if (collapseRequest !== prevCollapse) {
    setPrevCollapse(collapseRequest);
    setOpened(null);
  }
  const snap = opened?.floor === floor ? opened.snap : SHEET_PEEK;
  // 最初の表示では、Base UI がシートの高さを測るまで一瞬「全部開いた位置」になる。
  // そこから閉じた位置へ動くアニメーションが見えないよう、表示が落ち着くまでアニメーションを切っておく
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
        inert={hidden}
        className={cn(
          "mx-auto max-w-md shadow-[0_-4px_16px_rgb(0_0_0/0.08)] [--sheet-hidden:var(--drawer-snap-point-offset)]",
          !ready && "transition-none",
          // シートは元から opacity にもアニメーションがかかる
          hidden && "pointer-events-none opacity-0",
        )}
      >
        <DrawerHeader className="flex-row items-baseline justify-between pt-3 pb-3 group-data-[swipe-axis=y]/drawer-popup:text-left">
          <DrawerTitle className="text-lg font-bold">{floor}階の出展</DrawerTitle>
          <span className="text-sm text-muted-foreground">{exhibitions.length}件</span>
        </DrawerHeader>
        {/* シートが途中の高さで止まっていても、一覧の最後まで見えるよう下に隠れている分とナビゲーションバーの分の余白を足す */}
        {/* 閉じている（見出しだけの）間は一覧をスクロールさせない。指で動かすとシートが引き上がる */}
        <ul
          className={cn(
            "min-h-0 flex-1 px-4 pb-[calc(var(--sheet-hidden)+var(--bottom-nav-space)+1rem)]",
            snap === SHEET_PEEK ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {exhibitions.map((ex) => {
            const selected = selectedRoom !== null && locationsOf(ex).includes(selectedRoom);
            return (
              <li key={ex.id} className="border-b last:border-b-0">
                <ExhibitionCard exhibition={ex} onSelect={onSelectExhibition} selected={selected} />
              </li>
            );
          })}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
