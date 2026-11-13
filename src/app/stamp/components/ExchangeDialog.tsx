"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MdOutlineRedeem } from "react-icons/md";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { checkRedeemedAction, issueExchangeTokenAction } from "../actions";
import Modal from "./Modal";
import Notice from "./Notice";

/** 交換済みになったかを確かめる間隔 */
const POLL_INTERVAL_MS = 3000;

type Issued = { svg: string; expiresAt: number };

/**
 * 「スタンプをクーポンに交換する」ボタンと、押すと出る景品交換のモーダル（設計書 4.5）
 *
 * いつも出しておき、必要な数に届くまでと交換したあとは押せないようにする。
 * モーダルで「交換する」→ 交換用QR（有効期限5分の署名トークン）を表示する。
 * モーダルを閉じても期限内ならQRを覚えておき、ボタンを押すともう一度出す。
 * QRを出している間は数秒おきに確かめ、スタッフが交換済みにしたら「交換済み」に切り替える。
 */
export default function ExchangeDialog({
  enough,
  redeemed,
  place,
  hours,
}: {
  /** 交換に必要な数のスタンプを集めたか */
  enough: boolean;
  /** 交換済みか（サーバーで読んだ値） */
  redeemed: boolean;
  /** 交換所（例: 「さざなみ開発（3階 3-1）」） */
  place: string;
  /** 交換の受付時間 */
  hours: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** このモーダルでQRを見せている間に交換済みになった */
  const [justRedeemed, setJustRedeemed] = useState(false);
  const [pending, startTransition] = useTransition();

  const showing = issued !== null && now < issued.expiresAt && !justRedeemed;
  const expired = issued !== null && now >= issued.expiresAt;

  function open() {
    setNow(Date.now());
    dialogRef.current?.showModal();
  }

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
        dialogRef.current?.close();
        router.refresh();
      }
    });
  }

  // QRを出している間（モーダルを閉じていても）：残り時間の表示と、交換済みになったかの確認
  useEffect(() => {
    if (!showing) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      if (!(await checkRedeemedAction())) return;
      setJustRedeemed(true);
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [showing, router]);

  const done = redeemed || justRedeemed;
  const disabled = !enough || done;

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        className={cn(
          "flex h-12.5 w-full items-center justify-center gap-2.5 rounded-[10px] font-bold",
          disabled
            ? "bg-[#E3E3E3] text-[#A0A0A0]"
            : "border-2 border-[#0048FF] bg-white text-[#0048FF] transition active:opacity-80",
        )}
      >
        <MdOutlineRedeem aria-hidden className="size-6" />
        {done ? "クーポンに交換済みです" : showing ? "交換用QRをもう一度表示する" : "スタンプをクーポンに交換する"}
      </button>

      <Modal ref={dialogRef} title="景品交換" closeTone="secondary">
        {justRedeemed ? (
          <Notice tone="success" title="交換しました！">
            ご参加ありがとうございました！
          </Notice>
        ) : showing && issued ? (
          <QrView svg={issued.svg} remaining={Math.ceil((issued.expiresAt - now) / 1000)} />
        ) : (
          <>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">交換所</p>
              <p className="mt-0.5 text-lg font-bold">{place}</p>
            </div>
            <p className="text-sm leading-relaxed">
              交換所でスタッフに見せる直前に「交換する」を押してください。QRは5分で使えなくなります。
            </p>
            {expired && <Notice tone="info" title="QRの有効期限が切れました。もう一度押してください" />}
            {error && <Notice tone="error" title={error} />}
            <button
              type="button"
              onClick={issue}
              disabled={pending}
              className="h-12 w-full rounded-[10px] bg-[#0048FF] font-bold text-white transition active:opacity-80 disabled:opacity-60"
            >
              {pending ? "準備中…" : "交換する"}
            </button>
          </>
        )}
      </Modal>
    </>
  );
}

function QrView({ svg, remaining }: { svg: string; remaining: number }) {
  const seconds = Math.max(0, remaining);
  return (
    <section className="space-y-3 text-center">
      <p className="font-bold">このQRを交換所のスタッフに見せてください</p>
      {/* QRCode が作った SVG（中身は署名トークンだけ） */}
      <div
        className="mx-auto w-full max-w-72 rounded-xl border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-sm text-muted-foreground tabular-nums">
        有効期限 あと {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </p>
    </section>
  );
}
