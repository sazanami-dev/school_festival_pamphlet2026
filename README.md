# 学園祭2026 デジタルパンフレット

Next.js 16 (App Router / Cache Components) + PostgreSQL 18 + Drizzle ORM。Docker で開発・本番を分けて動かします。

## 構成

```
Dockerfile           マルチステージ（dev / migrator / runner）
compose.yaml         開発用: Next.js(dev, ホットリロード) + PostgreSQL(ホスト:5433)
compose.prod.yaml    本番用: migrate(1回実行) → Next.js(standalone) + PostgreSQL(非公開)
drizzle.config.ts    drizzle-kit 設定
drizzle/             生成されたマイグレーションSQL（コミットする）
src/db/schema.ts     テーブル定義（スタンプラリー）
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

## スタンプラリー

設計は [docs/stamp-rally-design.md](docs/stamp-rally-design.md)。

```
src/data/checkpoints.json   チェックポイント（公開してよい情報だけ。今は仮のデータ）
src/data/rally.json         必要数・景品名・交換所
src/lib/rally/              サーバー側の処理（service.ts が中身。Server Action と /s/[token] から呼ぶ）
src/app/stamp/              参加者の画面と Server Action
src/app/s/[token]/route.ts  チェックポイントQRのリンク先（Route Handler）
src/app/staff/              交換所スタッフの画面（PINでログイン）
scripts/build-checkpoint-posters.ts  掲示物（QR入りHTML）を print/ に作る
```

- 環境変数は `.env.example` の「スタンプラリー」を参照。開発中は未設定でも仮の値で動く（スタッフPINは `0000`、開催日は毎日 10:00〜16:00）。時間外に試すときは `.env` に `RALLY_DATES=*`・`RALLY_OPEN=00:00`・`RALLY_CLOSE=23:59` を入れる
- 掲示物: `node --env-file=.env.production --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-checkpoint-posters.ts` → `print/checkpoints.html` をブラウザで開いて「PDFに保存」。`print/` はトークンが入るのでコミットしない（`.gitignore` 済み）
- 本番のプロキシは `Host`（または `X-Forwarded-Host`）を変えずに渡し、`X-Forwarded-For` を付けること（Server Action と回数制限のため）
