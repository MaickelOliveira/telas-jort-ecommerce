import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqualText, signValue, verifyPassword, verifySignedValue } from "@/lib/security";

const COOKIE_NAME = "tj_admin_session";
type Session = { email: string; role: "owner" | "manager" | "demo"; exp: number };
const attempts = new Map<string, { count: number; reset: number }>();

export function checkLoginRateLimit(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.reset < now) { attempts.set(key, { count: 1, reset: now + 15 * 60_000 }); return true; }
  current.count += 1;
  return current.count <= 8;
}

export function authenticateAdmin(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!expectedEmail || email.trim().toLowerCase() !== expectedEmail) return false;

  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const plainPassword = process.env.ADMIN_PASSWORD;
  let hashMatches = false;
  if (passwordHash) {
    try {
      hashMatches = passwordHash.startsWith("scrypt:") || passwordHash.startsWith("scrypt$")
        ? verifyPassword(password, passwordHash)
        : safeEqualText(password, passwordHash);
    } catch {
      hashMatches = false;
    }
  }

  return hashMatches || Boolean(plainPassword && safeEqualText(password, plainPassword));
}

export function createSession(email: string, role: Session["role"] = "owner") {
  const payload: Session = { email, role, exp: Date.now() + 8 * 60 * 60_000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signValue(encoded)}`;
}

export function parseSession(token?: string): Session | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !verifySignedValue(encoded, signature)) return null;
  try {
    const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Session;
    return session.exp > Date.now() ? session : null;
  } catch { return null; }
}

export async function currentAdmin() { return parseSession((await cookies()).get(COOKIE_NAME)?.value); }
export async function requireAdmin() { const session = await currentAdmin(); if (!session) redirect("/admin/login"); return session; }
export const adminCookie = { name: COOKIE_NAME, options: { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60 } };
