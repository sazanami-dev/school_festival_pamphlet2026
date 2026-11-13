import { cn } from "@/lib/utils";

/** ページ上部の見出し(スタンプラリーの青の横長ピル) */
export default function PageTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        "flex h-15 w-full items-center justify-center rounded-full bg-[#0048FF] text-2xl font-bold text-white",
        className,
      )}
    >
      {children}
    </h1>
  );
}
