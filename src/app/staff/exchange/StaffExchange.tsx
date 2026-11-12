"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "@/components/QrScanner";
import { Button } from "@/components/ui/button";
import Notice from "@/app/stamp/components/Notice";
import {
  checkExchangeAction,
  confirmExchangeAction,
  type ConfirmResult,
  type ExchangeCheck,
} from "../actions";

/** "10:42" のように日本時間の時刻にする */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
}

type State =
  | { step: "scan" }
  | { step: "checked"; token: string; check: ExchangeCheck }
  | { step: "confirmed"; result: ConfirmResult };

export default function StaffExchange() {
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "scan" });
  const [pending, startTransition] = useTransition();

  function handleDetect(token: string) {
    startTransition(async () => {
      const check = await checkExchangeAction(token);
      if (check.status === "unauthorized") {
        router.refresh();
        return;
      }
      setState({ step: "checked", token, check });
    });
  }

  function confirm(token: string) {
    startTransition(async () => {
      const result = await confirmExchangeAction(token);
      if (result.status === "unauthorized") {
        router.refresh();
        return;
      }
      setState({ step: "confirmed", result });
    });
  }

  const reset = () => setState({ step: "scan" });

  return (
    <div className="space-y-4">
      {state.step === "scan" && (
        <>
          <p className="text-sm text-muted-foreground">参加者の「交換用QR」を読み取ってください。</p>
          <QrScanner
            onDetect={handleDetect}
            paused={pending}
            fallbackHint="カメラが使える端末で開いてください。"
          />
          {pending && <p className="text-center text-sm text-muted-foreground">確認しています…</p>}
        </>
      )}

      {state.step === "checked" && (
        <CheckView check={state.check} pending={pending} onConfirm={() => confirm(state.token)} onCancel={reset} />
      )}

      {state.step === "confirmed" && (
        <>
          <ConfirmView result={state.result} />
          <Button size="lg" onClick={reset} className="h-14 w-full text-lg">
            次の人を読む
          </Button>
        </>
      )}
    </div>
  );
}

function CheckView({
  check,
  pending,
  onConfirm,
  onCancel,
}: {
  check: ExchangeCheck;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const back = (
    <Button size="lg" variant="outline" onClick={onCancel} className="h-14 w-full text-lg">
      読み直す
    </Button>
  );

  if (check.status === "expired") {
    return (
      <>
        <Notice tone="error" title="QRの有効期限が切れています">
          参加者に、もう一度「交換する」を押してもらってください。
        </Notice>
        {back}
      </>
    );
  }
  if (check.status !== "ok") {
    return (
      <>
        <Notice tone="error" title="無効なQRです">スタンプラリーの交換用QRではありません。</Notice>
        {back}
      </>
    );
  }

  const enough = check.stampCount >= check.requiredStamps;
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 rounded-xl border p-4">
        <dt className="text-sm text-muted-foreground">獲得数</dt>
        <dd className="text-3xl font-bold tabular-nums">
          {check.stampCount}
          <span className="text-base font-normal text-muted-foreground"> / {check.requiredStamps}</span>
        </dd>
        <dt className="text-sm text-muted-foreground">交換</dt>
        <dd className="text-lg font-bold">
          {check.redeemedAt ? `交換済み（${formatTime(check.redeemedAt)}）` : "未交換"}
        </dd>
      </dl>

      {check.redeemedAt ? (
        <Notice tone="error" title={`交換済みです（${formatTime(check.redeemedAt)}）`}>
          景品は渡さないでください。
        </Notice>
      ) : !enough ? (
        <Notice tone="error" title="スタンプが足りません" />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">景品を渡したら「交換済みにする」を押してください。</p>
          <Button size="lg" onClick={onConfirm} disabled={pending} className="h-14 w-full text-lg">
            {pending ? "記録しています…" : "交換済みにする"}
          </Button>
        </>
      )}
      {back}
    </>
  );
}

function ConfirmView({ result }: { result: ConfirmResult }) {
  switch (result.status) {
    case "ok":
      return <Notice tone="success" title={`交換済みにしました（${formatTime(result.redeemedAt)}）`} />;
    case "already":
      return (
        <Notice tone="error" title={`すでに交換済みです（${formatTime(result.redeemedAt)}）`}>
          景品は渡さないでください。
        </Notice>
      );
    case "not_enough":
      return <Notice tone="error" title={`スタンプが足りません（${result.stampCount}個）`} />;
    case "expired":
      return <Notice tone="error" title="QRの有効期限が切れています" />;
    default:
      return <Notice tone="error" title="無効なQRです" />;
  }
}
