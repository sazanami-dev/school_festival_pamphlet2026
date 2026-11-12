/**
 * スタンプラリーのチェックポイント掲示物を作る（設計書 9.2 の A 案）
 *
 *   node --env-file=.env.production scripts/build-checkpoint-posters.ts
 *   （npm run posters でも可。そのときは CHECKPOINT_SECRET を環境変数で渡す）
 *
 * src/data/checkpoints.json から、A5 の掲示物を A4 横に2枚ずつ並べた HTML と、QR だけの SVG を print/ に出力する。
 * HTML をブラウザで開いて「PDFに保存」→ 印刷する。
 *
 * 出力にはトークンが入るので、print/ はコミットしない（.gitignore 済み）。
 * 空の鍵や開発用の鍵で本番と違うQRを刷らないよう、CHECKPOINT_SECRET が無ければ止まる。
 * トークンの計算はサーバーと同じ関数（checkpoint-token-core.ts）を使う。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { computeCheckpointToken } from "../src/lib/rally/checkpoint-token-core.ts";
import { formatCode } from "../src/lib/rally/code.ts";

type Checkpoint = { id: string; name: string; floor: string; location: string; hint: string };
type RallyConfig = { requiredStamps: number };

const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "print");
const BASE_URL = (process.env.RALLY_BASE_URL || "https://fes.sazanami.dev").replace(/\/+$/, "");

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
  const { checkpoint } = poster;
  const place = [checkpoint.floor && `${checkpoint.floor}F`, checkpoint.location].filter(Boolean).join(" ");
  return `
    <section class="poster">
      <p class="title">学園祭2026 スタンプラリー</p>
      <p class="number">CHECKPOINT No.${poster.number}</p>
      <p class="name">${escapeHtml(checkpoint.name)}（${escapeHtml(place)}）</p>
      <div class="qr">${poster.svg}</div>
      <p class="code">コード：${formatCode(poster.code)}</p>
      <div class="guide">
        <p>パンフレットの「スタンプ」→「QRを読む」で読み取ってね</p>
        <p>スマホのカメラで読んでもOK</p>
        <p>${rally.requiredStamps}個集めると景品と交換できます</p>
      </div>
    </section>`;
}

// A4 横の用紙1枚に A5 を2枚。切り離して使う
const sheets: string[] = [];
for (let i = 0; i < posters.length; i += 2) {
  sheets.push(`<div class="sheet">${posters.slice(i, i + 2).map(posterHtml).join("")}</div>`);
}

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>スタンプラリー チェックポイント掲示物</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; color: #000; background: #fff; }
  .sheet { width: 297mm; height: 210mm; display: flex; page-break-after: always; }
  .poster {
    width: 148.5mm; height: 210mm; padding: 14mm 12mm;
    display: flex; flex-direction: column; align-items: center; text-align: center;
    border-right: 0.2mm dashed #999;
  }
  .poster:last-child { border-right: none; }
  .title { font-size: 7mm; font-weight: bold; }
  .number { margin-top: 3mm; font-size: 6mm; letter-spacing: 0.5mm; }
  .name { margin-top: 2mm; font-size: 6mm; font-weight: bold; }
  /* 6cm角以上。QR の SVG には4マスの余白が含まれる */
  .qr { margin-top: 6mm; width: 80mm; height: 80mm; }
  .qr svg { width: 100%; height: 100%; }
  .code { margin-top: 2mm; font-size: 6mm; font-family: ui-monospace, Menlo, monospace; letter-spacing: 0.6mm; }
  .guide { margin-top: auto; font-size: 4.2mm; line-height: 1.7; }
  @media screen {
    body { background: #ddd; padding: 10mm; }
    .sheet { background: #fff; margin: 0 auto 10mm; box-shadow: 0 1mm 4mm rgb(0 0 0 / 0.2); }
  }
</style>
</head>
<body>
${sheets.join("\n")}
</body>
</html>
`;

mkdirSync(join(OUT_DIR, "qr"), { recursive: true });
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
