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
    <div
      className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function FloorMap({ floor }: { floor: Floor }) {
  return (
    <Suspense fallback={<div className="aspect-[354/834] w-full animate-pulse bg-muted" />}>
      <FloorSvg floor={floor} />
    </Suspense>
  );
}
