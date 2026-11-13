"use client";

import { useActionState } from "react";
import type { FormState } from "../actions";
import Notice from "./Notice";
import SubmitButton from "./SubmitButton";

/**
 * 引き継ぎコードの入力欄（/stamp/recover と /stamp/join で共通）
 * 小文字・ハイフンなしでも通る（サーバー側でそろえる）
 */
export default function RecoverForm({
  action,
  checkpointToken,
  confirmOverwrite = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** /stamp/join から来たときのチェックポイントのトークン（引き継ぎと一緒にスタンプも付ける） */
  checkpointToken?: string;
  /** このブラウザに別のIDがあるとき、上書きしてよいか確かめる */
  confirmOverwrite?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          confirmOverwrite &&
          !window.confirm("このブラウザで集めているスタンプは表示されなくなります（統合はされません）。引き継ぎますか？")
        ) {
          e.preventDefault();
        }
      }}
      className="space-y-3"
    >
      {checkpointToken && <input type="hidden" name="cp" value={checkpointToken} />}
      <label className="block space-y-1.5">
        <span className="text-sm font-bold">引き継ぎコード</span>
        <input
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="XXXX-XXXX"
          aria-invalid={state.error ? true : undefined}
          className="h-12 w-full rounded-lg border bg-background px-3 font-mono text-lg tracking-widest uppercase outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
      </label>
      {state.error && <Notice tone="error" title={state.error} />}
      <SubmitButton pendingLabel="確認中…" className="bg-[#0048FF] font-bold text-white">
        引き継ぐ
      </SubmitButton>
    </form>
  );
}
