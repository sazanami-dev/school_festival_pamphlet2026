import { cn } from "@/lib/utils";

/** 画面上部に出すお知らせ（スタンプ獲得・エラーなど） */
export default function Notice({
  tone,
  title,
  children,
  className,
}: {
  tone: "success" | "info" | "error";
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3",
        tone === "success" && "border-emerald-300 bg-emerald-50 text-emerald-900",
        tone === "info" && "border-blue-300 bg-blue-50 text-blue-900",
        tone === "error" && "border-red-300 bg-red-50 text-red-900",
        className,
      )}
    >
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1 text-sm leading-relaxed">{children}</div>}
    </div>
  );
}
