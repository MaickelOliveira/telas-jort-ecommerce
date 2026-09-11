"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useState } from "react";

export function LoginForm({ demoEnabled }: { demoEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (demo = false) => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(demo ? { demo: true } : { email, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Acesso negado");
      router.push("/admin"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível entrar"); }
    finally { setLoading(false); }
  };
  return <div className="grid gap-4"><label className="grid gap-2 text-sm font-bold">E-mail<input className="h-12 rounded-xl border border-zinc-300 px-4 text-base outline-none focus:ring-2 focus:ring-[#fff100]" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="grid gap-2 text-sm font-bold">Senha<input className="h-12 rounded-xl border border-zinc-300 px-4 text-base outline-none focus:ring-2 focus:ring-[#fff100]" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} onClick={() => submit(false)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#17191b] font-bold text-white disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />} Entrar com segurança</button>{demoEnabled && <><div className="flex items-center gap-3 text-xs text-zinc-400"><span className="h-px flex-1 bg-zinc-200" />OU<span className="h-px flex-1 bg-zinc-200" /></div><button disabled={loading} onClick={() => submit(true)} className="h-12 rounded-xl border-2 border-zinc-200 font-bold hover:border-zinc-900">Abrir demonstração local</button></>}</div>;
}
