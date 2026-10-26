import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker本番イメージ用に必要なファイルだけを .next/standalone に出力する
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
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
