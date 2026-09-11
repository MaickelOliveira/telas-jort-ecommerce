"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole, LogIn, UserRoundPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountAccessForm({ mode, returnTo, tone = "light" }: { mode: "login" | "register"; returnTo: string; tone?: "light" | "dark" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "register" && password !== confirmation) return toast.error("As senhas não coincidem.");
    setLoading(true);
    try {
      const response = await fetch(`/api/customer/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { name, email, phone, password }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível continuar.");
      toast.success(mode === "login" ? "Acesso realizado." : "Sua conta foi criada.");
      router.push(returnTo);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  const otherHref = `${mode === "login" ? "/conta/cadastro" : "/conta/entrar"}?redirect=${encodeURIComponent(returnTo)}`;
  const dark = tone === "dark";
  const fieldClassName = dark ? "h-12 rounded-xl border-white/15 bg-white/8 text-white placeholder:text-zinc-500 focus-visible:border-[#fff100] focus-visible:ring-[#fff100]/25" : "h-12 rounded-xl";
  const labelClassName = dark ? "text-sm font-bold text-zinc-200" : "";

  return <form onSubmit={submit} className="mt-7 grid gap-4">
    {mode === "register" && <>
      <div className="grid gap-2"><Label className={labelClassName} htmlFor="account-name">Nome completo</Label><Input className={fieldClassName} id="account-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={3} /></div>
      <div className="grid gap-2"><Label className={labelClassName} htmlFor="account-phone">Telefone/WhatsApp</Label><Input className={fieldClassName} id="account-phone" autoComplete="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></div>
    </>}
    <div className="grid gap-2"><Label className={labelClassName} htmlFor="account-email">E-mail</Label><Input className={fieldClassName} id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
    <div className="grid gap-2"><Label className={labelClassName} htmlFor="account-password">Senha</Label><Input className={fieldClassName} id="account-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "register" ? 12 : 1} /></div>
    {mode === "register" && <div className="grid gap-2"><Label className={labelClassName} htmlFor="account-confirmation">Confirmar senha</Label><Input className={fieldClassName} id="account-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={12} /></div>}
    {mode === "register" && <p className={`flex gap-2 rounded-2xl p-4 text-xs leading-5 ${dark ? "border border-white/10 bg-white/5 text-zinc-400" : "bg-zinc-100 text-zinc-600"}`}><LockKeyhole className={`mt-0.5 size-4 shrink-0 ${dark ? "text-[#fff100]" : ""}`} /> Use pelo menos 12 caracteres. Seus pedidos ficarão disponíveis somente nesta conta.</p>}
    <Button type="submit" size="lg" className={`mt-1 h-13 rounded-xl font-extrabold ${dark ? "bg-[#fff100] text-zinc-950 hover:bg-[#e9dd00]" : "bg-[#17191b] text-white"}`} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : mode === "login" ? <LogIn /> : <UserRoundPlus />}{mode === "login" ? "Entrar na minha conta" : "Criar minha conta"}</Button>
    <p className={`text-center text-sm ${dark ? "text-zinc-400" : "text-zinc-500"}`}>{mode === "login" ? "Ainda não possui cadastro?" : "Já possui uma conta?"} <Link className={`font-extrabold underline underline-offset-4 ${dark ? "text-[#fff100]" : "text-zinc-950"}`} href={otherHref}>{mode === "login" ? "Cadastre-se" : "Entrar"}</Link></p>
  </form>;
}
