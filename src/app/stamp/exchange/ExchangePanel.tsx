"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { checkRedeemedAction, issueExchangeTokenAction } from "../actions";
import Notice from "../components/Notice";

/** 交換済みになったかを確かめる間隔 */
const POLL_INTERVAL_MS = 3000;

type Issued = { svg: string; expiresAt: number };

/**
 * 「交換する」→ 交換用QR（有効期限5分の署名トークン）を表示する
 * スタッフが交換済みにすると、数秒おきの確認で気づいて画面を「交換済み」に切り替える
 */
export default function ExchangePanel({ hours }: { hours: string }) {
  const router = useRouter();
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();

  const expired = issued !== null && now >= issued.expiresAt;

  function issue() {
    setError(null);
    startTransition(async () => {
      const result = await issueExchangeTokenAction();
      if (result.status === "ok") {
        const svg = await QRCode.toString(result.token, { type: "svg", errorCorrectionLevel: "M", margin: 4 });
        setNow(Date.now());
        setIssued({ svg, expiresAt: result.expiresAt });
      } else if (result.status === "closed") {
        setError(`受付時間外です（${hours}）`);
      } else {
        // 交換済み・数が足りないなど、画面の表示が古いときはサーバーの状態で描き直す
        router.refresh();
      }
    });
  }

  // QRを出している間：残り時間の表示と、交換済みになったかの確認
  useEffect(() => {
    if (!issued || expired) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      if (await checkRedeemedAction()) router.refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [issued, expired, router]);

  if (issued && !expired) {
    const remaining = Math.max(0, Math.ceil((issued.expiresAt - now) / 1000));
    return (
      <section className="space-y-3 text-center">
        <p className="font-bold">このQRを交換所のスタッフに見せてください</p>
        {/* QRCode が作った SVG（中身は署名トークンだけ） */}
        <div
          className="mx-auto w-full max-w-72 rounded-xl border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: issued.svg }}
        />
        <p className="text-sm text-muted-foreground tabular-nums">
          有効期限 あと {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <Notice tone="success" title="景品と交換できます！">
        交換所でスタッフに見せる直前に「交換する」を押してください。QRは5分で使えなくなります。
      </Notice>
      {expired && <Notice tone="info" title="QRの有効期限が切れました。もう一度押してください" />}
      {error && <Notice tone="error" title={error} />}
      <Button size="lg" onClick={issue} disabled={pending} className="h-14 w-full text-lg">
        {pending ? "準備中…" : "交換する"}
      </Button>
    </section>
  );
}
