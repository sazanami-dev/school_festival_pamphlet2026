import ScanView from "./ScanView";

/** QRスキャナ（設計書 4.2）。読み取りと手入力はブラウザ側、スタンプの保存は Server Action で行う */
export default function ScanPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-4 pb-(--bottom-nav-space)">
      <h1 className="text-xl font-bold">QRを読む</h1>
      <ScanView />
    </div>
  );
}
