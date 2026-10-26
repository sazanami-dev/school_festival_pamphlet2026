# 学園祭2026 デジタルパンフレット

Next.js 16 (App Router / Cache Components) + PostgreSQL 18 + Drizzle ORM。Docker で開発・本番を分けて動かします。

## 構成

```
Dockerfile           マルチステージ（dev / migrator / runner）
compose.yaml         開発用: Next.js(dev, ホットリロード) + PostgreSQL(ホスト:5433)
compose.prod.yaml    本番用: migrate(1回実行) → Next.js(standalone) + PostgreSQL(非公開)
drizzle.config.ts    drizzle-kit 設定
drizzle/             生成されたマイグレーションSQL（コミットする）
src/db/schema.ts     テーブル定義（まだ空）
src/db/index.ts      DBクライアント（getDb()）
src/app/api/health   ヘルスチェック（DB疎通まで確認）
```

## 開発環境

```bash
cp .env.example .env
docker compose up -d --build
```

http://localhost:3000 を開く。ソースはマウントされているので保存すると反映されます。

### テーブルを追加・変更したとき

```bash
# 1. src/db/schema.ts を編集
docker compose exec app npm run db:generate   # drizzle/ にSQLが生成される
docker compose exec app npm run db:migrate
```

Drizzle Studio（DBの中身をブラウザで確認）はホストから: `npm install` のあと `npm run db:studio`
（`.env` の `DATABASE_URL` で localhost:5433 に接続します）

### パッケージを追加したとき

`node_modules` はコンテナ内の匿名ボリュームなので、追加後はイメージを作り直します。

```bash
npm install <pkg>
docker compose up -d --build --renew-anon-volumes
```

## 本番環境

```bash
cp .env.example .env.production   # パスワードは必ず強いものに変更
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
```

- `migrate` サービスが未適用のマイグレーションを流し、成功してから `app` が起動します（マイグレーションが無ければスキップ）
- `app` は `output: "standalone"` の最小構成イメージで非rootユーザー実行
- DB のポートは外部公開しません。データは `db-data` ボリュームに保存されます

## DBアクセスの注意（Cache Components）

`next build` 時は DB が無いので、ページでクエリを書くときはビルド時に実行されないようにします。

```ts
import { connection } from "next/server";
import { getDb } from "@/db";

export async function getItems() {
  await connection(); // ここでプリレンダーが止まり、以降はリクエスト時に実行される
  return getDb().select().from(items);
}
```

取得結果をキャッシュしたい場合は、`connection()` の後に `"use cache"` + `cacheLife()` を付けた関数を呼びます。
