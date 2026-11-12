import { Suspense } from "react";
import Link from "next/link";
import { findCheckpointByToken } from "@/lib/rally/checkpoint-token";
import { getCurrentParticipant } from "@/lib/rally/service";
import { joinWithStampAction, recoverWithStampAction } from "../actions";
import Notice from "../components/Notice";
import RecoverForm from "../components/RecoverForm";
import SubmitButton from "../components/SubmitButton";

/**
 * 参加の選択（設計書 4.3）。Cookie の無い人が /s/[token] から来たときの画面
 * 何も聞かずにIDを作ると、別のブラウザで集めていた人のスタンプが分かれてしまうので、ここで選んでもらう
 */
export default function JoinPage({ searchParams }: PageProps<"/stamp/join">) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-4 pb-(--bottom-nav-space)">
      <h1 className="text-xl font-bold">スタンプラリー</h1>
      <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">読み込み中…</p>}>
        <JoinChoice searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function JoinChoice({ searchParams }: { searchParams: PageProps<"/stamp/join">["searchParams"] }) {
  const cpParam = (await searchParams).cp;
  const token = typeof cpParam === "string" ? cpParam : "";
  const checkpoint = findCheckpointByToken(token);

  if (!checkpoint) {
    return (
      <>
        <Notice tone="error" title="無効なQRです" />
        <Link href="/stamp" className="block text-center text-sm underline underline-offset-4">
          スタンプラリーのトップへ
        </Link>
      </>
    );
  }

  // 別のタブで参加済みになっていたら、選ばずにそのままスタンプを受け取れる
  if (await getCurrentParticipant()) {
    return (
      <form action={joinWithStampAction} className="space-y-3">
        <p className="font-bold">{checkpoint.name} のチェックポイント</p>
        <input type="hidden" name="cp" value={token} />
        <SubmitButton pendingLabel="受け取っています…">スタンプを受け取る</SubmitButton>
      </form>
    );
  }

  return (
    <>
      <section className="space-y-1">
        <p className="text-lg font-bold">{checkpoint.name} のチェックポイント</p>
        <p className="text-sm text-muted-foreground">
          このブラウザではまだ参加していません。どちらかを選ぶと、そのままスタンプが付きます。
        </p>
      </section>

      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="font-bold">はじめての方</h2>
        <form action={joinWithStampAction} className="space-y-2">
          <input type="hidden" name="cp" value={token} />
          <SubmitButton pendingLabel="参加しています…">はじめて参加する</SubmitButton>
        </form>
        <p className="text-xs leading-relaxed text-muted-foreground">
          参加すると、スタンプの記録のためにランダムなIDをこの端末（Cookie）に保存します。名前などの個人情報は集めません。
        </p>
      </section>

      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="font-bold">別のブラウザ・アプリで参加している方</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          パンフの「スタンプ」画面に出ている引き継ぎコードを入力してください。
        </p>
        <RecoverForm action={recoverWithStampAction} checkpointToken={token} />
      </section>
    </>
  );
}
