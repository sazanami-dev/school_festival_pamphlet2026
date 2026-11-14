import "server-only";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { createSignedToken, verifySignedToken } from "./signed-token";

/**
 * スタンプラリーの Cookie（設計書 5.1, 5.5）
 * 読むのはどこでもよいが、set は Server Action / Route Handler の中だけで呼ぶこと
 */

const PARTICIPANT_COOKIE = "sr_pid";
const PARTICIPANT_MAX_AGE = 30 * 24 * 60 * 60;
const STAFF_COOKIE = "sr_staff";
const ADMIN_COOKIE = "sr_admin";

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 開発中は http://localhost や LAN のIPで開くので Secure を付けない（付けると Safari 等で保存されない）
const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

export async function readParticipantCookie(): Promise<string | undefined> {
  return (await cookies()).get(PARTICIPANT_COOKIE)?.value;
}

export async function setParticipantCookie(participantId: string): Promise<void> {
  (await cookies()).set(PARTICIPANT_COOKIE, participantId, { ...baseCookieOptions, maxAge: PARTICIPANT_MAX_AGE });
}

/** PINで入る画面の種類。スタッフ（交換所）と管理画面で Cookie と署名の用途を分ける */
export type PinRole = "staff" | "admin";

const ROLE_COOKIES: Record<PinRole, string> = { staff: STAFF_COOKIE, admin: ADMIN_COOKIE };

/** スタッフ／管理画面の Cookie を発行する。有効期限は当日中（日本時間の24時まで） */
export async function setRoleCookie(role: PinRole, now: number = Date.now()): Promise<void> {
  const endOfDay = Math.floor((now + JST_OFFSET_MS) / DAY_MS) * DAY_MS + DAY_MS - JST_OFFSET_MS;
  (await cookies()).set(ROLE_COOKIES[role], createSignedToken(role, "1", endOfDay), {
    ...baseCookieOptions,
    maxAge: Math.floor((endOfDay - now) / 1000),
  });
}

async function hasRole(role: PinRole): Promise<boolean> {
  const value = (await cookies()).get(ROLE_COOKIES[role])?.value;
  if (value === undefined) return false;
  // 期限の判定で現在時刻を読むので、セッション単位でキャッシュされるシェルに入れず、リクエストごとに判定する
  await io();
  return verifySignedToken(role, value).status === "ok";
}

export async function isStaff(): Promise<boolean> {
  return hasRole("staff");
}

export async function isAdmin(): Promise<boolean> {
  return hasRole("admin");
}
