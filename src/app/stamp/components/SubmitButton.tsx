"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** フォームの送信ボタン。送信中は押せなくし、文言を変える */
export default function SubmitButton({
  children,
  pendingLabel = "処理中…",
  variant,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant={variant} disabled={pending} className={cn("h-12 w-full text-base", className)}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
