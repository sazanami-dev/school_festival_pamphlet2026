import { Suspense } from "react";
import Link from "next/link";
import StaffLoginForm from "@/app/staff/StaffLoginForm";
import { formatFloorPlace, rallyConfig } from "@/lib/rally/config";
import { isAdmin } from "@/lib/rally/session";
import { getRallyStats, isDateText, type RallyStats } from "@/lib/rally/stats";
import { cn } from "@/lib/utils";
import { adminLoginAction } from "./actions";
import RefreshButton from "./RefreshButton";

/**
 * 管理画面（設計書 3章, 9.4）。スタンプラリーの参加状況を数で出す
 * PINが正しければ当日中有効の Cookie を発行し、同じURLに集計を出す
 * ?date=2026-11-21 を付けると、その日（日本時間）の分だけを出す
 */
export default function ConsolePage({ searchParams }: PageProps<"/console">) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">読み込み中…</p>}>
        <ConsoleGate searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ConsoleGate({ searchParams }: { searchParams: PageProps<"/console">["searchParams"] }) {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-2">
        <h1 className="text-xl font-bold">管理画面</h1>
        <StaffLoginForm action={adminLoginAction} />
      </div>
    );
  }

  const { date: dateParam } = await searchParams;
  // 形の違う値は無視して全期間を出す
  const date = typeof dateParam === "string" && isDateText(dateParam) ? dateParam : undefined;
  return <Dashboard stats={await getRallyStats(date)} date={date} updatedAt={new Date()} />;
}

function dayHref(date: string | undefined): string {
  return date ? `/console?date=${date}` : "/console";
}

/** "10:42" のように日本時間の時刻にする */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
}

/** "2026-11-21" → "11/21（土）" */
function formatDay(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

/** 割合を "42%" の形にする。分母が0なら "—" */
function formatRate(count: number, total: number): string {
  return total > 0 ? `${Math.round((count / total) * 100)}%` : "—";
}

function Dashboard({ stats, date, updatedAt }: { stats: RallyStats; date?: string; updatedAt: Date }) {
  // 割合の分母。全期間は参加者、日付指定はその日にスタンプを取った人（前の日に参加した人も取るため）
  const rateBase = date ? stats.activeParticipants : stats.participants;
  // 記録のない日を指定されたときも、選択中の日付として出す
  const dates = [...new Set([...stats.byDay.map((day) => day.date), ...(date ? [date] : [])])].sort();

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">スタンプラリー 参加状況</h1>
          <p className="text-sm text-muted-foreground">{formatTime(updatedAt)} 時点（1分ごとに自動更新）</p>
        </div>
        <RefreshButton />
      </header>

      <nav aria-label="集計する日付" className="flex flex-wrap gap-2">
        <DayLink href={dayHref(undefined)} selected={!date}>
          全期間
        </DayLink>
        {dates.map((day) => (
          <DayLink key={day} href={dayHref(day)} selected={day === date}>
            {formatDay(day)}
          </DayLink>
        ))}
      </nav>

      <section aria-label={date ? `${formatDay(date)}の数` : "全体の数"} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={date ? "新規参加" : "参加者"} value={stats.participants} unit="人" />
        <StatTile
          label={date ? `達成（${rallyConfig.requiredStamps}個目を取った）` : `達成（${rallyConfig.requiredStamps}個以上）`}
          value={stats.completed}
          unit="人"
          note={date ? undefined : `参加者の ${formatRate(stats.completed, stats.participants)}`}
        />
        <StatTile
          label="景品交換"
          value={stats.redeemed}
          unit="人"
          note={date ? undefined : `達成者の ${formatRate(stats.redeemed, stats.completed)}`}
        />
        <StatTile
          label="スタンプ"
          value={stats.totalStamps}
          unit="個"
          note={
            date
              ? `${stats.activeParticipants.toLocaleString("ja-JP")}人が取得`
              : stats.participants > 0
                ? `1人あたり ${(stats.totalStamps / stats.participants).toFixed(1)}個`
                : undefined
          }
        />
      </section>

      <Section
        title="チェックポイントごとの獲得数"
        note={
          date
            ? "割合はこの日にスタンプを取った人のうち、そのスタンプを取った人"
            : "割合は参加者のうち、そのスタンプを取った人"
        }
      >
        <ul className="space-y-3">
          {stats.byCheckpoint.map(({ checkpoint, count }) => (
            <li key={checkpoint.id}>
              <BarRow
                label={checkpoint.name}
                sub={formatFloorPlace(checkpoint)}
                count={count}
                total={rateBase}
                unit="個"
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={date ? "この日に集めた数ごとの人数" : "集めた数ごとの人数"}
        note={
          date
            ? "この日にスタンプを取った人だけを、この日の分の数で数える"
            : `${rallyConfig.requiredStamps}個以上で景品と交換できる`
        }
      >
        <ul className="space-y-2">
          {stats.distribution.map((people, stampCount) =>
            // 日付指定では「0個の人」を数えられないので出さない
            date && stampCount === 0 ? null : (
              <li key={stampCount}>
                <BarRow
                  label={`${stampCount}個`}
                  count={people}
                  total={rateBase}
                  unit="人"
                  highlight={!date && stampCount >= rallyConfig.requiredStamps}
                />
              </li>
            ),
          )}
        </ul>
      </Section>

      <Section title="日別" note="日付を押すと、その日の集計に切り替わる">
        {stats.byDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ記録がありません。</p>
        ) : (
          <table className="w-full text-right tabular-nums">
            <thead className="text-sm text-muted-foreground">
              <tr>
                <th className="pb-2 text-left font-normal">日付</th>
                <th className="pb-2 font-normal">新規参加</th>
                <th className="pb-2 font-normal">スタンプ</th>
                <th className="pb-2 font-normal">景品交換</th>
              </tr>
            </thead>
            <tbody>
              {stats.byDay.map((day) => (
                <tr key={day.date} className={cn("border-t", day.date === date && "bg-muted")}>
                  <th className="py-2 text-left font-bold">
                    <Link href={dayHref(day.date)} className="text-[#0048FF] underline underline-offset-2 dark:text-blue-400">
                      {formatDay(day.date)}
                    </Link>
                  </th>
                  <td className="py-2">{day.participants}人</td>
                  <td className="py-2">{day.stamps}個</td>
                  <td className="py-2">{day.redemptions}人</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

function DayLink({ href, selected, children }: { href: string; selected: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-bold",
        selected ? "border-[#0048FF] bg-[#0048FF] text-white" : "bg-background",
      )}
    >
      {children}
    </Link>
  );
}

function StatTile({ label, value, unit, note }: { label: string; value: number; unit: string; note?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">
        {value.toLocaleString("ja-JP")}
        <span className="text-base font-normal text-muted-foreground"> {unit}</span>
      </p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="font-bold">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** 名前・数・割合と、割合の長さの棒 */
function BarRow({
  label,
  sub,
  count,
  total,
  unit,
  highlight = false,
}: {
  label: string;
  sub?: string;
  count: number;
  total: number;
  unit: string;
  highlight?: boolean;
}) {
  const percent = total > 0 ? Math.min(100, (count / total) * 100) : 0;
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm">
          <span className="font-bold">{label}</span>
          {sub && <span className="ml-2 text-xs text-muted-foreground">{sub}</span>}
        </p>
        <p className="shrink-0 text-sm tabular-nums">
          <span className="font-bold">{count.toLocaleString("ja-JP")}</span>
          {unit}
          <span className="ml-2 inline-block w-10 text-right text-xs text-muted-foreground">
            {formatRate(count, total)}
          </span>
        </p>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={highlight ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-[#0048FF]"}
          style={{ width: `${percent}%` }}
        />
      </div>
    </>
  );
}
