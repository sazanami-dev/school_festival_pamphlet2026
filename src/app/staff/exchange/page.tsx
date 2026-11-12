import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isStaff } from "@/lib/rally/session";
import StaffExchange from "./StaffExchange";

/** 交換の確認（設計書 4.5）。参加者の交換用QRを読み、内容を確かめて「交換済みにする」 */
export default function StaffExchangePage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
      <h1 className="text-xl font-bold">景品交換の確認</h1>
      <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">読み込み中…</p>}>
        <StaffGate />
      </Suspense>
    </div>
  );
}

async function StaffGate() {
  if (!(await isStaff())) redirect("/staff");
  return <StaffExchange />;
}
