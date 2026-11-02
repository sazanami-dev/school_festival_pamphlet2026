"use client";

import { Suspense, use } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { loadFloor, type Floor } from "./floors";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
// ダブルタップ・＋／−ボタン1回で増減する倍率（1倍 → 2倍）
const ZOOM_STEP = 1;
// 枠いっぱいに広げる（ライブラリの既定は中身の大きさに合わせる fit-content）
const FILL = { width: "100%", height: "100%" };

// 同じ階を何度表示しても読み込みは1回だけにする
const svgCache = new Map<Floor, Promise<string>>();

function getFloorSvg(floor: Floor) {
  let promise = svgCache.get(floor);
  if (!promise) {
    promise = loadFloor[floor]().then((m) => m.svg);
    svgCache.set(floor, promise);
  }
  return promise;
}

/** 右下の＋／−／リセットボタン（片手操作・PC用） */
function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute right-2 bottom-2 flex flex-col gap-1">
      <Button variant="outline" size="icon-lg" aria-label="拡大" onClick={() => zoomIn(ZOOM_STEP)}>
        <Plus />
      </Button>
      <Button variant="outline" size="icon-lg" aria-label="縮小" onClick={() => zoomOut(ZOOM_STEP)}>
        <Minus />
      </Button>
      <Button variant="outline" size="icon-lg" aria-label="元の大きさに戻す" onClick={() => resetTransform()}>
        <RotateCcw />
      </Button>
    </div>
  );
}

function FloorSvg({ floor }: { floor: Floor }) {
  const svg = use(getFloorSvg(floor));
  return (
    // ピンチ・ダブルタップ・ドラッグで拡大縮小と移動ができる
    // 階ごとに別のインスタンスになるので、階を切り替えると拡大率と位置はリセットされる
    <TransformWrapper minScale={MIN_SCALE} maxScale={MAX_SCALE} doubleClick={{ step: ZOOM_STEP }}>
      <div className="relative size-full">
        <TransformComponent wrapperStyle={FILL} contentStyle={FILL}>
          {/* 枠いっぱいに広げ、縦横比を保ったまま全体が収まる大きさで中央に表示する */}
          <div
            className="size-full [&>svg]:block [&>svg]:size-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </TransformComponent>
        <ZoomControls />
      </div>
    </TransformWrapper>
  );
}

/** 読み込み中に表示する、マップの枠と同じ大きさのプレースホルダー */
export function FloorMapSkeleton() {
  return <div className="size-full animate-pulse rounded-lg bg-muted" />;
}

export default function FloorMap({ floor }: { floor: Floor }) {
  return (
    <Suspense fallback={<FloorMapSkeleton />}>
      <FloorSvg floor={floor} />
    </Suspense>
  );
}
