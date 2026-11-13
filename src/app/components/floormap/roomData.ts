// マップの教室（SVGの <g id="T22">）と、出展・イベントのデータを結び付ける
// 紐付けは「階」と「SVGのID = JSON の location」が一致するかで判定する
import { useSyncExternalStore } from "react";
import exhibitionData from "@/data/ExhibitionInfo.json";
import eventData from "@/data/event.json";
import facilityData from "@/data/facility.json";
import type { Exhibition } from "@/components/ExhibitionDetailModal";
import type { Floor } from "./floors";

export type { Exhibition };

export type FestivalEvent = {
  id: string;
  eventName: string;
  genre: string[];
  startTime: string;
  endTime: string;
  floor: string;
  location: string;
  description: string;
};

export type RoomInfo = {
  exhibitions: Exhibition[];
  events: FestivalEvent[];
};

/** facility.json の1件分（出展ではないが、タップすると案内を出す設備。マックスマートや休憩室など） */
export type Facility = {
  id: string;
  name: string;
  floor: string;
  /** SVG の ID（例: "f5-smart-store-1"） */
  location: string;
  /** 説明文。空なら表示しない */
  description: string;
  /** 良いお知らせとして緑で表示する案内（例: 休憩室の「飲食できます」） */
  highlights: string[];
  /** 使える支払い方法。空なら表示しない */
  payments: string[];
  /** 目立たせて表示する注意書き（例: 「現金は使えません」） */
  notes: string[];
};

const exhibitions: Exhibition[] = exhibitionData;
const events: FestivalEvent[] = eventData;
const facilities: Facility[] = facilityData;

/** "T51,T53" のように複数の場所が書かれていたら分ける */
function splitLocation(location: string) {
  return location
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 階 → 教室ID → その教室の出展・イベント の対応表 */
function buildRoomIndex() {
  const index = new Map<string, Map<string, RoomInfo>>();
  const roomOf = (floor: string, room: string) => {
    let rooms = index.get(floor);
    if (!rooms) index.set(floor, (rooms = new Map()));
    let info = rooms.get(room);
    if (!info) rooms.set(room, (info = { exhibitions: [], events: [] }));
    return info;
  };
  for (const ex of exhibitions) {
    for (const room of splitLocation(ex.location)) roomOf(ex.floor, room).exhibitions.push(ex);
  }
  for (const ev of events) {
    for (const room of splitLocation(ev.location)) roomOf(ev.floor, room).events.push(ev);
  }
  return index;
}

const roomIndex = buildRoomIndex();
const noRooms: ReadonlyMap<string, RoomInfo> = new Map();

/** その階で、出展かイベントがある教室の一覧 */
export function getRoomsOnFloor(floor: Floor): ReadonlyMap<string, RoomInfo> {
  return roomIndex.get(String(floor)) ?? noRooms;
}

/** 階 → SVGのID → 設備の案内 */
const facilityIndex = new Map<string, Map<string, Facility>>();
for (const facility of facilities) {
  let onFloor = facilityIndex.get(facility.floor);
  if (!onFloor) facilityIndex.set(facility.floor, (onFloor = new Map()));
  onFloor.set(facility.location, facility);
}
const noFacilities: ReadonlyMap<string, Facility> = new Map();

/** その階で、タップすると案内を出す設備の一覧 */
export function getFacilitiesOnFloor(floor: Floor): ReadonlyMap<string, Facility> {
  return facilityIndex.get(String(floor)) ?? noFacilities;
}

/** 教室IDの順（T9 → T10 のように数字として比べる） */
const byLocation = new Intl.Collator("ja", { numeric: true }).compare;

/** その階の出展を教室順に並べたもの */
export function getExhibitionsOnFloor(floor: Floor): Exhibition[] {
  return exhibitions
    .filter((ex) => ex.floor === String(floor))
    .sort((a, b) => byLocation(a.location, b.location));
}

/** 出展の教室IDの一覧（"T51,T53" なら ["T51", "T53"]） */
export function locationsOf(exhibition: Exhibition) {
  return splitLocation(exhibition.location);
}

/** "10:30" → 630（0時からの分） */
export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 日本時間の今の時刻を 0時からの分で返す（学園祭当日に使う前提なので日付は見ない） */
export function nowInMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get("hour") * 60 + get("minute");
}

/** イベントが今開催中か（開始時刻ちょうどから、終了時刻の直前まで） */
export function isOngoing(event: FestivalEvent, now: number) {
  return toMinutes(event.startTime) <= now && now < toMinutes(event.endTime);
}

/** 30秒ごとに今の時刻（0時からの分）を知らせる */
function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

/** 今の時刻（0時からの分）。30秒ごとに更新される。サーバーでの描画中は null */
export function useNowInMinutes() {
  return useSyncExternalStore(subscribeClock, nowInMinutes, () => null);
}
