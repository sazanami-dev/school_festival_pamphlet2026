"use server";

import { redirect } from "next/navigation";
import type { LoginState } from "@/app/staff/actions";
import { adminLogin } from "@/lib/rally/service";

/* 管理画面の Server Action。集計はページ側で管理者 Cookie を確かめてから読む */

export async function adminLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const result = await adminLogin(String(formData.get("pin") ?? ""));
  if (result.status === "rate_limited") return { error: "失敗が多すぎます。しばらくしてからお試しください" };
  if (result.status === "invalid") return { error: "PINが違います" };
  redirect("/console");
}
