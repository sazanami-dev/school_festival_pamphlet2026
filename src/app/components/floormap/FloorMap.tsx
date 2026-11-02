"use client";

import { Suspense, use, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { loadFloor, type Floor } from "./floors";
import { cn } from "@/lib/utils";
import { getRoomsOnFloor, isOngoing, nowInMinutes, type RoomInfo } from "./roomData";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
// ダブルタップ・＋／−ボタン1回で増減する倍率（1倍 → 2倍）
const ZOOM_STEP = 1;
// 枠いっぱいに広げる（ライブラリの既定は中身の大きさに合わせる fit-content）
const FILL = { width: "100%", height: "100%" };
// 指を離すまでの移動がこれ未満ならタップ、以上ならドラッグとみなす（px）
const TAP_SLOP = 5;
const ROOM_ID = /^T\d+$/;
const SVG_NS = "http://www.w3.org/2000/svg";

/*
 * 教室の色分け
 * SVG の <g id="T22"> に data-room-state を付け、その最初の子要素（教室の背景。<path> か <rect>）の色を変える
 *   content : 出展・イベントがある教室（タップできる）
 *   live    : イベント開催中の教室（色は content と同じ。「開催中」バッジは別に描く）
 *   empty   : 出展が無い教室（グレー・タップしても反応しない）
 * ※ next.config.ts の設定で CSS Modules が使えないため、Tailwind の任意セレクタで書いている
 */
const ROOM_STYLES = cn(
  "[&_g[data-room-state=content]>:first-child]:fill-amber-200 [&_g[data-room-state=content]]:cursor-pointer",
  "[&_g[data-room-state=live]>:first-child]:fill-amber-200 [&_g[data-room-state=live]]:cursor-pointer",
  "[&_g[data-room-state=empty]>:first-child]:fill-gray-200",
);

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

/** 30秒ごとに今の時刻（0時からの分）を返す。サーバーでの描画中は null */
function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

function useNowInMinutes() {
  return useSyncExternalStore(subscribeClock, nowInMinutes, () => null);
}

function svgElement(tag: string, attrs: Record<string, string | number>, text?: string) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text) el.textContent = text;
  return el;
}

/** 教室の背景（最初の子要素）の位置と大きさ */
function roomBox(room: SVGGElement) {
  return room.querySelector<SVGGraphicsElement>(":scope > :first-child")?.getBBox() ?? null;
}

/** 選んだ教室を青い太枠で囲む（設備には枠線が無いものもあるので、元の線ではなく新しく描く） */
function drawSelection(layer: SVGGElement, room: SVGGElement) {
  const box = roomBox(room);
  if (!box) return;
  layer.append(
    svgElement("rect", { x: box.x, y: box.y, width: box.width, height: box.height, fill: "none", stroke: "#2563eb", "stroke-width": 4 }),
  );
}

/** 教室の左上に「開催中」、右上に出展の件数（2件以上のとき）のバッジを描く */
function drawBadges(layer: SVGGElement, room: SVGGElement, info: RoomInfo, live: boolean) {
  const box = roomBox(room);
  if (!box) return;
  const label = { fill: "#fff", "font-weight": 700, "text-anchor": "middle", "dominant-baseline": "central" };
  // 等倍表示（スマホで約0.5倍に縮小される）でも見えるよう、SVG の座標で大きめに描く
  if (live) {
    layer.append(
      svgElement("rect", { x: box.x + 4, y: box.y + 4, width: 52, height: 22, rx: 11, fill: "#dc2626" }),
      svgElement("text", { ...label, x: box.x + 30, y: box.y + 15, "font-size": 13 }, "開催中"),
    );
  }
  if (info.exhibitions.length > 1) {
    const cx = box.x + box.width - 15;
    const cy = box.y + 15;
    layer.append(
      svgElement("circle", { cx, cy, r: 11, fill: "#2563eb" }),
      svgElement("text", { ...label, x: cx, y: cy, "font-size": 14 }, String(info.exhibitions.length)),
    );
  }
}

type FloorMapProps = {
  floor: Floor;
  /** 強調表示する教室のID（例: "T22"） */
  selectedRoom: string | null;
  /** 出展・イベントのある教室がタップされたとき。教室以外をタップしたときは null */
  onSelectRoom: (room: string | null) => void;
};

function FloorSvg({ floor, selectedRoom, onSelectRoom }: FloorMapProps) {
  const svg = use(getFloorSvg(floor));
  const rooms = getRoomsOnFloor(floor);
  const now = useNowInMinutes();
  const containerRef = useRef<HTMLDivElement>(null);
  const tapStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  // SVG は文字列で埋め込んでいるので、教室の色分け・バッジ・強調は DOM を直接書き換える
  useLayoutEffect(() => {
    const root = containerRef.current?.querySelector("svg");
    if (!root) return;
    root.querySelector(":scope > g[data-overlay]")?.remove();
    const overlay = svgElement("g", { "data-overlay": "", "pointer-events": "none" }) as SVGGElement;

    for (const g of root.querySelectorAll<SVGGElement>("g[id]")) {
      const info = rooms.get(g.id);
      if (info) {
        const live = now !== null && info.events.some((ev) => isOngoing(ev, now));
        g.dataset.roomState = live ? "live" : "content";
        if (g.id === selectedRoom) drawSelection(overlay, g);
        drawBadges(overlay, g, info, live);
      } else if (ROOM_ID.test(g.id)) {
        g.dataset.roomState = "empty";
      }
    }
    // 枠とバッジは教室より手前に表示したいので最後に追加する
    root.append(overlay);
  }, [rooms, now, selectedRoom]);

  function handlePointerDown(e: React.PointerEvent) {
    // 2本目の指（ピンチ）が触れたらタップではない
    tapStart.current = e.isPrimary ? { pointerId: e.pointerId, x: e.clientX, y: e.clientY } : null;
  }

  function handlePointerUp(e: React.PointerEvent) {
    const start = tapStart.current;
    tapStart.current = null;
    if (!start || start.pointerId !== e.pointerId) return;
    // ドラッグでマップを動かした後に指を離したときは、教室を選ばない
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) >= TAP_SLOP) return;
    const room = (e.target as Element).closest<SVGGElement>(
      'g[data-room-state="content"], g[data-room-state="live"]',
    );
    onSelectRoom(room?.id ?? null);
  }

  return (
    // ピンチ・ダブルタップ・ドラッグで拡大縮小と移動ができる
    // 階ごとに別のインスタンスになるので、階を切り替えると拡大率と位置はリセットされる
    <TransformWrapper minScale={MIN_SCALE} maxScale={MAX_SCALE} doubleClick={{ step: ZOOM_STEP }}>
      <div className="relative size-full">
        <TransformComponent wrapperStyle={FILL} contentStyle={FILL}>
          {/* 枠いっぱいに広げ、縦横比を保ったまま全体が収まる大きさで中央に表示する */}
          <div
            ref={containerRef}
            className={cn("size-full [&>svg]:block [&>svg]:size-full", ROOM_STYLES)}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => (tapStart.current = null)}
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

export default function FloorMap(props: FloorMapProps) {
  return (
    <Suspense fallback={<FloorMapSkeleton />}>
      <FloorSvg {...props} />
    </Suspense>
  );
}
