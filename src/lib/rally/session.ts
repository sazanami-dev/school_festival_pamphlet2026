import "server-only";
import { cookies } from "next/headers";
import { createSignedToken, verifySignedToken } from "./signed-token";

/**
 * スタンプラリーの Cookie（設計書 5.1, 5.5）
 * 読むのはどこでもよいが、set は Server Action / Route Handler の中だけで呼ぶこと
 */

const PARTICIPANT_COOKIE = "sr_pid";
const PARTICIPANT_MAX_AGE = 30 * 24 * 60 * 60;
const STAFF_COOKIE = "sr_staff";

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

/** スタッフ Cookie を発行する。有効期限は当日中（日本時間の24時まで） */
export async function setStaffCookie(now: number = Date.now()): Promise<void> {
  const endOfDay = Math.floor((now + JST_OFFSET_MS) / DAY_MS) * DAY_MS + DAY_MS - JST_OFFSET_MS;
  (await cookies()).set(STAFF_COOKIE, createSignedToken("staff", "1", endOfDay), {
    ...baseCookieOptions,
    maxAge: Math.floor((endOfDay - now) / 1000),
  });
}

export async function isStaff(): Promise<boolean> {
  const value = (await cookies()).get(STAFF_COOKIE)?.value;
  return value !== undefined && verifySignedToken("staff", value).status === "ok";
}
