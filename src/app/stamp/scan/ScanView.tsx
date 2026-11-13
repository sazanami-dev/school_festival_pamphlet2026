"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QrScanner from "@/components/QrScanner";
import { Button, buttonVariants } from "@/components/ui/button";
import { collectStampAction, type ScanResult } from "../actions";
import Notice from "../components/Notice";

/**
 * QRの中身からトークンを取り出す。このサイトの /s/ で始まるQRだけを受け付ける
 * （上から貼られた別のQRで、不正なサイトへ連れて行かれないようにする。設計書 9.2）
 */
function tokenFromQr(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  const match = url.pathname.match(/^\/s\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

type Shown = ScanResult | { status: "foreign" };

export default function ScanView() {
  const router = useRouter();
  const [result, setResult] = useState<Shown | null>(null);
  const [manual, setManual] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(token: string) {
    startTransition(async () => {
      const next = await collectStampAction(token);
      if (next.status === "not_joined") {
        // まだ参加していない（Cookie が無い）ときは、参加か引き継ぎかを選ぶ画面へ
        router.push(`/stamp/join?cp=${encodeURIComponent(token)}`);
        return;
      }
      setResult(next);
      if (next.status === "new" || next.status === "already") setManual("");
    });
  }

  function handleDetect(text: string) {
    const token = tokenFromQr(text);
    if (token) submit(token);
    else setResult({ status: "foreign" });
  }

  return (
    <div className="space-y-4">
      <QrScanner onDetect={handleDetect} paused={pending || (result !== null && result.status !== "foreign")} />

      {pending && <p className="text-center text-sm text-muted-foreground">確認しています…</p>}
      {result && !pending && <ResultView result={result} onContinue={() => setResult(null)} />}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) submit(manual);
        }}
        className="space-y-2 rounded-xl border p-4"
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">コードを手入力</span>
          <span className="block text-xs text-muted-foreground">QRの下に書いてある8文字のコードを入力してください</span>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="XXXX-XXXX"
            className="h-12 w-full rounded-lg border bg-background px-3 font-mono text-lg tracking-widest uppercase outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <Button type="submit" size="lg" variant="outline" disabled={pending} className="h-12 w-full text-base">
          送信
        </Button>
      </form>

      <Link href="/stamp" className={buttonVariants({ variant: "ghost", size: "lg", className: "h-12 w-full text-base" })}>
        スタンプ一覧へ戻る
      </Link>
    </div>
  );
}

function ResultView({ result, onContinue }: { result: Shown; onContinue: () => void }) {
  switch (result.status) {
    case "new":
    case "already":
      return (
        <div className="space-y-3">
          {result.status === "new" ? (
            <Notice tone="success" title={`${result.checkpointName} のスタンプを獲得！`} />
          ) : (
            <Notice tone="info" title="獲得済みです">{result.checkpointName} のスタンプはもう持っています。</Notice>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="outline" onClick={onContinue} className="h-12 text-base">
              続けて読む
            </Button>
            <Link href="/stamp" className={buttonVariants({ size: "lg", className: "h-12 text-base" })}>
              一覧を見る
            </Link>
          </div>
        </div>
      );
    case "closed":
      return (
        <Notice tone="error" title={`受付時間外です（${result.hours}）`}>
          <ContinueLink onContinue={onContinue} />
        </Notice>
      );
    case "invalid":
      return (
        <Notice tone="error" title="無効なQRです">
          <ContinueLink onContinue={onContinue} />
        </Notice>
      );
    case "foreign":
      return <Notice tone="error" title="スタンプラリーのQRではありません" />;
    default:
      return null;
  }
}

function ContinueLink({ onContinue }: { onContinue: () => void }) {
  return (
    <button type="button" onClick={onContinue} className="font-bold underline underline-offset-2">
      もう一度読む
    </button>
  );
}
