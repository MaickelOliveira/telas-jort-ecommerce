import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function requiredSecret(name: string, developmentFallback: string) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return developmentFallback;
  throw new Error(`Variável obrigatória ausente: ${name}`);
}

export function hashPassword(password: string) {
  if (password.length < 12) throw new Error("A senha precisa ter pelo menos 12 caracteres.");
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string) {
  // Accept the older "$" separator so existing development hashes keep working.
  const [algorithm, saltText, hashText] = stored.includes(":") ? stored.split(":") : stored.split("$");
  if (algorithm !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = scryptSync(password, Buffer.from(saltText, "base64url"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function signValue(value: string, secretName = "SESSION_SECRET") {
  const secret = requiredSecret(secretName, `local-only-${secretName}-change-me`);
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function verifySignedValue(value: string, signature: string, secretName = "SESSION_SECRET") {
  const expected = Buffer.from(signValue(value, secretName));
  const supplied = Buffer.from(signature || "");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function encryptionKey() {
  const configured = process.env.DATA_ENCRYPTION_KEY;
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length !== 32) throw new Error("DATA_ENCRYPTION_KEY deve possuir 32 bytes em Base64.");
    return decoded;
  }
  if (process.env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY não configurada.");
  return createHash("sha256").update("telas-jort-local-development-only").digest();
}

export function encryptPrivateJson(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptPrivateJson<T>(value: string): T {
  const [ivText, tagText, encryptedText] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8")) as T;
}

export function anonymizeIp(ip: string) {
  const salt = requiredSecret("ANALYTICS_SALT", "local-analytics-salt");
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 24);
}

export function safeEqualText(a: string, b: string) {
  const left = Buffer.from(a || "");
  const right = Buffer.from(b || "");
  return left.length === right.length && timingSafeEqual(left, right);
}
