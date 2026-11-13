import { redirect } from "next/navigation";
import { findCheckpointByToken } from "@/lib/rally/checkpoint-token";
import { isRallyOpen } from "@/lib/rally/schedule";
import { collectResultUrl, collectStamp, getCurrentParticipant } from "@/lib/rally/service";

/**
 * チェックポイントQRのリンク先（設計書 4.3）。画面は持たず、処理してリダイレクトする
 *
 * スマホの標準カメラで読まれたときに通る。GET でDBを更新するが、
 * Cookie の無いリンクプレビューは /stamp/join に移るだけで何も保存されないので問題ない。
 */
export async function GET(_request: Request, ctx: RouteContext<"/s/[token]">) {
  const { token } = await ctx.params;

  const checkpoint = findCheckpointByToken(token);
  if (!checkpoint) redirect("/stamp?error=invalid");
  if (!isRallyOpen("stamp")) redirect("/stamp?error=closed");

  const participant = await getCurrentParticipant();
  // Cookie が無いときはIDを作らない（別のブラウザで集めていた人のスタンプが分かれないよう、参加か引き継ぎかを選んでもらう）
  if (!participant) redirect(`/stamp/join?cp=${encodeURIComponent(token)}`);

  redirect(collectResultUrl(await collectStamp(participant.id, token)));
}
