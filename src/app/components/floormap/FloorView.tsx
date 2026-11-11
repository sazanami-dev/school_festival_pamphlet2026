"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { floorButtonClass } from "@/components/floorButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExhibitionDetailModal from "@/components/ExhibitionDetailModal";
import ExhibitionSheet, { SHEET_PEEK } from "./ExhibitionSheet";
import FloorMap, { FloorMapSkeleton } from "./FloorMap";
import { floors, type Floor } from "./floors";
import RoomDetailModal from "./RoomDetailModal";
import { getRoomsOnFloor, locationsOf, type Exhibition, type RoomInfo } from "./roomData";

const DEFAULT_FLOOR: Floor = 1;
// 階切替ボタンの並び（上から 8 → 1）
const floorsTopDown = [...floors].reverse();

//floor=2 を階番号に変換する。無い・存在しない階なら 1F 
function parseFloor(value: string | null): Floor {
  const n = Number(value);
  return floors.find((f) => f === n) ?? DEFAULT_FLOOR;
}

// ?floor= が無く ?room=T22 だけで開いたときは、教室ID（T22・f2-toilet-men-1）の最初の数字を階とみなす
function floorOfRoom(room: string | null) {
  return room?.match(/^[Tf](\d)/)?.[1] ?? null;
}

//階の見出し
function FloorHeading({ floor }: { floor: Floor }) {
  return <h2 className="py-3 text-center text-2xl font-bold">{floor}階</h2>;
}

function FloorTabs() {
  const searchParams = useSearchParams();
  // ?room=T22 は「開いたときに強調して中央に表示する教室」の指定（出展一覧ページの「マップで場所を見る」など）
  const linkedRoom = searchParams.get("room");
  const floor = parseFloor(searchParams.get("floor") ?? floorOfRoom(linkedRoom));

  // 選んだ教室。階を切り替えたら消す（戻ってきたときに、前の教室へ移動しないように）
  // center: 中央に拡大して表示するか。?room= で開いたときと出展一覧から選んだときだけ
  // （マップを直接タップしたときは、すでに見えているので動かさない）
  type Selection = { room: string; center: boolean };
  const [selected, setSelected] = useState<Selection | null>(null);

  // 開いているモーダル。出展が複数ある教室やイベントの教室は、先に一覧（listedRoom）を出す
  // 一覧から出展を選んだときは listedRoom を残し、詳細を閉じると一覧に戻る
  const [listedRoom, setListedRoom] = useState<{ name: string; info: RoomInfo } | null>(null);
  const [detail, setDetail] = useState<Exhibition | null>(null);

  // 階が変わったら、新しい階のマップをスライドさせて入れる。上の階は上から、下の階は下から入る
  // （ボタン・スワイプ・戻るボタンのどれで変わっても同じ。最初に開いたときは動かさない）
  const [shown, setShown] = useState<{ floor: Floor; enterFrom: "top" | "bottom" | null }>({
    floor,
    enterFrom: null,
  });
  if (shown.floor !== floor) {
    setShown({ floor, enterFrom: floor > shown.floor ? "top" : "bottom" });
    setSelected(null);
    setListedRoom(null);
    setDetail(null);
  }

  // ?room= が新しく指定されたら（最初に開いたときも含む）、その教室を選ぶ
  // URL の変化に合わせて state を直す、React の「描画中に state を調整する」書き方
  // 階の変更と同時のときは、この指定を残すため、選択を消す処理より後に書く
  const [prevLinkedRoom, setPrevLinkedRoom] = useState<string | null>(null);
  if (linkedRoom !== prevLinkedRoom) {
    setPrevLinkedRoom(linkedRoom);
    if (linkedRoom) setSelected({ room: linkedRoom, center: true });
  }

  const selectedRoom = selected?.room ?? null;

  function selectRoom(room: string | null, { center = false } = {}) {
    // 毎回新しいオブジェクトにするので、同じ教室をもう一度選んでも中央に戻る
    setSelected(room ? { room, center } : null);
    // ?room= は開いたときだけの指定なので、自分で選び直したら URL から消す
    // （残しておくと、再読み込みしたときに前の教室へ移動してしまう）
    if (linkedRoom) {
      const params = new URLSearchParams(searchParams.toString());
      // ?room= だけで開いていた場合も、階が変わらないよう ?floor= を書いておく
      params.set("floor", String(floor));
      params.delete("room");
      // 履歴は増やさず、今の履歴を書き換える
      window.history.replaceState(null, "", `?${params}`);
    }
  }

  /** マップの教室をタップしたとき。出展が1件だけならその詳細を、それ以外は教室の一覧を開く */
  function tapRoom(room: string | null) {
    selectRoom(room);
    const info = room ? getRoomsOnFloor(floor).get(room) : undefined;
    if (!room || !info) return;
    if (info.exhibitions.length === 1 && info.events.length === 0) {
      setDetail(info.exhibitions[0]);
    } else {
      setListedRoom({ name: info.exhibitions[0]?.locationName ?? room, info });
    }
  }

  /** 出展一覧の項目をタップしたとき。教室を中央に表示して、詳細を開く */
  function tapExhibition(exhibition: Exhibition) {
    const [room] = locationsOf(exhibition);
    if (room) selectRoom(room, { center: true });
    setListedRoom(null);
    setDetail(exhibition);
  }

  // 指を下に動かすと上の階へ、上に動かすと下の階へ。一番上・一番下の階では何もしない
  function swipeFloor(direction: "up" | "down") {
    const next = floor + (direction === "down" ? 1 : -1);
    if (floors.some((f) => f === next)) changeFloor(next);
  }

  function changeFloor(value: unknown) {
    const next = parseFloor(String(value));
    if (next === floor) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("floor", String(next));
    // ?room= の強調は元の階の教室なので外す
    params.delete("room");
    // サーバーには問い合わせず URL だけ変える（戻るボタンで前の階に戻れる）
    window.history.pushState(null, "", `?${params}`);
  }

  return (
    // 縦向きのタブにすると上下の矢印キーで階を移動できる（向きの指定で横並びになるので flex-col で縦積みに戻す）
    // 下から出ている出展一覧（ボトムシート）にマップが隠れないよう、その分の余白を空ける
    <Tabs
      value={floor}
      onValueChange={changeFloor}
      orientation="vertical"
      className="min-h-0 flex-1 flex-col gap-0"
      style={{ paddingBottom: SHEET_PEEK }}
    >
      <FloorHeading floor={floor} />
      <div className="flex min-h-0 flex-1 gap-2 px-4 pb-3">
        {/* 階切替ボタンはマップの左に縦に並べる。エレベーターのように上の階ほど上 */}
        <TabsList className="w-10 shrink-0 gap-1.5 self-center bg-transparent p-0">
          {floorsTopDown.map((f) => (
            <TabsTrigger
              key={f}
              value={f}
              aria-label={`${f}階`}
              className={cn(
                floorButtonClass,
                // tabs.tsx の縦向き用の指定（group-data-vertical/tabs:justify-start）は同じ条件付きクラスでないと上書きできない
                "shadow-none group-data-vertical/tabs:justify-center",
              )}
            >
              {f}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* 残りの幅と高さをマップの枠にする。縦長のマップも全体が収まるよう縮小して表示する
            階を切り替えるときにスライドしてくるマップが、見出しやボトムシートにはみ出さないよう切り取る */}
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {floors.map((f) => (
            <TabsContent
              key={f}
              value={f}
              className={cn(
                "size-full",
                shown.enterFrom && "animate-in duration-200 fade-in-0 motion-reduce:animate-none",
                shown.enterFrom === "bottom" && "slide-in-from-bottom-16",
                shown.enterFrom === "top" && "slide-in-from-top-16",
              )}
            >
              <FloorMap
                floor={f}
                selectedRoom={selectedRoom}
                focusRoom={selected?.center ? selected : null}
                onSelectRoom={tapRoom}
                onSwipe={swipeFloor}
              />
            </TabsContent>
          ))}
        </div>
      </div>
      <ExhibitionSheet floor={floor} selectedRoom={selectedRoom} onSelectExhibition={tapExhibition} />
      <RoomDetailModal
        room={detail ? null : listedRoom}
        onClose={() => setListedRoom(null)}
        onSelectExhibition={setDetail}
      />
      <ExhibitionDetailModal exhibition={detail} onClose={() => setDetail(null)} showMapLink={false} />
    </Tabs>
  );
}

//読み込み中に表示する枠
function FloorTabsSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ paddingBottom: SHEET_PEEK }}>
      <FloorHeading floor={DEFAULT_FLOOR} />
      <div className="flex min-h-0 flex-1 gap-2 px-4 pb-3">
        <div className="flex w-10 shrink-0 flex-col gap-1.5 self-center">
          {floorsTopDown.map((f) => (
            <div key={f} className="size-10 rounded-lg border bg-background" />
          ))}
        </div>
        <div className="min-h-0 min-w-0 flex-1">
          <FloorMapSkeleton />
        </div>
      </div>
    </div>
  );
}

/** 階の見出し + フロアマップ + 階切替ボタン。選択中の階は URL の ?floor= に保存する */
export default function FloorView() {
  // useSearchParams を使う部分は Suspense で囲む（無いと本番ビルドが失敗する）
  return (
    <Suspense fallback={<FloorTabsSkeleton />}>
      <FloorTabs />
    </Suspense>
  );
}
