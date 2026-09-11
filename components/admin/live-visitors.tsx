"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type Visitor = { visitor_id: string; path: string; device: string; last_seen_at: string };
export function LiveVisitors({ initial }: { initial: Visitor[] }) {
  const [visitors, setVisitors] = useState(initial);
  useEffect(() => {
    const poll = () => fetch("/api/admin/analytics/live", { cache: "no-store" }).then(async (response) => response.ok ? await response.json() as { visitors?: Visitor[] } : null).then((data) => data?.visitors && setVisitors(data.visitors)).catch(() => undefined);
    const timer = window.setInterval(poll, 10000);
    return () => window.clearInterval(timer);
  }, []);
  return <section className="metric-card rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-extrabold">Agora na loja</h2><p className="text-sm text-zinc-500">Atualiza a cada 10 segundos</p></div><span className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-extrabold text-emerald-800"><i className="size-2 animate-pulse rounded-full bg-emerald-500" /> {visitors.length}</span></div><div className="mt-5 grid gap-2">{visitors.slice(0, 5).map((visitor) => <div key={visitor.visitor_id} className="flex min-w-0 items-center gap-3 rounded-xl bg-zinc-50 p-3">{visitor.device === "Celular" ? <Smartphone className="size-4 shrink-0 text-zinc-500" /> : <Monitor className="size-4 shrink-0 text-zinc-500" />}<span className="min-w-0 flex-1 truncate text-sm font-medium">{visitor.path}</span><span className="text-xs text-emerald-700">online</span></div>)}{visitors.length === 0 && <p className="rounded-xl bg-zinc-50 p-5 text-center text-sm text-zinc-500">Nenhum visitante ativo neste instante.</p>}</div></section>;
}
