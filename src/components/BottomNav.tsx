"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import { LuStamp } from "react-icons/lu";
import { MdInfoOutline, MdOutlineEvent, MdOutlineListAlt, MdOutlineMap } from "react-icons/md";
import { cn } from "@/lib/utils";

/**
 * 画面の下に浮かぶナビゲーションバー（ルートレイアウトで全画面に表示）
 *
 * ページ側は、一番下の内容がバーに隠れないよう BOTTOM_NAV_SPACE 分の余白を空けておく
 * （CSS からは var(--bottom-nav-space) で同じ値を使える。globals.css と値をそろえること）
 */
export const BOTTOM_NAV_SPACE = 112;

/** バーを出さない画面のパス（前方一致） */
const HIDDEN_PATHS: string[] = ["/staff", "/console"];

type NavItem = { href: string; label: string; icon: IconType };

const LEFT_ITEMS: NavItem[] = [
  { href: "/", label: "マップ", icon: MdOutlineMap },
  { href: "/exhibitions", label: "出展情報", icon: MdOutlineListAlt },
];
const STAMP_ITEM: NavItem = { href: "/stamp", label: "スタンプ", icon: LuStamp };
const RIGHT_ITEMS: NavItem[] = [
  { href: "/timetable", label: "イベント", icon: MdOutlineEvent },
  { href: "/info", label: "情報", icon: MdInfoOutline },
];

/** "/" は完全一致、それ以外は配下のページも含めて選択中にする */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.some((path) => isActive(pathname, path))) return null;

  const stampActive = isActive(pathname, STAMP_ITEM.href);

  return (
    // iPhone のホームバーと重ならないよう、セーフエリアがあればその分だけ上げる
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-60 mx-auto w-full max-w-md px-4"
    >
      <div className="flex h-18 items-center rounded-full border border-gray-300 bg-background shadow-[0_4px_12px_rgb(0_0_0/0.15)] dark:border-gray-700">
        {LEFT_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        {/* スタンプだけは青い丸で、バーの上下に少しはみ出す */}
        <div className="flex w-24 shrink-0 justify-center">
          <Link
            href={STAMP_ITEM.href}
            aria-current={stampActive ? "page" : undefined}
            className="flex size-22 flex-col items-center justify-center gap-0.5 rounded-full bg-[#0048FF] text-white shadow-md transition active:scale-95"
          >
            <STAMP_ITEM.icon aria-hidden className="size-9" />
            <span className="text-xs font-bold">{STAMP_ITEM.label}</span>
          </Link>
        </div>

        {RIGHT_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 transition active:scale-95",
        active ? "text-[#0048FF] dark:text-blue-400" : "text-gray-400",
      )}
    >
      <item.icon aria-hidden className="size-7" />
      <span className="text-xs font-bold whitespace-nowrap">{item.label}</span>
    </Link>
  );
}
