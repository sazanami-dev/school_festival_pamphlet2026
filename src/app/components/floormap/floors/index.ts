// このファイルは scripts/build-floormaps.mjs で生成。直接編集しない
export const floors = [1,2,3,4,5,6,7,8] as const;
export type Floor = (typeof floors)[number];

/** 階ごとに別チャンクとして読み込む（一度読んだ階はブラウザにキャッシュされる） */
export const loadFloor = {
  1: () => import("./1"),
  2: () => import("./2"),
  3: () => import("./3"),
  4: () => import("./4"),
  5: () => import("./5"),
  6: () => import("./6"),
  7: () => import("./7"),
  8: () => import("./8"),
} satisfies Record<Floor, () => Promise<{ svg: string }>>;
