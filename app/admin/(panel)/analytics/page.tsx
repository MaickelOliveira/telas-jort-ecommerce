import { Clock3, Eye, MousePointerClick, ShoppingCart, Users, WalletCards } from "lucide-react";
import { AccessChart } from "@/components/admin/access-chart";
import { PageHeader } from "@/components/admin/page-header";
import { SalesChart } from "@/components/admin/sales-chart";
import { getAdminAnalytics } from "@/lib/database";

export const dynamic = "force-dynamic";

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export default async function AnalyticsPage() {
  const analytics = await getAdminAnalytics();
  const overview = analytics.overview;
  const cards = [
    ["Acessos em 7 dias", overview.accesses.toLocaleString("pt-BR"), "visualizações de página", Eye],
    ["Visitantes em 7 dias", overview.visitors.toLocaleString("pt-BR"), "identificadores anônimos", Users],
    ["Adições ao carrinho", overview.addedToCart.toLocaleString("pt-BR"), overview.visitors ? `${(overview.addedToCart / overview.visitors * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos visitantes` : "sem dados", ShoppingCart],
    ["Checkouts iniciados", overview.checkoutStarted.toLocaleString("pt-BR"), "últimos 7 dias", MousePointerClick],
    ["Compras concluídas", overview.purchases.toLocaleString("pt-BR"), "confirmadas pelo checkout", WalletCards],
    ["Tempo médio", duration(overview.averageSeconds), "sessões dos últimos 7 dias", Clock3],
  ] as const;
  const maxViews = Math.max(1, ...analytics.topPages.map((page) => page.views));
  return <div className="mx-auto max-w-[1500px]">
    <PageHeader eyebrow="Desempenho" title="Analytics" description="Acessos, visitantes, funil de compra e vendas reais, sem armazenar o endereço IP original." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{cards.map(([label, value, detail, Icon]) => <article key={label} className="metric-card rounded-3xl border border-zinc-200 bg-white p-5"><Icon className="size-5 text-zinc-500" /><p className="mt-5 text-sm text-zinc-500">{label}</p><strong className="mt-1 block text-2xl">{value}</strong><span className="mt-2 block text-xs text-zinc-500">{detail}</span></article>)}</div>
    <section className="metric-card mt-5 rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6"><div className="mb-6"><h2 className="text-lg font-extrabold">Acessos e visitantes</h2><p className="text-sm text-zinc-500">Últimos 7 dias · atualizados conforme a navegação</p></div><AccessChart data={analytics.accessData} /></section>
    <div className="mt-5"><SalesChart data={analytics.sales} /></div>
    <section className="metric-card mt-5 rounded-3xl border border-zinc-200 bg-white p-6"><h2 className="font-extrabold">Páginas mais visitadas</h2><div className="mt-5 grid gap-4">{analytics.topPages.map((page) => <div key={page.path}><div className="mb-2 flex justify-between gap-4 text-sm"><span className="min-w-0 truncate font-bold">{page.path}</span><span className="text-zinc-500">{page.views.toLocaleString("pt-BR")}</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-[#e2d700]" style={{ width: `${Math.max(3, page.views / maxViews * 100)}%` }} /></div></div>)}{analytics.topPages.length === 0 && <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">As páginas aparecerão aqui após os primeiros acessos.</p>}</div></section>
  </div>;
}
