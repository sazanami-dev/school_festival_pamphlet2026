import { Suspense } from "react";
import Link from "next/link";
import { LuStamp } from "react-icons/lu";
import { MdQrCodeScanner } from "react-icons/md";
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
import HowToPlay from "./components/HowToPlay";
import Notice from "./components/Notice";
import StampPress from "./components/StampPress";
import SubmitButton from "./components/SubmitButton";

/**
 * スタンプ トップ（設計書 3章）
 * 参加者ごとに内容が変わるので、Cookie を読む部分は Suspense の中でリクエスト時に描画する
 */
export default function StampPage({ searchParams }: PageProps<"/stamp">) {
  return (
    <div className="flex flex-1 flex-col">
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
  const acquired = new Set(progress?.stampIds);
  const notice = <ResultNotice params={params} acquired={acquired} />;

  return participant && progress ? (
    <JoinedView
      participant={participant}
      progress={progress}
      justJoined={params.joined === "1"}
      justStamped={justStampedId(params, acquired)}
      notice={notice}
    />
  ) : (
    <NotJoinedView notice={notice} />
  );
}

/** いま新しく押したスタンプのID（アニメーションを見せる）。獲得済みのQRを読み直したときは無し */
function justStampedId(params: SearchParams, acquired: Set<string>): string | undefined {
  const got = getCheckpoint(firstParam(params.got) ?? "");
  if (!got || !acquired.has(got.id) || firstParam(params.already) === "1") return undefined;
  return got.id;
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
 * 画面の骨組み（デザイン: 上はグレー地にカードとボタン、下は白地にチェックポイント一覧）
 * ======================================================= */

/** 上半分（グレー地）。お知らせ・スタンプカード・メインのボタン */
function TopArea({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-md space-y-5 px-6.5 pt-3.75 pb-5">{children}</div>;
}

/** 下半分（白地）。画面の下まで白く伸ばし、ボトムナビの分だけ余白を空ける */
function BottomArea({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto w-full max-w-md space-y-5 px-6.5 pt-4.5 pb-(--bottom-nav-space)">{children}</div>
    </div>
  );
}

/** 遊び方の説明（「遊び方」ダイアログの中身） */
function HowToPlayContent() {
  return (
    <>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
        <li>校内に貼ってあるチェックポイントのQRを「コードをスキャン」で読み取る</li>
        <li>
          スタンプを <strong>{rallyConfig.requiredStamps}個</strong> 集めると、
          {rallyConfig.exchangePlace.name}（{formatFloorPlace(rallyConfig.exchangePlace)}）で景品と交換できます
        </li>
      </ol>
      <p className="text-sm text-muted-foreground">受付時間：{formatRallyHours()}</p>
    </>
  );
}

/**
 * スタンプカード。枠の数は景品に必要な個数で、集めた数だけ左上から順に押していく
 * （どのチェックポイントのスタンプかは下の一覧で見せる）
 * justStamped（いま押したスタンプのID）があるときは、最後の1個にスタンプを押すアニメーションを付ける
 */
function StampCard({ count, justStamped }: { count: number; justStamped?: string }) {
  const required = rallyConfig.requiredStamps;

  return (
    <section aria-labelledby="stamp-card-title" className="rounded-[15px] bg-white px-6.25 pt-3 pb-6.25">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="stamp-card-title" className="-ml-2.5 text-[15px] font-bold">
          スタンプカード
        </h2>
        <div className="-mr-1">
          <HowToPlay>
            <HowToPlayContent />
          </HowToPlay>
        </div>
      </div>
      <p className="sr-only">
        {count}個 / {required}個 獲得
      </p>
      <ul aria-hidden className="grid grid-cols-4 justify-items-center gap-4.5 rounded-[15px] bg-[#EFEFEF] px-6.75 py-5.75">
        {Array.from({ length: required }, (_, i) => (
          <li key={i}>
            {i < count ? (
              <StampPress
                stampId={i === count - 1 ? justStamped : undefined}
                className="flex size-12 items-center justify-center rounded-full bg-[#0048FF]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 小さいSVGなので最適化は不要 */}
                <img src="/sazanami_icon.svg" alt="" className="size-8" />
              </StampPress>
            ) : (
              <div className="size-12 rounded-full border border-dashed border-[#A0A0A0] bg-white" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** チェックポイントの一覧（2列） */
function CheckpointGrid({ acquired, justStamped }: { acquired: Set<string>; justStamped?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-3.5">
      {checkpoints.map((cp, index) => (
        <li key={cp.id}>
          <StampTile
            number={index + 1}
            checkpoint={cp}
            acquired={acquired.has(cp.id)}
            justStamped={cp.id === justStamped ? justStamped : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

/* =========================================================
 * 未参加
 * ======================================================= */

function NotJoinedView({ notice }: { notice: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-4 pb-(--bottom-nav-space)">
      <h1 className="text-xl font-bold">スタンプラリー</h1>
      {notice}
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-bold">遊び方</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>下の「参加する」を押す</li>
          <li>校内に貼ってあるチェックポイントのQRを「コードをスキャン」で読み取る</li>
          <li>
            スタンプを <strong>{rallyConfig.requiredStamps}個</strong> 集めると、
            {rallyConfig.exchangePlace.name}（{formatFloorPlace(rallyConfig.exchangePlace)}）で景品と交換できます
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">受付時間：{formatRallyHours()}</p>
      </section>

      <form action={joinAction} className="space-y-2">
        <SubmitButton pendingLabel="参加しています…" className="bg-[#0048FF] font-bold text-white">
          参加する
        </SubmitButton>
        <p className="text-xs leading-relaxed text-muted-foreground">
          参加すると、スタンプの記録のためにランダムなIDをこの端末（Cookie）に保存します。名前などの個人情報は集めません。
        </p>
      </form>

      <p className="text-center text-sm">
        別のブラウザで参加していた方は{" "}
        <Link href="/stamp/recover" className="font-bold text-[#0048FF] underline underline-offset-4 dark:text-blue-400">
          引き継ぎコードを入力
        </Link>
      </p>
    </div>
  );
}

/* =========================================================
 * 参加済み
 * ======================================================= */

function JoinedView({
  participant,
  progress,
  justJoined,
  justStamped,
  notice,
}: {
  participant: Participant;
  progress: ParticipantProgress;
  justJoined: boolean;
  justStamped?: string;
  notice: React.ReactNode;
}) {
  const acquired = new Set(progress.stampIds);
  const count = acquired.size;
  const open = isRallyOpen("stamp");

  return (
    <div className="flex flex-1 flex-col bg-[#F4F4F4]">
      <h1 className="sr-only">スタンプラリー</h1>
      <TopArea>
        {notice}
        {!open && <Notice tone="error" title={`現在は受付時間外です（${formatRallyHours()}）`} />}
        {justJoined && <RecoveryCodeCard code={participant.recoveryCode} highlight />}
        <StampCard count={count} justStamped={justStamped} />
        <div className="space-y-3 px-2">
          <Link
            href="/stamp/scan"
            className="flex h-12.5 w-full items-center justify-center gap-2.5 rounded-[10px] bg-[#0048FF] font-bold text-white transition active:opacity-80"
          >
            <MdQrCodeScanner aria-hidden className="size-6 text-[#E3E3E3]" />
            コードをスキャン
          </Link>
          <PrizeCard count={count} redeemedAt={progress.redeemedAt} />
        </div>
      </TopArea>
      <BottomArea>
        <CheckpointGrid acquired={acquired} justStamped={justStamped} />
        {!justJoined && <RecoveryCodeCard code={participant.recoveryCode} />}
      </BottomArea>
    </div>
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

/** チェックポイント1件。未獲得のものは押すとマップでその場所を開く */
function StampTile({
  number,
  checkpoint,
  acquired,
  justStamped,
}: {
  number: number;
  checkpoint: (typeof checkpoints)[number];
  acquired: boolean;
  justStamped?: string;
}) {
  const body = (
    <>
      {acquired ? (
        <StampPress
          stampId={justStamped}
          className="flex size-22 items-center justify-center rounded-full bg-[#0048FF] p-1.5"
        >
          <div className="flex size-full items-center justify-center rounded-full border-2 border-white">
            <LuStamp aria-hidden className="size-12 text-white" strokeWidth={1.5} />
          </div>
        </StampPress>
      ) : (
        <div className="size-22 rounded-full border-2 border-dashed border-[#A0A0A0]" />
      )}
      <p className="mt-2 text-[13px] font-medium text-[#B6B6B6]">No.{number}</p>
      <p className="text-sm leading-snug font-bold">{checkpoint.name}</p>
      <p className="sr-only">{acquired ? "獲得済み" : `未獲得。${checkpoint.hint}。マップで場所を開く`}</p>
    </>
  );
  const className = cn(
    "flex aspect-square h-full flex-col items-center justify-center rounded-[15px] border p-3 text-center",
    acquired ? "border-[#0048FF] bg-[#E4EBFF]" : "border-dashed border-[#A0A0A0] bg-white",
  );

  return acquired ? (
    <div className={className}>{body}</div>
  ) : (
    <Link href={checkpointMapHref(checkpoint)} className={cn(className, "transition active:scale-[0.98]")}>
      {body}
    </Link>
  );
}

function RecoveryCodeCard({ code, highlight = false }: { code: string; highlight?: boolean }) {
  return (
    <section
      className={cn(
        "space-y-2 rounded-xl border p-4",
        highlight && "border-2 border-[#0048FF] bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-50",
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
