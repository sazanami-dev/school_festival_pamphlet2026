"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** 開いたままにしても数字が古くならないよう、この間隔で読み直す */
const AUTO_REFRESH_MS = 60 * 1000;

/** 集計を読み直すボタン。画面を出している間は自動でも読み直す */
export default function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => {
      // 裏のタブでは読み直さない
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? "更新中…" : "更新"}
    </Button>
  );
}
