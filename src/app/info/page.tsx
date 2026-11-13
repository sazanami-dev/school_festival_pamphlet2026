import type { Metadata } from "next";
import { FaGithub, FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { MdExpandMore, MdLanguage } from "react-icons/md";
import PageTitle from "@/components/PageTitle";

export const metadata: Metadata = {
  title: "情報 | トライデント学園祭2026 デジタルパンフレット",
};

/** 制作サークルのリンク（増やすときはここに足す） */
const CIRCLE_LINKS = [
  { href: "https://sazanami.dev/", label: "HP", icon: MdLanguage },
  { href: "https://x.com/sazanami_Dev", label: "X", icon: FaXTwitter },
  { href: "https://www.instagram.com/sazanami.dev/", label: "Instagram", icon: FaInstagram },
  { href: "https://github.com/sazanami-dev", label: "GitHub", icon: FaGithub },
];

export default function InfoPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-(--bottom-nav-space)">
      <PageTitle className="-mx-4">情報</PageTitle>
      <AboutFestival />
      <AboutCircle />
    </div>
  );
}

/** 学園祭について（紙のパンフレット「学校について」のページと同じ内容） */
function AboutFestival() {
  return (
    <section aria-labelledby="festival-title" className="space-y-3 rounded-xl border p-5 text-sm leading-relaxed">
      <h2 id="festival-title" className="text-center text-xl font-bold">
        新校舎初の学園祭！！！
      </h2>
      <div className="rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-950">
        <span className="inline-block rounded-md bg-[#0048FF] px-2 py-0.5 text-xs font-bold text-white">テーマ</span>
        <p className="mt-1.5 text-xl font-bold text-[#0048FF] dark:text-blue-400">Hello New Trident!</p>
      </div>
      <p>
        今回始まるのは、トライデント新校舎というプログラム。プログラミングではじめに学ぶ &quot;Hello World!&quot;
        のオマージュで決定されました！
      </p>
      <p>「新たなトライデントで始まる、新たな学園祭を迎え入れる」という思いもこもっています。</p>
      <p className="font-bold">
        ステージ、飲食、物販、体験など！！
        <br />
        新しくなった綺麗な校舎で一日中楽しめること間違いなし！
      </p>
    </section>
  );
}

/** このサイトを制作したサークルの紹介 */
function AboutCircle() {
  return (
    <section aria-labelledby="circle-title" className="space-y-3 rounded-xl border p-5">
      <h2 id="circle-title" className="font-bold">
        このサイトについて
      </h2>
      {/* eslint-disable-next-line @next/next/no-img-element -- 小さいSVGなので最適化は不要 */}
      <img src="/sazanami_dev.svg" alt="さざなみ開発" className="h-8 w-auto rounded bg-white p-1" />
      <p className="text-sm leading-relaxed">
        このデジタルパンフレットは、サークル「さざなみ開発」が制作しました。
      </p>
      <ul className="flex flex-wrap gap-2">
        {CIRCLE_LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
            >
              <Icon aria-hidden />
              {label}
            </a>
          </li>
        ))}
      </ul>
      {/* タップで下に開く（details なのでクライアントの JS は不要） */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-[#0048FF] px-4 py-3 text-sm font-bold text-white [&::-webkit-details-marker]:hidden">
          さざなみ開発について詳しく見る
          <MdExpandMore aria-hidden className="size-5 transition-transform group-open:rotate-180" />
        </summary>
        <CircleDetail />
      </details>
    </section>
  );
}

/** 活動内容（上から順に表示） */
const ACTIVITIES = [
  {
    title: "勉強会",
    body: ["授業だけでは身につけられない知見を得ることができます", "新しい技術を学んで視野を広げていきましょう！"],
  },
  {
    title: "部内ハッカソン",
    body: [
      "個人もしくはチームを組んで短期開発を行います",
      "縦の繋がりが強いので、上級生からのフィードバックがもらえてよりポートフォリオをブラッシュアップすることができます",
    ],
  },
  {
    title: "LT会",
    body: [
      "技術や就活をテーマにした短時間のプレゼンテーションです",
      "積極的に登壇することでプレゼン能力を磨き上げることができます",
    ],
  },
  {
    title: "定例会",
    body: ["自分が今月取り組んだことや発見した課題、来月取り組むことを毎月末発表します"],
  },
  {
    title: "外部イベント",
    body: [
      "テックカンファレンスやコンテストなどの情報を定期的に発信しています",
      "学内だけでなく学外のイベントにも挑戦してみませんか？",
    ],
  },
];

/** 「詳しく見る」を開いたときの中身（サークルの紹介と活動内容） */
function CircleDetail() {
  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2 text-center">
        <h3 className="font-bold">さざなみ開発ではこんなことやってます！！</h3>
        <p className="text-sm leading-relaxed">
          初心者でも安心して取り組める環境を用意しています
          <br />
          はじめの一歩をぜひ さざなみ開発 で踏んでみませんか？
        </p>
      </div>
      <ul className="space-y-3">
        {ACTIVITIES.map(({ title, body }) => (
          <li key={title} className="space-y-2 rounded-lg bg-muted p-4">
            <h4 className="inline-block rounded-md bg-[#0048FF] px-2 py-0.5 text-sm font-bold text-white">{title}</h4>
            {body.map((line) => (
              <p key={line} className="text-sm leading-relaxed">
                {line}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
