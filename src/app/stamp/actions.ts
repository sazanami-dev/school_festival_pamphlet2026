"use server";

import { redirect } from "next/navigation";
import { getProgress } from "@/lib/rally/participants";
import { formatRallyHours } from "@/lib/rally/schedule";
import {
  collectResultUrl,
  collectStamp,
  getCurrentParticipant,
  issueExchangeToken,
  joinRally,
  recoverRally,
  type IssueExchangeResult,
} from "@/lib/rally/service";

/* 参加者が使う Server Action。中身は src/lib/rally/service.ts にあり、ここは入力を受け渡すだけ */

export type FormState = { error?: string };

const RECOVER_ERRORS = {
  invalid: "引き継ぎコードが見つかりません。もう一度確かめてください",
  rate_limited: "入力の失敗が多すぎます。しばらくしてからもう一度お試しください",
} as const;

/** 「参加する」 */
export async function joinAction(): Promise<void> {
  await joinRally();
  redirect("/stamp?joined=1");
}

/** 「引き継ぐ」（/stamp/recover） */
export async function recoverAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await recoverRally(String(formData.get("code") ?? ""));
  if (result.status !== "ok") return { error: RECOVER_ERRORS[result.status] };
  redirect("/stamp?recovered=1");
}

export type ScanResult =
  | { status: "invalid" }
  | { status: "closed"; hours: string }
  | { status: "not_joined" };

/**
 * パンフ内スキャナ・手入力から呼ぶ
 * 読めたときはスタンプ トップへ移ってスタンプを押すアニメーションを見せる。失敗したときはその場で読み直せるよう結果を返す
 */
export async function collectStampAction(token: string): Promise<ScanResult> {
  const participant = await getCurrentParticipant();
  if (!participant) return { status: "not_joined" };

  const result = await collectStamp(participant.id, token);
  if (result.status === "new" || result.status === "already") redirect(collectResultUrl(result));
  if (result.status === "closed") return { status: "closed", hours: formatRallyHours() };
  return { status: "invalid" };
}

/** /stamp/join の「はじめて参加する」：参加とスタンプ付与をまとめて行う */
export async function joinWithStampAction(formData: FormData): Promise<void> {
  const participant = await joinRally();
  redirect(collectResultUrl(await collectStamp(participant.id, String(formData.get("cp") ?? ""))));
}

/** /stamp/join の「引き継ぎコードを入力する」：引き継ぎとスタンプ付与をまとめて行う */
export async function recoverWithStampAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await recoverRally(String(formData.get("code") ?? ""));
  if (result.status !== "ok") return { error: RECOVER_ERRORS[result.status] };
  redirect(collectResultUrl(await collectStamp(result.participant.id, String(formData.get("cp") ?? ""))));
}

/** 交換用QRを発行する（/stamp の景品交換モーダルの「交換する」） */
export async function issueExchangeTokenAction(): Promise<IssueExchangeResult | { status: "not_joined" }> {
  const participant = await getCurrentParticipant();
  if (!participant) return { status: "not_joined" };
  return issueExchangeToken(participant);
}

/** 交換用QRを表示している間、交換済みになったかを数秒おきに確かめる */
export async function checkRedeemedAction(): Promise<boolean> {
  const participant = await getCurrentParticipant();
  if (!participant) return false;
  return (await getProgress(participant.id)).redeemedAt !== null;
}
