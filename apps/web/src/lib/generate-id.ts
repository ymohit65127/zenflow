import crypto from "crypto";

/** Generate sequential-style codes like INV-0001, TKT-0042, EMP-0007 */
export function generateSequentialCode(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

/** Generate a random API key */
export function generateApiKey() {
  const key = `zf_${crypto.randomBytes(24).toString("base64url")}`;
  const prefix = key.slice(0, 10) + "...";
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return { key, prefix, hash };
}

/** Generate a secure random token (for invites, password reset) */
export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/** Generate a URL-safe slug from a string */
export function generateSlug(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
