/**
 * 引き継ぎコード・チェックポイントの手入力コードで共通の「8文字のコード」（設計書 5.2, 5.3）
 *
 * ブラウザ・サーバー・掲示物スクリプト（scripts/build-checkpoint-posters.ts）のどこからでも使うので、
 * このファイルは何も import しないこと（Node から直接読み込めるようにするため）。
 */

/** 0/O、1/I/L など紛らわしいものを除いた31種 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** 入力を比べられる形にそろえる（全角→半角、大文字に、ハイフン・空白を無視） */
export function normalizeCode(input: string): string {
  return input
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s\-‐‑–—−ー]/g, "");
}

/** 8文字で、すべて使える文字か */
export function isWellFormedCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));
}

/** 表示用に XXXX-XXXX の形にする */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * バイト列を8文字のコードにする。
 * バイト列を1つの大きな数とみなし、31で割った余りを8回取る（16バイト以上渡せば偏りはほぼ無い）。
 */
export function bytesToCode(bytes: Uint8Array): string {
  let value = BigInt(0);
  for (const byte of bytes) value = (value << BigInt(8)) | BigInt(byte);

  const base = BigInt(CODE_ALPHABET.length);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Number(value % base)];
    value /= base;
  }
  return code;
}
