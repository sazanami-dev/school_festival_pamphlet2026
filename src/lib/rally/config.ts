/**
 * スタンプラリーの設定（チェックポイント・景品）。公開してよい情報だけなので画面からも読む。
 * トークンはここに置かない（checkpoint-token.ts で計算する）。
 */
import checkpointData from "@/data/checkpoints.json";
import exhibitionData from "@/data/ExhibitionInfo.json";
import rallyData from "@/data/rally.json";

/** checkpoints.json の1件分 */
export type Checkpoint = {
  id: string;
  name: string;
  /** ExhibitionInfo.json の id（マップで場所を開くのに使う）。出展のない場所では省く */
  exhibitionId?: string;
  /** マップの教室ID（例: "f1-reception-1"）。出展のない場所用で、あれば exhibitionId より優先する */
  room?: string;
  floor: string;
  location: string;
  /** 未獲得のときに出す場所のヒント */
  hint: string;
};

export type RallyConfig = {
  requiredStamps: number;
  prizeName: string;
  exchangePlace: { name: string; floor: string; location: string };
};

// 型を付けて代入することで、JSON の形が型と違えばエラーで気づける
export const checkpoints: Checkpoint[] = checkpointData;
export const rallyConfig: RallyConfig = rallyData;

const checkpointById = new Map(checkpoints.map((cp) => [cp.id, cp]));

export function getCheckpoint(id: string): Checkpoint | undefined {
  return checkpointById.get(id);
}

/** 例: "3F T32"（階が空なら場所だけ） */
export function formatFloorPlace(place: { floor: string; location: string }): string {
  return [place.floor && `${place.floor}F`, place.location].filter(Boolean).join(" ");
}

/**
 * マップでそのチェックポイントの場所を開くリンク。例: /?floor=3&room=T32
 * 部屋は room、なければ出展データの location（マップの教室ID）を使う（ExhibitionDetailModal の mapHref と同じ形）
 * どちらもなければ階のマップを開くだけ
 */
export function checkpointMapHref(checkpoint: Checkpoint): string {
  const params = new URLSearchParams({ floor: checkpoint.floor });
  const exhibition = exhibitionData.find((e) => e.id === checkpoint.exhibitionId);
  const room = checkpoint.room ?? exhibition?.location.split(",")[0].trim();
  if (room) params.set("room", room);
  return `/?${params.toString()}`;
}
