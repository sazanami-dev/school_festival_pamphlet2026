"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { cn } from "@/lib/utils";

/**
 * カメラでQRコードを読む部品（スタンプの読み取り・交換所のスタッフ画面で共通）
 *
 * iOS Safari は BarcodeDetector に対応していないので、映像を canvas に描いて jsQR で読む。
 * カメラは HTTPS（または localhost）でしか使えない。
 */

type Props = {
  /** 読めたときに呼ばれる。同じQRは数秒あけないと続けて呼ばれない */
  onDetect: (text: string) => void;
  /** true の間は読み取りを止める（結果を表示している間など） */
  paused?: boolean;
  /** カメラが使えないときに続けて出す案内 */
  fallbackHint?: string;
  className?: string;
};

/** 読み取りの間隔（毎フレームだと古いスマホで重いので間引く） */
const SCAN_INTERVAL_MS = 150;
/** 同じQRをもう一度通知するまでの時間 */
const SAME_CODE_INTERVAL_MS = 3000;
/** 解析する画像の幅（大きいほど遠くから読めるが重くなる） */
const MAX_SCAN_WIDTH = 640;

type CameraError = "denied" | "unavailable";

export default function QrScanner({
  onDetect,
  paused = false,
  fallbackHint = "下の欄にコードを入力してください。",
  className,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<CameraError | null>(null);

  // カメラを付け直さずに最新の値を使えるよう、ref に入れておく
  const onDetectRef = useRef(onDetect);
  const pausedRef = useRef(paused);
  useEffect(() => {
    onDetectRef.current = onDetect;
    pausedRef.current = paused;
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let lastScanAt = 0;
    let lastCode = { text: "", at: 0 };
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    function scan(now: number) {
      if (stopped) return;
      frame = requestAnimationFrame(scan);
      if (pausedRef.current || now - lastScanAt < SCAN_INTERVAL_MS) return;
      if (!video || !context || video.readyState < video.HAVE_ENOUGH_DATA) return;
      lastScanAt = now;

      const scale = Math.min(1, MAX_SCAN_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
      if (!code?.data) return;

      if (code.data === lastCode.text && now - lastCode.at < SAME_CODE_INTERVAL_MS) return;
      lastCode = { text: code.data, at: now };
      onDetectRef.current(code.data);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch (e) {
        setError(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "unavailable");
        return;
      }
      // 待っている間に画面を離れていたら、すぐ止める
      if (stopped || !video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
      frame = requestAnimationFrame(scan);
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-2xl bg-black", className)}>
      {/* playsInline が無いと iPhone で全画面再生になる */}
      <video ref={videoRef} playsInline muted className="size-full object-cover" />
      {error ? (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm leading-relaxed text-white">
          {error === "denied" ? "カメラの使用が許可されていません。ブラウザの設定で許可するか、" : "カメラを使えません。"}
          {fallbackHint}
        </p>
      ) : (
        // 読み取り位置の目安の枠
        <div aria-hidden className="pointer-events-none absolute inset-[15%] rounded-xl border-4 border-white/80" />
      )}
    </div>
  );
}
