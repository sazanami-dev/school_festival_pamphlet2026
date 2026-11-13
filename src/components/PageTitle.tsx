import { cn } from "@/lib/utils";

/**
 * ページ上部の見出し（白地に青文字。画面の上端にくっつけ、下の角だけ丸めて影を付ける）
 * 上端・左右の端まで広げるため、ページ側で上の余白をなくし、左右の余白は負のマージンで打ち消す
 */
export default function PageTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        "flex h-20 items-center justify-center rounded-b-[20px] bg-white text-2xl font-bold text-[#0048FF] shadow-[0_4px_4px_rgb(0_0_0/0.25)] dark:bg-gray-900 dark:text-blue-400",
        className,
      )}
    >
      {children}
    </h1>
  );
}
