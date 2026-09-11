import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerAccountById } from "@/lib/database";
import { signValue, verifySignedValue } from "@/lib/security";

const COOKIE_NAME = "tj_customer_session";
const SESSION_DURATION = 30 * 24 * 60 * 60_000;

type CustomerSession = { customerId: string; email: string; exp: number };

export function createCustomerSession(customerId: string, email: string) {
  const payload: CustomerSession = { customerId, email: email.toLowerCase(), exp: Date.now() + SESSION_DURATION };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signValue(encoded, "CUSTOMER_SESSION_SECRET")}`;
}

export function parseCustomerSession(token?: string): CustomerSession | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !verifySignedValue(encoded, signature, "CUSTOMER_SESSION_SECRET")) return null;
  try {
    const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CustomerSession;
    if (!session.customerId || !session.email || session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function currentCustomerSession() {
  return parseCustomerSession((await cookies()).get(COOKIE_NAME)?.value);
}

export async function currentCustomer() {
  const session = await currentCustomerSession();
  if (!session) return null;
  const customer = await getCustomerAccountById(session.customerId);
  return customer?.email.toLowerCase() === session.email ? customer : null;
}

export async function requireCustomer(returnTo = "/conta") {
  const customer = await currentCustomer();
  if (!customer) redirect(`/conta/entrar?redirect=${encodeURIComponent(returnTo)}`);
  return customer;
}

export const customerCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION / 1000,
  },
};
