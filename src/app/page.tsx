import { EventInfo } from "./components/EventInfo";
import FloorView from './components/floormap/FloorView';
export default function Home() {
  return (
    // 画面の高さに収める1画面レイアウト（マップは残りの高さに縮めて表示）
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col">
      <EventInfo />
      <FloorView />
      {/* 各階の出展情報（ボトムシート）の場所 */}
      <div className="flex h-[38dvh] shrink-0 items-center justify-center rounded-t-3xl border border-dashed text-sm text-muted-foreground">
        出店一覧
      </div>
    </div>
  );
}
