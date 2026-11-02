"use client";

import { Suspense, use } from "react";
import { loadFloor, type Floor } from "./floors";

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

function FloorSvg({ floor }: { floor: Floor }) {
  const svg = use(getFloorSvg(floor));
  return (
    // 親の枠いっぱいに広げ、縦横比を保ったまま全体が収まる大きさで中央に表示する
    <div
      className="size-full [&>svg]:block [&>svg]:size-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
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
