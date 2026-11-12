import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isStaff } from "@/lib/rally/session";
import StaffLoginForm from "./StaffLoginForm";

/** 交換所スタッフのログイン（設計書 5.5）。PINが正しければ当日中有効の Cookie を発行する */
export default function StaffLoginPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
      <h1 className="text-xl font-bold">交換所スタッフ</h1>
      <Suspense fallback={null}>
        <LoginGate />
      </Suspense>
    </div>
  );
}

async function LoginGate() {
  if (await isStaff()) redirect("/staff/exchange");
  return <StaffLoginForm />;
}
