"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** この画面を開いている間に、もうアニメーションを見せたスタンプのID（戻るボタンで戻ったときに繰り返さない） */
const played = new Set<string>();

/**
 * いま押したスタンプの丸。スタンプを押すアニメーションは1回だけ見せる
 *
 * 見せたあとは URL から ?got= を消し、再読み込みしても繰り返さないようにする。
 * replaceState はページを読み直さないので、上のお知らせはそのまま残る。
 *
 * cacheComponents では、離れたページを消さずに display: none で隠して残し（Activity）、戻ると表示し直す。
 * 表示し直すと CSS アニメーションは最初から再生されるので、終わったらクラスを外す。
 */
export default function StampPress({
  stampId,
  className,
  children,
}: {
  /** いま押したスタンプのID。無いときはアニメーションしない */
  stampId?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [play, setPlay] = useState(() => stampId !== undefined && !played.has(stampId));

  useEffect(() => {
    if (!stampId) return;
    played.add(stampId);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("got")) return;
    url.searchParams.delete("got");
    url.searchParams.delete("already");
    window.history.replaceState(null, "", url);
  }, [stampId]);

  return (
    <div
      onAnimationEnd={(e) => e.target === e.currentTarget && setPlay(false)}
      className={cn(className, play && "relative z-10 motion-safe:animate-stamp-press")}
    >
      {children}
    </div>
  );
}
