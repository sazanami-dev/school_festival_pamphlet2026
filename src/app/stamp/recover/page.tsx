import { Suspense } from "react";
import Link from "next/link";
import PageTitle from "@/components/PageTitle";
import { getCurrentParticipant } from "@/lib/rally/service";
import { recoverAction } from "../actions";
import RecoverForm from "../components/RecoverForm";

/** 引き継ぎ（設計書 4.4）。引き継ぎコードを入力して、このブラウザで同じスタンプを表示する */
export default function RecoverPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-(--bottom-nav-space)">
      <PageTitle className="-mx-4">引き継ぎ</PageTitle>
      <p className="text-sm leading-relaxed text-muted-foreground">
        別のブラウザやアプリで参加していたときの引き継ぎコードを入力すると、同じスタンプをこのブラウザで表示できます。
      </p>
      <Suspense fallback={null}>
        <RecoverFormForCurrent />
      </Suspense>
      <Link href="/stamp" className="block text-center text-sm underline underline-offset-4">
        スタンプラリーのトップへ戻る
      </Link>
    </div>
  );
}

async function RecoverFormForCurrent() {
  // このブラウザに別のIDがあれば、上書きしてよいか確かめる
  const hasCurrent = (await getCurrentParticipant()) !== null;
  return <RecoverForm action={recoverAction} confirmOverwrite={hasCurrent} />;
}
