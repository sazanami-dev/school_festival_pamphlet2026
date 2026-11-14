import "server-only";

/**
 * スタンプラリーの秘密の設定値（.env / compose の environment から渡す）
 *
 * 本番で未設定ならエラーにする。開発中は毎回設定しなくても動くよう、固定の仮の値を使う
 * （仮の値で作ったQRは本番では無効になる）。
 */
type SecretName = "RALLY_SECRET" | "CHECKPOINT_SECRET" | "STAFF_PIN" | "ADMIN_PIN";

const DEV_FALLBACKS: Record<SecretName, string> = {
  RALLY_SECRET: "dev-rally-secret",
  CHECKPOINT_SECRET: "dev-checkpoint-secret",
  STAFF_PIN: "0000",
  ADMIN_PIN: "0000",
};

const warned = new Set<SecretName>();

export function requireSecret(name: SecretName): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error(`${name} is not set`);

  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[rally] ${name} が未設定のため、開発用の仮の値を使います`);
  }
  return DEV_FALLBACKS[name];
}
