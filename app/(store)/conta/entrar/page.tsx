import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountAccessForm } from "@/components/account/account-access-form";
import { AccountAuthLayout } from "@/components/account/account-auth-layout";
import { currentCustomer } from "@/lib/customer-auth";

export const metadata: Metadata = { title: "Entrar na minha conta" };

function safeReturnTo(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/conta";
}

export default async function CustomerLoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const customer = await currentCustomer();
  const returnTo = safeReturnTo((await searchParams).redirect);
  if (customer) redirect(returnTo);
  return <AccountAuthLayout mode="login"><AccountAccessForm mode="login" returnTo={returnTo} tone="dark" /></AccountAuthLayout>;
}
