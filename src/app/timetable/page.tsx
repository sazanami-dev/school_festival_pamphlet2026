
"use client";

import { useRef, useState, useEffect } from "react";
import eventsData from "../../data/event.json";
import { useRouter } from "next/navigation";
import { getGenreColor } from "@/components/ExhibitionDetailModal";
import { MdPlace } from "react-icons/md";
import { cn } from "@/lib/utils";
import PageTitle from "@/components/PageTitle";

interface Event {
  id: string;
  eventName: string;
  genre: string[];
  startTime: string;
  endTime: string;
  floor: string;
  location: string;
  description: string;
}

export default function Timetable() {
  // 開催日
  const EVENT_DATE = "2026-11-14";

  // 今日の日付
  const [today, setToday] = useState<string | null>(null);

  // デバッグモード
  const [debugMode, setDebugMode] = useState(false);

  // 開催当日かどうか
  const isEventDay = today === EVENT_DATE;

  // 時間関連機能を有効にするか

  // 開発環境かどうか
  const isDevelopment = process.env.NODE_ENV === "development";
  // 時間関連機能を有効にするか
  const showTimeFeatures = isEventDay || debugMode;

  // 開発環境かどうか
  const hours = [10, 11, 12, 13, 14, 15, 16];
  const data: Event[] = eventsData;

  // 現在時刻
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      setCurrentHour(now.getHours());

      setCurrentMinutes(
        now.getHours() * 60 + now.getMinutes()
      );

      // 今日の日付を取得
      const date =
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      setToday(date);
    };

    updateTime();

    const timer = setInterval(updateTime, 60000);

    return () => clearInterval(timer);
  }, []);
  // 選択中のイベント
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // 選択中のジャンル
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const targetRef = useRef<HTMLHeadingElement | null>(null);

  // イベントに登録されているジャンル一覧
  const genres = Array.from(
    new Set(data.flatMap((event) => event.genre))
  );

  // 現在時刻の見出しへの参照

  // 現在時刻の場所までスクロール
  const scrollToElement = () => {
    if (targetRef.current) {
      targetRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };
  useEffect(() => {
    if (currentHour !== null && targetRef.current) {
      targetRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [currentHour]);


  const router = useRouter();

  // マップで場所を見る
  const handleClick = (event: Event) => {
    router.push(
      `/?floor=${event.floor}&room=${event.location}`
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 pb-(--bottom-nav-space)">
      <PageTitle className="mb-4">タイムテーブル</PageTitle>
      {isDevelopment && !isEventDay && (
        <button
          onClick={() => setDebugMode(!debugMode)}
          className="rounded-lg bg-purple-600 px-4 py-2 text-white"
        >
          {debugMode
            ? "デバッグモードを終了"
            : "デバッグ：時間機能を確認"}
        </button>
      )}
      {/* ジャンル絞り込み */}
      <h2 className="font-bold mb-4">ジャンル絞り込み</h2>

      <button
        onClick={() => setSelectedGenre(null)}
        className={`rounded-full px-4 py-2 mb-2 hover:scale-105 transform ${selectedGenre === null
          ? "bg-blue-600 text-white"
          : "bg-gray-200 text-gray-800"
          }`}
      >
        すべて
      </button>

      <div className="flex flex-wrap gap-2">
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className={`rounded-full px-4 py-2 mb-2 hover:scale-105 transform ${selectedGenre === genre
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800"
              }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* タイムテーブル */}

      {/* タイムテーブル */}
      {hours.map((hour) => {
        // その時間帯に開催されているイベントを抽出
        const hourEvents = data.filter((event) => {
          const [startH, startM] = event.startTime.split(":").map(Number);
          const [endH, endM] = event.endTime.split(":").map(Number);

          const startTime = startH * 60 + startM;
          const endTime = endH * 60 + endM;

          const hourStart = hour * 60;
          const hourEnd = (hour + 1) * 60;

          return startTime < hourEnd && endTime > hourStart;
        });

        return (

          <div key={hour} className="mb-6 " >

            {/* 時間の見出し */}
            <h2
              ref={hour === currentHour ? targetRef : null}

              className="sticky top-2 z-10 rounded-full text-center bg-gray-200 py-1 mb-3 px-5 text-xl font-bold text-gray-700"
            >
              {hour}:00
            </h2>

            {/* イベント一覧 */}
            <div className="grid gap-3">
              {hourEvents.map((event) => {
                const [startH, startM] = event.startTime.split(":").map(Number);
                const [endH, endM] = event.endTime.split(":").map(Number);

                const startTime = startH * 60 + startM;
                const endTime = endH * 60 + endM;
                //開催中中
                const isOngoing =
                  showTimeFeatures &&
                  currentMinutes !== null &&
                  currentMinutes >= startTime &&
                  currentMinutes < endTime;
                //終了
                const isFinished =
                  showTimeFeatures &&
                  currentMinutes !== null &&
                  currentMinutes >= endTime;
                //開催30分前
                const isUpcoming =
                  showTimeFeatures &&
                  currentMinutes !== null &&
                  currentMinutes >= startTime - 30 &&
                  currentMinutes < startTime;
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className={`cursor-pointer rounded-xl border p-4 shadow-sm transition-all duration-300 hover:scale-102 transform ${isOngoing
                      //開催中
                      ? " ring-2 ring-green-300 shadow-md"
                      //終了
                      : isFinished
                        ? "border-gray-200 bg-gray-100 opacity-75"
                        //開催30分前
                        : isUpcoming
                          ? "ring-2 ring-yellow-200 shadow-md"
                          //何も選択されてない状態
                          : selectedGenre === null
                            ? "border-gray-200 bg-white"
                            //ジャンル絞りこみ
                            : event.genre.includes(selectedGenre)
                              ? "border-blue-500 bg-blue-100 ring-2 ring-blue-300 shadow-md"
                              : "border-gray-200 bg-gray-200 opacity-50"
                      }`}
                  >
                    <div className="flex items-center">
                      {/*イベント名表示部分*/}
                      <h3 className={`font-bold ${isFinished && !isOngoing ? "text-gray-500" : ""}`}>
                        {event.eventName}
                      </h3>

                      {/* 開催30分前 */}
                      {isUpcoming && (
                        <span className="ml-4 rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-white">
                          間もなく開催！！
                        </span>
                      )}
                      {isOngoing && (
                        <span className="ml-4 rounded-full bg-green-600 px-3 py-1 text-sm font-bold text-white">
                          開催中!!
                        </span>
                      )}

                      {isFinished && !isOngoing && (
                        <span className="ml-4 rounded-full bg-gray-500 px-3 py-1 text-sm font-bold text-white">
                          終了!!
                        </span>
                      )}
                    </div>
                    {/*イベント開始時間～終了時間*/}
                    <p className="mt-2 text-sm text-gray-600">
                      {event.startTime} ～ {event.endTime}
                    </p>
                    {/*場所*/}
                    <p className="mt-1 flex items-center gap-1 font-semibold text-gray-800">
                      <MdPlace className="shrink-0 text-blue-600" aria-hidden />
                      {event.floor}階 {event.location}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/*ジャンル表示部分*/}
                      {event.genre.map((genre) => (
                        <span
                          key={genre}
                          className={cn("rounded-full px-3 py-1 text-xs font-medium", getGenreColor(genre).badge)}
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* 今の時間へボタン */}
      {showTimeFeatures && (
        <button
          onClick={scrollToElement}
          className="fixed bottom-[calc(var(--bottom-nav-space)+0.5rem)] right-6 z-40 rounded-full bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-blue-700 active:scale-95"
        >
          今の時間へ
        </button>
      )}


      {/* イベント詳細モーダル */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex -center justify-center bg-black/50 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >

            {/* 閉じるボタン */}
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute right-4 top-3 text-3xl text-gray-400 hover:text-gray-700"
            >
              ×
            </button>

            {/* イベント名 */}
            <h2 className="mb-4 pr-8 text-xl font-bold text-gray-800">
              {selectedEvent.eventName}
            </h2>

            {/* 開催時間 */}
            <div className="mb-4">
              <p className="mb-1 font-semibold text-gray-700">
                開催時間
              </p>
              <p className="text-gray-600">
                {selectedEvent.startTime} ～ {selectedEvent.endTime}
              </p>
            </div>

            {/* 開催場所 */}
            <div className="mb-4">
              <p className="mb-1 font-semibold text-gray-700">
                開催場所
              </p>
              <p className="text-gray-600">
                {selectedEvent.floor}階 {selectedEvent.location}
              </p>
            </div>

            {/* ジャンル */}
            <div className="mb-4">
              <p className="mb-2 font-semibold text-gray-700">
                ジャンル
              </p>

              <div className="flex flex-wrap gap-2">
                {selectedEvent.genre.map((genre) => (
                  <span
                    key={genre}
                    className={cn("rounded-full px-3 py-1 text-sm", getGenreColor(genre).badge)}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>

            {/* イベント詳細 */}
            <div className="mb-6">
              <p className="mb-2 font-semibold text-gray-700">
                イベント詳細
              </p>
              <p className="leading-7 text-gray-600">
                {selectedEvent.description}
              </p>
            </div>

            {/* マップで場所を見る */}
            <button onClick={() => handleClick(selectedEvent!)}
              className="w-auto rounded-lg bg-blue-600 p-3 mb-3 font-semibold text-white transition hover:bg-blue-700"
            >
              マップで場所を見る
            </button>


            {/* 閉じる */}
            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              閉じる
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
