// Figma から書き出したフロアマップSVGを、アプリで埋め込める形に変換する
//   入力: assets/floormaps/floormap_<階>.svg
//   出力: src/app/components/floormap/floors/<階>.ts と index.ts
// 実行: npm run floormaps（SVGを書き出し直したときだけ）
import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { optimize } from "svgo";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "assets/floormaps");
const OUT_DIR = path.join(ROOT, "src/app/components/floormap/floors");
const DATA_FILES = ["src/data/ExhibitionInfo.json", "src/data/event.json"];

// 残すID: 教室(T22) と 設備(f2-toilet-men-1)
const ROOM_ID = /^T\d+$/;
const FACILITY_ID = /^f\d+-[a-z0-9-]+$/;
const HEADER = "// このファイルは scripts/build-floormaps.mjs で生成。直接編集しない\n";

/** url(#id) や href="#id" で参照されているIDを集める（clipPath・mask 用） */
function collectReferencedIds(svg) {
  const ids = new Set();
  for (const m of svg.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)) {
    ids.add(m[1] ?? m[2]);
  }
  return ids;
}

/**
 * IDを整理する svgo プラグイン
 * - 教室・設備のIDはそのまま残す
 * - 参照されているID（clip/mask）は他の階と衝突しないよう階の接頭辞を付ける
 * - それ以外（Figmaのレイヤー名由来の文字化け・Group・Vector など）は削除する
 */
function tidyIdsPlugin(floor, referenced) {
  const prefix = `fm${floor}-`;
  const rename = (id) => (referenced.has(id) ? prefix + id : id);
  return {
    name: "tidyIds",
    fn: () => ({
      element: {
        enter(node) {
          for (const [name, value] of Object.entries(node.attributes)) {
            if (name === "id") {
              // multipass で2周目以降も呼ばれるので、接頭辞付き（処理済み）は残す
              if (ROOM_ID.test(value) || FACILITY_ID.test(value) || value.startsWith(prefix)) continue;
              if (referenced.has(value)) node.attributes.id = prefix + value;
              else delete node.attributes.id;
            } else if (value.includes("url(#")) {
              node.attributes[name] = value.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${rename(id)})`);
            } else if ((name === "href" || name === "xlink:href") && value.startsWith("#")) {
              node.attributes[name] = "#" + rename(value.slice(1));
            }
          }
        },
      },
    }),
  };
}

function convert(floor, raw) {
  const referenced = collectReferencedIds(raw);
  // 日本語のレイヤー名は &#195;&#166;… のような文字化けした ID になる。数が多いと svgo が読み込めないので先に消す
  // （どこからも参照されず、tidyIds でも消す ID）
  const cleaned = raw.replace(/\sid="[^"]*&#[^"]*"/g, "");
  const { data } = optimize(cleaned, {
    multipass: true,
    plugins: [
      tidyIdsPlugin(floor, referenced),
      {
        name: "preset-default",
        params: {
          overrides: {
            // IDは tidyIds で整理済み。短縮されると教室IDが壊れる
            cleanupIds: false,
            convertPathData: { floatPrecision: 1 },
            cleanupNumericValues: { floatPrecision: 1 },
          },
        },
      },
      // 画面幅に合わせて伸縮できるよう width/height を消し viewBox だけ残す
      "removeDimensions",
    ],
  });
  const rooms = [...data.matchAll(/id="(T\d+)"/g)].map((m) => m[1]);
  const facilities = [...data.matchAll(/id="(f\d+-[a-z0-9-]+)"/g)].map((m) => m[1]);
  return { svg: data, rooms, facilities };
}

/** JSON の location がSVGに無いものを警告する */
async function checkData(results) {
  const warnings = [];
  for (const file of DATA_FILES) {
    const items = JSON.parse(await readFile(path.join(ROOT, file), "utf8"));
    for (const item of items) {
      const floor = Number(item.floor);
      const result = results.get(floor);
      const known = new Set(result ? [...result.rooms, ...result.facilities] : []);
      const locations = String(item.location ?? "").split(",").map((s) => s.trim());
      for (const loc of locations) {
        if (!known.has(loc)) warnings.push(`${file} ${item.id}: ${item.floor}F "${loc}" がSVGにありません`);
      }
    }
  }
  return warnings;
}

const files = (await readdir(SRC_DIR)).filter((f) => /^floormap_\d+\.svg$/.test(f));
const results = new Map();

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

for (const file of files) {
  const floor = Number(file.match(/\d+/)[0]);
  const raw = await readFile(path.join(SRC_DIR, file), "utf8");
  const result = convert(floor, raw);
  results.set(floor, result);
  await writeFile(
    path.join(OUT_DIR, `${floor}.ts`),
    HEADER +
      `export const svg = ${JSON.stringify(result.svg)};\n` +
      `export const rooms = ${JSON.stringify(result.rooms)} as const;\n`,
  );
  const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
  console.log(`${floor}F: ${kb(raw.length)} → ${kb(result.svg.length)}  教室 ${result.rooms.join(" ")}`);
}

const floors = [...results.keys()].sort((a, b) => a - b);
await writeFile(
  path.join(OUT_DIR, "index.ts"),
  HEADER +
    `export const floors = ${JSON.stringify(floors)} as const;\n` +
    "export type Floor = (typeof floors)[number];\n\n" +
    "/** 階ごとに別チャンクとして読み込む（一度読んだ階はブラウザにキャッシュされる） */\n" +
    "export const loadFloor = {\n" +
    floors.map((f) => `  ${f}: () => import("./${f}"),\n`).join("") +
    "} satisfies Record<Floor, () => Promise<{ svg: string }>>;\n",
);

const warnings = await checkData(results);
if (warnings.length > 0) {
  console.warn(`\n⚠ データとSVGの不一致 ${warnings.length}件`);
  for (const w of warnings) console.warn("  " + w);
}
