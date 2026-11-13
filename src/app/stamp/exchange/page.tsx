import { Suspense } from "react";
import Link from "next/link";
import { formatFloorPlace, rallyConfig } from "@/lib/rally/config";
import { getProgress } from "@/lib/rally/participants";
import { formatRallyHours } from "@/lib/rally/schedule";
import { getCurrentParticipant } from "@/lib/rally/service";
import Notice from "../components/Notice";
import ExchangePanel from "./ExchangePanel";

/** 景品交換（設計書 4.5）。条件を満たしていれば交換用QRを出せる */
export default function ExchangePage() {
  const place = rallyConfig.exchangePlace;
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-4 pb-(--bottom-nav-space)">
      <h1 className="text-xl font-bold">景品交換</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border p-4 text-sm">
        <dt className="text-muted-foreground">景品</dt>
        <dd>{rallyConfig.prizeName}</dd>
        <dt className="text-muted-foreground">条件</dt>
        <dd>スタンプ {rallyConfig.requiredStamps}個（1人1回）</dd>
        <dt className="text-muted-foreground">交換所</dt>
        <dd>
          {place.name}（{formatFloorPlace(place)}）
        </dd>
      </dl>
      <Suspense fallback={<p className="py-8 text-center text-sm text-muted-foreground">読み込み中…</p>}>
        <ExchangeStatus />
      </Suspense>
      <Link href="/stamp" className="block text-center text-sm underline underline-offset-4">
        スタンプ一覧へ戻る
      </Link>
    </div>
  );
}

async function ExchangeStatus() {
  const participant = await getCurrentParticipant();
  if (!participant) return <Notice tone="info" title="まだ参加していません" />;

  const progress = await getProgress(participant.id);
  if (progress.redeemedAt) {
    return (
      <Notice tone="success" title="交換済みです">
        ご参加ありがとうございました！
      </Notice>
    );
  }

  const count = progress.stampIds.length;
  if (count < rallyConfig.requiredStamps) {
    return (
      <Notice tone="info" title={`あと ${rallyConfig.requiredStamps - count}個 で交換できます`}>
        今の獲得数：{count}個
      </Notice>
    );
  }

  return <ExchangePanel hours={formatRallyHours("exchange")} />;
}
