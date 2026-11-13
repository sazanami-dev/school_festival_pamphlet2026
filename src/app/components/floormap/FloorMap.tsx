"use client";

import { Suspense, use, useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  TransformComponent,
  TransformWrapper,
  useControls,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { loadFloor, type Floor } from "./floors";
import { cn } from "@/lib/utils";
import { getFacilitiesOnFloor, getRoomsOnFloor, isOngoing, useNowInMinutes, type RoomInfo } from "./roomData";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
// ダブルタップ・＋／−ボタン1回で増減する倍率（1倍 → 2倍）
const ZOOM_STEP = 1;
// 枠いっぱいに広げる（ライブラリの既定は中身の大きさに合わせる fit-content）
const FILL = { width: "100%", height: "100%" };
// 教室を中央に表示するときの最大の倍率（小さい教室も拡大しすぎず、まわりが少し見える程度）
const FOCUS_MAX_SCALE = 2;
// 指を離すまでの移動がこれ未満ならタップ、以上ならドラッグとみなす（px）
const TAP_SLOP = 5;
// 等倍のとき、縦にこれ以上（px）動かして離したら、階を切り替えるスワイプとみなす
const SWIPE_DISTANCE = 60;
const ROOM_ID = /^T\d+$/;
const SVG_NS = "http://www.w3.org/2000/svg";

/*
 * 教室の色分け
 * SVG の <g id="T22"> に data-room-state を付け、その最初の子要素（教室の背景。<path> か <rect>）の色を変える
 *   content : 出展・イベントがある教室（タップできる）
 *   live    : イベント開催中の教室（色は content と同じ。「開催中」バッジは別に描く）
 *   empty   : 出展が無い教室（グレー・タップしても反応しない）
 *   facility: 案内のある設備（マックスマートなど。色は変えずにタップできるだけ）
 * ※ next.config.ts の設定で CSS Modules が使えないため、Tailwind の任意セレクタで書いている
 */
const ROOM_STYLES = cn(
  "[&_g[data-room-state=content]>:first-child]:fill-amber-200 [&_g[data-room-state=content]]:cursor-pointer",
  "[&_g[data-room-state=live]>:first-child]:fill-amber-200 [&_g[data-room-state=live]]:cursor-pointer",
  "[&_g[data-room-state=empty]>:first-child]:fill-gray-200",
  "[&_g[data-room-state=facility]]:cursor-pointer",
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

/**
 * マップの右下に重ねて縦に並べる＋／−／リセットボタン（片手操作・PC用）
 * 縦に3つ並べると約 116px 要る。画面がとても低い（イベントのお知らせが出ている Android など）と
 * 枠がそれより低くなりはみ出すので、枠の高さが 8rem 未満のときだけ横に並べる
 * （枠の高さはコンテナクエリで見る。枠に [container:floormap/size] を付けている）
 */
function ZoomControls({ hidden, onPress }: { hidden: boolean; onPress: () => void }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    // 指でマップを動かしている間や、ピンチで拡大している間は隠す（場所は空けたままにして、マップの大きさが変わらないようにする）
    <div
      inert={hidden}
      onPointerDown={onPress}
      className={cn(
        "absolute right-2 bottom-3 flex flex-col gap-1 transition-opacity duration-200",
        hidden && "opacity-0",
        "[@container_floormap_(height<8rem)]:bottom-2 [@container_floormap_(height<8rem)]:flex-row",
      )}
    >
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

/** 選んだ教室を青い太枠で囲む（角が欠けた区画もあるので、四角ではなく教室の背景の形をなぞる） */
function drawSelection(layer: SVGGElement, room: SVGGElement) {
  const shape = room.firstElementChild?.cloneNode() as SVGElement | undefined;
  if (!shape) return;
  shape.removeAttribute("id");
  shape.setAttribute("fill", "none");
  shape.setAttribute("stroke", "#2563eb");
  shape.setAttribute("stroke-width", "4");
  layer.append(shape);
}

/** 右上の件数バッジの中心。角が欠けた区画では、バッジが区画の中に入るまで下にずらす */
function badgeCenter(room: SVGGElement, box: DOMRect, radius: number) {
  const x = box.x + box.width - 15;
  const shape = room.firstElementChild as SVGGeometryElement;
  for (let y = box.y + 15; y < box.y + box.height; y += 4) {
    if (shape.isPointInFill(new DOMPoint(x, y - radius))) return { x, y };
  }
  return { x, y: box.y + 15 };
}

/** 教室の左上に「開催中」、右上に出展の件数のバッジを描く */
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
  if (info.exhibitions.length > 0) {
    const { x: cx, y: cy } = badgeCenter(room, box, 11);
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
  /** 中央に拡大して表示する教室。新しいオブジェクトを渡すたびに、その教室へ移動する */
  focusRoom: { room: string } | null;
  /** 出展・イベントのある教室か、案内のある設備がタップされたとき。それ以外をタップしたときは null */
  onSelectRoom: (room: string | null) => void;
  /** 等倍のマップを上下にスワイプしたとき。up は指を上に動かしたとき */
  onSwipe: (direction: "up" | "down") => void;
  /** マップ以外をどこまで隠すかが変わったとき */
  onHiddenChange: (hidden: HiddenUi) => void;
  /** 今どこまで隠しているか。all のときは＋／−ボタンも隠す */
  hidden: HiddenUi;
};

/**
 * マップを見やすくするため、まわりのボタンやシートをどこまで隠すか
 *   all    : マップ以外をすべて隠す（指でマップを動かしている間と、ピンチ・ダブルタップで拡大している間）
 *   others : ＋／−ボタンだけ残す（＋／−ボタンを押している間と、＋／−ボタンや「マップで場所を見る」で拡大している間）
 *   null   : 何も隠さない（等倍で、指も触れていない。マップをタップしただけのときも隠さない）
 */
export type HiddenUi = "all" | "others" | null;

function FloorSvg({
  floor,
  selectedRoom,
  focusRoom,
  onSelectRoom,
  onSwipe,
  onHiddenChange,
  hidden,
}: FloorMapProps) {
  const svg = use(getFloorSvg(floor));
  const rooms = getRoomsOnFloor(floor);
  const facilities = getFacilitiesOnFloor(floor);
  const now = useNowInMinutes();
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const tapStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  // 指（マウス）が今触れている場所。マップは実際に動いたら movedMap にする（タップだけでは隠さない）
  const pressed = useRef<"map" | "movedMap" | "buttons" | null>(null);
  // 最後に拡大を始めたのが指（ピンチ・ダブルタップ・ホイール）か＋／−ボタンか
  const zoomSource = useRef<"gesture" | "buttons">("buttons");
  // 等倍より大きいか
  const zoomed = useRef(false);
  const reportedHidden = useRef<HiddenUi>(null);
  // 最後に見たマップの位置と拡大率。実際に動いたかを比べる
  const lastTransform = useRef({ scale: MIN_SCALE, positionX: 0, positionY: 0 });

  /** 触れている場所と拡大のしかたから、どこまで隠すかを決めて、変わったときだけ親に知らせる */
  function updateHidden() {
    const touch = pressed.current;
    let next: HiddenUi = null;
    if (touch === "movedMap" || (zoomed.current && zoomSource.current === "gesture")) next = "all";
    else if (touch === "buttons" || zoomed.current) next = "others";
    if (next === reportedHidden.current) return;
    reportedHidden.current = next;
    onHiddenChange(next);
  }

  function press(target: "map" | "buttons") {
    pressed.current = target;
    if (target === "buttons") zoomSource.current = "buttons";
    // ＋／−ボタンは押した時点で隠す。マップはタップかもしれないので、動き出すまで待つ
    updateHidden();
  }

  // 指を離したら、触れている間だけの分を元に戻す（拡大している間は隠したまま）
  // マップの外で離すこともあるので window で見る。
  // タッチは途中で pointercancel が来ることがあるので、残っている指の数（touches）で判断する
  const release = useEffectEvent(() => {
    pressed.current = null;
    updateHidden();
  });
  useEffect(() => {
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) release();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse") release();
    };
    window.addEventListener("touchend", onTouchEnd, true);
    window.addEventListener("touchcancel", onTouchEnd, true);
    window.addEventListener("pointerup", onPointerUp, true);
    return () => {
      window.removeEventListener("touchend", onTouchEnd, true);
      window.removeEventListener("touchcancel", onTouchEnd, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
  }, []);

  /** ピンチが始まったら（2本目の指が触れたら）、まだ動いていなくてもすべて隠す */
  function handlePinchStart() {
    zoomSource.current = "gesture";
    pressed.current = "movedMap";
    updateHidden();
  }

  /** 拡大縮小が始まったとき。ボタンや zoomToElement はライブラリが作った偽のイベント（isTrusted が false）で呼ぶ */
  function handleZoomStart(_ref: ReactZoomPanPinchRef, event: Event) {
    zoomSource.current = event.isTrusted ? "gesture" : "buttons";
  }

  /** 位置か拡大率が変わるたびに呼ばれる。マップに触れたまま実際に動いたときと、拡大しているときは隠す */
  function handleTransform(_ref: ReactZoomPanPinchRef, state: { scale: number; positionX: number; positionY: number }) {
    const last = lastTransform.current;
    const moved =
      Math.abs(state.scale - last.scale) > 0.001 ||
      Math.abs(state.positionX - last.positionX) > 0.5 ||
      Math.abs(state.positionY - last.positionY) > 0.5;
    lastTransform.current = { scale: state.scale, positionX: state.positionX, positionY: state.positionY };
    if (moved && pressed.current === "map") pressed.current = "movedMap";
    zoomed.current = state.scale > MIN_SCALE + 0.01;
    // 等倍に戻ったら、次の拡大（「マップで場所を見る」など）はボタン扱いから始める
    if (!zoomed.current) zoomSource.current = "buttons";
    updateHidden();
  }

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
      } else if (facilities.has(g.id)) {
        g.dataset.roomState = "facility";
        if (g.id === selectedRoom) drawSelection(overlay, g);
      } else if (ROOM_ID.test(g.id)) {
        g.dataset.roomState = "empty";
      }
    }
    // 枠とバッジは教室より手前に表示したいので最後に追加する
    root.append(overlay);
  }, [rooms, facilities, now, selectedRoom]);

  // 指定された教室が枠の中央に来るよう拡大・移動する（教室が枠に収まる倍率。ただし FOCUS_MAX_SCALE まで）
  useEffect(() => {
    if (!focusRoom) return;
    // 表示した直後は枠の大きさが決まっていないことがあるので、次の描画まで待つ
    // （型は HTML 要素しか受け付けないが、ID で渡せば SVG の <g id="T22"> も対象にできる。無い ID なら何もしない）
    const id = requestAnimationFrame(() => {
      // 指で拡大したあとでも、この移動はボタンでの拡大として扱う（＋／−ボタンを残す）
      zoomSource.current = "buttons";
      transformRef.current?.zoomToElement(focusRoom.room, { maxScale: FOCUS_MAX_SCALE });
    });
    return () => cancelAnimationFrame(id);
  }, [focusRoom]);

  function handlePointerDown(e: React.PointerEvent) {
    // 2本目の指（ピンチ）が触れたら、タップでもスワイプでもない
    tapStart.current = e.isPrimary ? { pointerId: e.pointerId, x: e.clientX, y: e.clientY } : null;
  }

  function handlePointerUp(e: React.PointerEvent) {
    const start = tapStart.current;
    tapStart.current = null;
    if (!start || start.pointerId !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) >= TAP_SLOP) {
      // 等倍のマップは枠に収まっていて動かないので、上下のドラッグを階の切り替えに使う
      // （拡大中のドラッグはマップの移動。斜めや横の動きは切り替えない）
      const scale = transformRef.current?.instance.state.scale ?? MIN_SCALE;
      if (scale <= MIN_SCALE && Math.abs(dy) >= SWIPE_DISTANCE && Math.abs(dy) > Math.abs(dx) * 2) {
        onSwipe(dy < 0 ? "up" : "down");
      }
      // ドラッグでマップを動かした後に指を離したときは、教室を選ばない
      return;
    }
    const room = (e.target as Element).closest<SVGGElement>(
      'g[data-room-state="content"], g[data-room-state="live"], g[data-room-state="facility"]',
    );
    // 教室を選ぶとモーダルが開く。Android の Chrome は指を離したあとに同じ場所へ click を送るので、
    // そのままだと開いたばかりのモーダルの中（一覧の1件目など）を押したことになってしまう
    if (room) swallowNextClick();
    onSelectRoom(room?.id ?? null);
  }

  return (
    // ピンチ・ダブルタップ・ドラッグで拡大縮小と移動ができる
    // 階ごとに別のインスタンスになるので、階を切り替えると拡大率と位置はリセットされる
    <TransformWrapper
      ref={transformRef}
      minScale={MIN_SCALE}
      maxScale={MAX_SCALE}
      doubleClick={{ step: ZOOM_STEP }}
      onPinchStart={handlePinchStart}
      onZoomStart={handleZoomStart}
      onTransform={handleTransform}
    >
      {/* マップの枠は画面の端まで広げ、階ボタンと拡大縮小ボタンはマップに重ねる。
          拡大したときはボタンの下までマップが広がって見える */}
      <div className="relative size-full [container:floormap/size]">
        <div className="size-full" onPointerDownCapture={() => press("map")}>
          <TransformComponent wrapperStyle={FILL} contentStyle={FILL}>
            {/* 枠いっぱいに広げ、縦横比を保ったまま全体が収まる大きさで中央に表示する */}
            <div
              ref={containerRef}
              // touch-none: ブラウザのスクロールや引っ張って更新を止め、指の動きをすべてマップで扱う
              // 等倍のときはボタンに重ならないよう、左は階ボタン（left-2 + w-12）、右は拡大縮小ボタン（right-2 + size-9）の幅だけ空ける。
              // 余白も一緒に拡大されるので、拡大するとマップがボタンの下まで広がる
              // （ボタンを横に並べる低い枠では、右のボタンはマップの下に重なるので右を空けない）
              className={cn(
                "size-full touch-none py-3 pr-13 pl-16 [@container_floormap_(height<8rem)]:pr-2 [&>svg]:block [&>svg]:size-full",
                ROOM_STYLES,
              )}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => (tapStart.current = null)}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </TransformComponent>
        </div>
        <ZoomControls hidden={hidden === "all"} onPress={() => press("buttons")} />
      </div>
    </TransformWrapper>
  );
}

/** タップの直後に届く click を1回だけ捨てる（click が来ない端末もあるので、少し待っても来なければやめる） */
function swallowNextClick() {
  const swallow = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 500);
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
