"use server";

import { redirect } from "next/navigation";
import { rallyConfig } from "@/lib/rally/config";
import { confirmExchange, inspectExchangeToken, staffLogin } from "@/lib/rally/service";
import { isStaff } from "@/lib/rally/session";

/* 交換所スタッフが使う Server Action。ログイン以外は毎回スタッフ Cookie を確かめる */

export type LoginState = { error?: string };

export async function staffLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const result = await staffLogin(String(formData.get("pin") ?? ""));
  if (result.status === "rate_limited") return { error: "失敗が多すぎます。しばらくしてからお試しください" };
  if (result.status === "invalid") return { error: "PINが違います" };
  redirect("/staff/exchange");
}

/** 画面に出す確認結果。参加者IDは画面に出さない */
export type ExchangeCheck =
  | { status: "ok"; stampCount: number; requiredStamps: number; redeemedAt: string | null }
  | { status: "invalid" | "expired" | "unauthorized" };

export async function checkExchangeAction(token: string): Promise<ExchangeCheck> {
  if (!(await isStaff())) return { status: "unauthorized" };

  const result = await inspectExchangeToken(token);
  if (result.status !== "ok") return result;
  return {
    status: "ok",
    stampCount: result.stampCount,
    requiredStamps: rallyConfig.requiredStamps,
    redeemedAt: result.redeemedAt?.toISOString() ?? null,
  };
}

export type ConfirmResult =
  | { status: "ok"; redeemedAt: string }
  | { status: "already"; redeemedAt: string }
  | { status: "not_enough"; stampCount: number }
  | { status: "invalid" | "expired" | "unauthorized" };

export async function confirmExchangeAction(token: string): Promise<ConfirmResult> {
  if (!(await isStaff())) return { status: "unauthorized" };

  const result = await confirmExchange(token);
  if (result.status === "ok" || result.status === "already") {
    return { status: result.status, redeemedAt: result.redeemedAt.toISOString() };
  }
  return result;
}
