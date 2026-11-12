import { Suspense } from "react";
import Link from "next/link";
import { LuCircleCheck, LuMapPin, LuScanLine, LuStamp } from "react-icons/lu";
import { buttonVariants } from "@/components/ui/button";
import { formatCode } from "@/lib/rally/code";
import {
  checkpointMapHref,
  checkpoints,
  formatFloorPlace,
  getCheckpoint,
  rallyConfig,
} from "@/lib/rally/config";
import { getProgress, type Participant, type ParticipantProgress } from "@/lib/rally/participants";
import { formatRallyHours, isRallyOpen } from "@/lib/rally/schedule";
import { getCurrentParticipant } from "@/lib/rally/service";
import { cn } from "@/lib/utils";
import { joinAction } from "./actions";
import Notice from "./components/Notice";
import SubmitButton from "./components/SubmitButton";

/**
 * スタンプ トップ（設計書 3章）
 * 参加者ごとに内容が変わるので、Cookie を読む部分は Suspense の中でリクエスト時に描画する
 */
export default function StampPage({ searchParams }: PageProps<"/stamp">) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-4 pb-(--bottom-nav-space)">
      <h1 className="text-xl font-bold">スタンプラリー</h1>
      <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">読み込み中…</p>}>
        <StampHome searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type SearchParams = Awaited<PageProps<"/stamp">["searchParams"]>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function StampHome({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [participant, params] = await Promise.all([getCurrentParticipant(), searchParams]);
  const progress = participant ? await getProgress(participant.id) : null;

  return (
    <>
      <ResultNotice params={params} acquired={new Set(progress?.stampIds)} />
      {participant && progress ? (
        <JoinedView participant={participant} progress={progress} justJoined={params.joined === "1"} />
      ) : (
        <NotJoinedView />
      )}
    </>
  );
}

/**
 * QRを読んだ結果・エラー（/s/[token] や Server Action からのリダイレクトで付く）
 * URL は誰でも書けるので、「獲得」は実際に持っているスタンプのときだけ出す
 */
function ResultNotice({ params, acquired }: { params: SearchParams; acquired: Set<string> }) {
  const error = firstParam(params.error);
  if (error === "invalid") {
    return <Notice tone="error" title="無効なQRです">スタンプラリーのQRかどうか確かめてください。</Notice>;
  }
  if (error === "closed") {
    return <Notice tone="error" title={`受付時間外です（${formatRallyHours()}）`} />;
  }

  const got = getCheckpoint(firstParam(params.got) ?? "");
  if (got && acquired.has(got.id)) {
    return firstParam(params.already) === "1" ? (
      <Notice tone="info" title="獲得済みです">{got.name} のスタンプはもう持っています。</Notice>
    ) : (
      <Notice tone="success" title={`${got.name} のスタンプを獲得！`} />
    );
  }

  if (params.recovered === "1") return <Notice tone="success" title="引き継ぎました" />;
  return null;
}

/* =========================================================
 * 未参加
 * ======================================================= */

function NotJoinedView() {
  return (
    <>
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-bold">遊び方</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>下の「参加する」を押す</li>
          <li>校内に貼ってあるチェックポイントのQRを「QRを読む」で読み取る</li>
          <li>
            スタンプを <strong>{rallyConfig.requiredStamps}個</strong> 集めると、
            {rallyConfig.exchangePlace.name}（{formatFloorPlace(rallyConfig.exchangePlace)}）で景品と交換できます
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">受付時間：{formatRallyHours()}</p>
      </section>

      <form action={joinAction} className="space-y-2">
        <SubmitButton pendingLabel="参加しています…">参加する</SubmitButton>
        <p className="text-xs leading-relaxed text-muted-foreground">
          参加すると、スタンプの記録のためにランダムなIDをこの端末（Cookie）に保存します。名前などの個人情報は集めません。
        </p>
      </form>

      <p className="text-center text-sm">
        別のブラウザで参加していた方は{" "}
        <Link href="/stamp/recover" className="font-bold text-blue-700 underline underline-offset-4 dark:text-blue-400">
          引き継ぎコードを入力
        </Link>
      </p>
    </>
  );
}

/* =========================================================
 * 参加済み
 * ======================================================= */

function JoinedView({
  participant,
  progress,
  justJoined,
}: {
  participant: Participant;
  progress: ParticipantProgress;
  justJoined: boolean;
}) {
  const acquired = new Set(progress.stampIds);
  const count = acquired.size;
  const required = rallyConfig.requiredStamps;
  const open = isRallyOpen("stamp");

  return (
    <>
      {justJoined && <RecoveryCodeCard code={participant.recoveryCode} highlight />}

      <section className="space-y-3 rounded-xl border p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">獲得したスタンプ</h2>
          <p>
            <span className="text-3xl font-bold tabular-nums">{count}</span>
            <span className="text-muted-foreground"> / {required}</span>
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-700 transition-[width]"
            style={{ width: `${Math.min(100, (count / required) * 100)}%` }}
          />
        </div>
        {!open && <p className="text-sm text-red-700">現在は受付時間外です（{formatRallyHours()}）</p>}
      </section>

      <PrizeCard count={count} redeemedAt={progress.redeemedAt} />

      <Link href="/stamp/scan" className={buttonVariants({ size: "lg", className: "h-14 w-full gap-2 text-lg" })}>
        <LuScanLine aria-hidden className="size-6" />
        QRを読む
      </Link>

      <ul className="grid grid-cols-2 gap-3">
        {checkpoints.map((cp, index) => (
          <li key={cp.id}>
            <StampTile number={index + 1} checkpoint={cp} acquired={acquired.has(cp.id)} />
          </li>
        ))}
      </ul>

      {!justJoined && <RecoveryCodeCard code={participant.recoveryCode} />}
    </>
  );
}

function PrizeCard({ count, redeemedAt }: { count: number; redeemedAt: Date | null }) {
  const place = `${rallyConfig.exchangePlace.name}（${formatFloorPlace(rallyConfig.exchangePlace)}）`;

  if (redeemedAt) {
    return (
      <Notice tone="success" title="景品交換済みです">
        ご参加ありがとうございました！
      </Notice>
    );
  }
  if (count < rallyConfig.requiredStamps) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        あと <strong className="text-foreground">{rallyConfig.requiredStamps - count}個</strong> で景品と交換できます
      </p>
    );
  }
  return (
    <section className="space-y-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950">
      <p className="text-lg font-bold">景品と交換できます！</p>
      <p className="text-sm">交換所：{place}</p>
      <Link href="/stamp/exchange" className={buttonVariants({ size: "lg", className: "h-12 w-full text-base" })}>
        景品交換へ
      </Link>
    </section>
  );
}

function StampTile({
  number,
  checkpoint,
  acquired,
}: {
  number: number;
  checkpoint: (typeof checkpoints)[number];
  acquired: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center gap-1.5 rounded-xl border p-3 text-center",
        acquired ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950" : "border-dashed",
      )}
    >
      <div
        className={cn(
          "relative flex size-16 items-center justify-center rounded-full border-4",
          acquired ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400" : "border-muted text-muted",
        )}
      >
        <LuStamp aria-hidden className="size-8" />
        {acquired && (
          <LuCircleCheck aria-hidden className="absolute -right-1 -bottom-1 size-6 rounded-full bg-background" />
        )}
      </div>
      <p className="text-xs text-muted-foreground">No.{number}</p>
      <p className="text-sm font-bold leading-snug">{checkpoint.name}</p>
      <p className="sr-only">{acquired ? "獲得済み" : "未獲得"}</p>
      {!acquired && (
        <Link
          href={checkpointMapHref(checkpoint)}
          className="mt-auto flex items-center gap-0.5 text-xs text-blue-700 underline underline-offset-2 dark:text-blue-400"
        >
          <LuMapPin aria-hidden className="size-3.5 shrink-0" />
          {checkpoint.hint}
        </Link>
      )}
    </div>
  );
}

function RecoveryCodeCard({ code, highlight = false }: { code: string; highlight?: boolean }) {
  return (
    <section
      className={cn(
        "space-y-2 rounded-xl border p-4",
        highlight && "border-2 border-blue-700 bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-50",
      )}
    >
      {highlight && <p className="font-bold">参加しました！</p>}
      <h2 className="text-sm font-bold">引き継ぎコード</h2>
      <p className={cn("font-mono font-bold tracking-widest", highlight ? "text-3xl" : "text-xl")}>
        {formatCode(code)}
      </p>
      <p className="text-xs leading-relaxed">
        {highlight && <strong>スクショかメモをしてください。</strong>}
        別のブラウザやアプリで開いたときは、このコードを
        <Link href="/stamp/recover" className="underline underline-offset-2">
          引き継ぎ画面
        </Link>
        に入力すると、同じスタンプを表示できます。コードをなくすと復元できません。
      </p>
    </section>
  );
}
