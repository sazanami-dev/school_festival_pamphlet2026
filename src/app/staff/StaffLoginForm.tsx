"use client";

import { useActionState } from "react";
import Notice from "@/app/stamp/components/Notice";
import SubmitButton from "@/app/stamp/components/SubmitButton";
import { staffLoginAction, type LoginState } from "./actions";

type LoginAction = (prev: LoginState, formData: FormData) => Promise<LoginState>;

/** PINの入力欄。管理画面（/console）でも action を差し替えて使う */
export default function StaffLoginForm({ action = staffLoginAction }: { action?: LoginAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-bold">PIN</span>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          required
          aria-invalid={state.error ? true : undefined}
          className="h-12 w-full rounded-lg border bg-background px-3 text-lg tracking-widest outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
      </label>
      {state.error && <Notice tone="error" title={state.error} />}
      <SubmitButton pendingLabel="確認中…">ログイン</SubmitButton>
    </form>
  );
}
