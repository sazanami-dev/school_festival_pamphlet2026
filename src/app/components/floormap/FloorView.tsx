"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExhibitionSheet, { SHEET_PEEK } from "./ExhibitionSheet";
import FloorMap, { FloorMapSkeleton } from "./FloorMap";
import { floors, type Floor } from "./floors";

const DEFAULT_FLOOR: Floor = 1;

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
  // 選んだ教室は URL の ?room= に保存する（共有・再読み込みしても同じ教室が強調される）
  // 階を切り替えると ?room= は消えるので、別の階の教室が強調されることはない
  const selectedRoom = searchParams.get("room");
  const floor = parseFloor(searchParams.get("floor") ?? floorOfRoom(selectedRoom));
  // 中央に拡大して表示する教室。?room= で開いたときと、出展一覧から選んだとき
  // （マップを直接タップしたときは、すでに見えているので動かさない）
  const [focus, setFocus] = useState(() => (selectedRoom ? { floor, room: selectedRoom } : null));

  // TODO: 詳細モーダルができたら、選んだときにモーダルを開く
  function selectRoom(room: string | null, { center = false } = {}) {
    const params = new URLSearchParams(searchParams.toString());
    // ?room= だけで開いていた場合も、選択を外したあと階が変わらないよう ?floor= を書いておく
    params.set("floor", String(floor));
    if (room) params.set("room", room);
    else params.delete("room");
    // 教室を選ぶたびに履歴が増えないよう、今の履歴を書き換える
    window.history.replaceState(null, "", `?${params}`);
    // 中央に表示しないときは前の指定も消す（後で同じ教室をタップしたとき、急に動かないように）
    setFocus(room && center ? { floor, room } : null);
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
    // 下から出ている出展一覧（ボトムシート）に階切替ボタンが隠れないよう、その分の余白を空ける
    <Tabs value={floor} onValueChange={changeFloor} className="min-h-0 flex-1 gap-0" style={{ paddingBottom: SHEET_PEEK }}>
      <FloorHeading floor={floor} />
      {/* 残りの高さをマップの枠にする。縦長のマップも全体が収まるよう縮小して表示する */}
      <div className="min-h-0 flex-1 px-4">
        {floors.map((f) => (
          <TabsContent key={f} value={f} className="size-full">
            <FloorMap
              floor={f}
              selectedRoom={selectedRoom}
              // 戻るボタンで別の教室を選んでいた頃に戻ったときなどは、古い指定で動かさない
              focusRoom={focus?.floor === f && focus.room === selectedRoom ? focus : null}
              onSelectRoom={(room) => selectRoom(room)}
            />
          </TabsContent>
        ))}
      </div>
      {/* tabs.tsx の高さ指定（group-data-horizontal/tabs:h-8）は同じ条件付きクラスでないと上書きできない */}
      <TabsList className="w-full justify-center gap-2 bg-transparent px-4 py-3 group-data-horizontal/tabs:h-auto">
        {floors.map((f) => (
          <TabsTrigger
            key={f}
            value={f}
            aria-label={`${f}階`}
            className={cn(
              "aspect-square h-auto max-w-11 flex-1 rounded-lg border-border bg-background text-base text-foreground shadow-none",
              "data-active:border-blue-500 data-active:bg-blue-500 data-active:text-white",
              "dark:data-active:border-blue-500 dark:data-active:bg-blue-500 dark:data-active:text-white",
            )}
          >
            {f}
          </TabsTrigger>
        ))}
      </TabsList>
      <ExhibitionSheet floor={floor} selectedRoom={selectedRoom} onSelectRoom={(room) => selectRoom(room, { center: true })} />
    </Tabs>
  );
}

//読み込み中に表示する枠
function FloorTabsSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ paddingBottom: SHEET_PEEK }}>
      <FloorHeading floor={DEFAULT_FLOOR} />
      <div className="min-h-0 flex-1 px-4">
        <FloorMapSkeleton />
      </div>
      <div className="flex justify-center gap-2 px-4 py-3">
        {floors.map((f) => (
          <div key={f} className="aspect-square max-w-11 flex-1 rounded-lg border bg-background" />
        ))}
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
