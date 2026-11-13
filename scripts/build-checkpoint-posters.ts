/**
 * スタンプラリーのチェックポイント掲示物を作る（設計書 9.2 の A 案）
 *
 *   node --env-file=.env.production scripts/build-checkpoint-posters.ts
 *   （npm run posters でも可。そのときは CHECKPOINT_SECRET を環境変数で渡す）
 *
 * src/data/checkpoints.json から、A4 縦1枚に1か所ずつの掲示物の HTML と、QR だけの SVG を print/ に出力する。
 * デザインは scripts/学園祭2026チェックポイント背景.svg で、その白い枠に QR を重ねる。
 * HTML をブラウザで開いて「PDFに保存」→ 印刷する。
 *
 * 出力にはトークンが入るので、print/ はコミットしない（.gitignore 済み）。
 * 空の鍵や開発用の鍵で本番と違うQRを刷らないよう、CHECKPOINT_SECRET が無ければ止まる。
 * トークンの計算はサーバーと同じ関数（checkpoint-token-core.ts）を使う。
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { computeCheckpointToken } from "../src/lib/rally/checkpoint-token-core.ts";
import { formatCode } from "../src/lib/rally/code.ts";

type Checkpoint = { id: string; name: string; floor: string; location: string; hint: string };
type RallyConfig = { requiredStamps: number };

const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "print");
const BACKGROUND_SRC = join(import.meta.dirname, "学園祭2026チェックポイント背景.svg");
const BACKGROUND_FILE = "checkpoint-bg.svg";
const PRODUCTION_URL = "https://fes.sazanami.dev";
const BASE_URL = (process.env.RALLY_BASE_URL || PRODUCTION_URL).replace(/\/+$/, "");
// 本番以外の URL で作ったものは、本番の掲示物と混ざらないように目印を付ける
const TEST_MARK = BASE_URL === PRODUCTION_URL ? "" : `【テスト用 ${BASE_URL}】`;

const secret = process.env.CHECKPOINT_SECRET;
if (!secret) {
  console.error("CHECKPOINT_SECRET が設定されていません。本番と同じ値を渡してください");
  process.exit(1);
}

const checkpoints: Checkpoint[] = JSON.parse(readFileSync(join(ROOT, "src/data/checkpoints.json"), "utf8"));
const rally: RallyConfig = JSON.parse(readFileSync(join(ROOT, "src/data/rally.json"), "utf8"));

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

type Poster = { number: number; checkpoint: Checkpoint; code: string; url: string; svg: string };

const posters: Poster[] = await Promise.all(
  checkpoints.map(async (checkpoint, index) => {
    const code = computeCheckpointToken(secret, checkpoint.id);
    const url = `${BASE_URL}/s/${code}`;
    // 誤り訂正レベル M・周りに4マスの余白（設計書 9.2「QRの作り方」）
    const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 4 });
    return { number: index + 1, checkpoint, code, url, svg };
  }),
);

function posterHtml(poster: Poster): string {
  // 背景のデザインにロゴ・見出し・説明文まで入っているので、白い枠の上に出展名、枠に QR、その下に手打ち用のコードを置くだけ
  return `
    <section class="poster">
      <img class="bg" src="${BACKGROUND_FILE}" alt="">
      <p class="name">${escapeHtml(poster.checkpoint.name)}</p>
      <div class="qr">${poster.svg}</div>
      <p class="code">${formatCode(poster.code)}</p>
      ${TEST_MARK && `<p class="test">${escapeHtml(TEST_MARK)}</p>`}
    </section>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>スタンプラリー チェックポイント掲示物</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; color: #000; background: #fff; }
  /* A4 縦の用紙1枚に1か所。背景 SVG（1326×1877）の座標を --u 倍して mm にする */
  .poster {
    --u: calc(210mm / 1326);
    position: relative; width: 210mm; height: 297mm; overflow: hidden;
    page-break-after: always;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; }
  /* 背景の白い枠（x=328, y=597, 682角）。約108mm角で、QR の SVG には4マスの余白が含まれる */
  .qr {
    position: absolute; left: calc(328 * var(--u)); top: calc(597 * var(--u));
    width: calc(682 * var(--u)); height: calc(682 * var(--u));
  }
  .qr svg { display: block; width: 100%; height: 100%; }
  /* 「チェックポイント」の帯（下端 y=457）と白い枠の間。枠のすぐ上に下揃えで置く */
  .name {
    position: absolute; left: 0; right: 0; bottom: calc((1877 - 572) * var(--u));
    text-align: center; font-size: 9mm; font-weight: bold; line-height: 1.2;
  }
  /* 「参加もこちらから」と下の帯（y=1515）の間 */
  .code {
    position: absolute; left: 0; right: 0; top: calc(1378 * var(--u));
    text-align: center; font-size: 12mm; font-weight: bold; line-height: 1.2;
    font-family: ui-monospace, Menlo, monospace; letter-spacing: 1mm;
  }
  .test {
    position: absolute; left: 0; right: 0; top: calc(1478 * var(--u));
    text-align: center; font-size: 3.2mm; color: #333;
  }
  @media screen {
    body { background: #999; padding: 10mm; }
    .poster { margin: 0 auto 10mm; box-shadow: 0 1mm 4mm rgb(0 0 0 / 0.3); }
  }
</style>
</head>
<body>
${posters.map(posterHtml).join("\n")}
</body>
</html>
`;

mkdirSync(join(OUT_DIR, "qr"), { recursive: true });
// 背景は 12MB ほどあるので HTML に埋め込まず、隣にコピーして参照する
copyFileSync(BACKGROUND_SRC, join(OUT_DIR, BACKGROUND_FILE));
writeFileSync(join(OUT_DIR, "checkpoints.html"), html);
for (const poster of posters) {
  writeFileSync(join(OUT_DIR, "qr", `${poster.checkpoint.id}.svg`), poster.svg);
}

console.log(`${posters.length}件のチェックポイントを print/ に出力しました（${BASE_URL}）`);
for (const poster of posters) {
  console.log(`  No.${poster.number} ${poster.checkpoint.id} ${formatCode(poster.code)} ${poster.checkpoint.name}`);
}
if (posters.length < rally.requiredStamps) {
  console.warn(`注意: チェックポイントが ${rally.requiredStamps} か所より少ないため、景品と交換できません`);
}
