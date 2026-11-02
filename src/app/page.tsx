import EventInfo from './components/EventInfo';
import FloorView from './components/floormap/FloorView';
export default function Home() {
  return (
    // 画面の高さに収める1画面レイアウト（マップは残りの高さに縮めて表示）
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col">
      <EventInfo />
      {/* 各階の出展一覧（ボトムシート）も FloorView の中にある */}
      <FloorView />
    </div>
  );
}
