"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FloorMap, { FloorMapSkeleton } from "./FloorMap";
import { floors, type Floor } from "./floors";

const DEFAULT_FLOOR: Floor = 1;

//floor=2 を階番号に変換する。無い・存在しない階なら 1F 
function parseFloor(value: string | null): Floor {
  const n = Number(value);
  return floors.find((f) => f === n) ?? DEFAULT_FLOOR;
}

//階の見出し
function FloorHeading({ floor }: { floor: Floor }) {
  return <h2 className="py-3 text-center text-2xl font-bold">{floor}階</h2>;
}

function FloorTabs() {
  const searchParams = useSearchParams();
  const floor = parseFloor(searchParams.get("floor"));
  // タップで選んだ教室。どの階の教室かも覚えておき、別の階を表示している間は強調しない
  // （TODO: 詳細モーダルができたら、選んだときにモーダルを開く）
  const [selected, setSelected] = useState<{ floor: Floor; room: string } | null>(null);
  const selectedRoom = selected?.floor === floor ? selected.room : null;

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
    <Tabs value={floor} onValueChange={changeFloor} className="min-h-0 flex-1 gap-0">
      <FloorHeading floor={floor} />
      {/* 残りの高さをマップの枠にする。縦長のマップも全体が収まるよう縮小して表示する */}
      <div className="min-h-0 flex-1 px-4">
        {floors.map((f) => (
          <TabsContent key={f} value={f} className="size-full">
            <FloorMap
              floor={f}
              selectedRoom={selectedRoom}
              onSelectRoom={(room) => setSelected(room ? { floor: f, room } : null)}
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
    </Tabs>
  );
}

//読み込み中に表示する枠
function FloorTabsSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
