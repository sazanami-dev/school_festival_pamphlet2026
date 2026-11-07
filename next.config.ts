import type { NextConfig } from "next";

const pollIntervalMs = Number(process.env.NEXT_POLL_INTERVAL_MS ?? 0);

// スマホ等からIP直打ちで dev サーバにアクセスするためのホスト名(カンマ区切り)。
// 未許可のオリジンだと dev 用JSが拒否され、ハイドレーションされずボタン等が反応しない
const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),
  // Docker本番イメージ用に必要なファイルだけを .next/standalone に出力する
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Windows(WSL2)のバインドマウントではファイル変更通知がコンテナに届かないため、
  // NEXT_POLL_INTERVAL_MS が指定されたときだけポーリングで変更を検知する
  ...(pollIntervalMs > 0 && { watchOptions: { pollIntervalMs } }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
