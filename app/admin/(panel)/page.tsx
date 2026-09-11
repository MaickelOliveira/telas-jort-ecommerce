import Link from "next/link";
import { ArrowRight, Banknote, Eye, PackageCheck, ShoppingBag, Users } from "lucide-react";
import { LiveVisitors } from "@/components/admin/live-visitors";
import { SalesChart } from "@/components/admin/sales-chart";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminAnalytics, getLiveVisitors, listStoredOrders } from "@/lib/database";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [analytics, liveVisitors, storedOrders] = await Promise.all([
    getAdminAnalytics(),
    getLiveVisitors(),
    listStoredOrders(5),
  ]);
  const visitors = liveVisitors.map((row) => ({
    visitor_id: String(row.visitor_id),
    path: String(row.path),
    device: String(row.device),
    last_seen_at: String(row.last_seen_at),
  }));
  const orders = storedOrders.map((row) => ({
    number: String(row.public_number),
    customer: String((row.customer as Record<string, string>)?.name || "Cliente"),
    city: String((row.customer as Record<string, string>)?.city || ""),
    totalCents: Number(row.total_cents),
    payment: String(row.payment_status),
    fulfillment: String(row.fulfillment_status),
  }));
  const metrics = [
    { label: "Vendas hoje", value: money(analytics.dashboard.revenueTodayCents), detail: "pagamentos confirmados", icon: Banknote },
    { label: "Pedidos hoje", value: String(analytics.dashboard.ordersToday), detail: "todos os status", icon: ShoppingBag },
    { label: "Conversão", value: `${analytics.dashboard.conversion.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`, detail: "pedido por visitante", icon: Eye },
    { label: "Ticket médio", value: money(analytics.dashboard.ticketAverageCents), detail: `${analytics.dashboard.visitorsToday} visitantes hoje`, icon: Users },
  ];
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date());
  const hasData = orders.length > 0 || analytics.overview.accesses > 0;

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold capitalize text-zinc-500">{date}</p><h1 className="display-title mt-1 text-4xl">Visão geral</h1></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${hasData ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-700"}`}>{hasData ? "DADOS REAIS DA LOJA" : "AGUARDANDO PRIMEIROS ACESSOS"}</span></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <article key={metric.label} className="metric-card rounded-3xl border border-zinc-200 bg-white p-5"><span className="grid size-11 place-items-center rounded-2xl bg-zinc-100"><metric.icon className="size-5" /></span><p className="mt-5 text-sm font-medium text-zinc-500">{metric.label}</p><strong className="mt-1 block text-2xl">{metric.value}</strong><span className="mt-2 block text-xs text-zinc-500">{metric.detail}</span></article>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]"><SalesChart data={analytics.sales} /><LiveVisitors initial={visitors} /></div>
    <section className="metric-card mt-5 overflow-hidden rounded-3xl border border-zinc-200 bg-white"><div className="flex items-center justify-between border-b border-zinc-200 p-5 sm:p-6"><div><h2 className="text-lg font-extrabold">Pedidos recentes</h2><p className="text-sm text-zinc-500">Últimas movimentações reais da loja</p></div><Link href="/admin/pedidos" className="flex items-center gap-2 text-sm font-bold">Ver todos <ArrowRight className="size-4" /></Link></div><Table><TableHeader><TableRow><TableHead className="pl-6">Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Pagamento</TableHead><TableHead>Envio</TableHead><TableHead>Total</TableHead></TableRow></TableHeader><TableBody>{orders.map((order) => <TableRow key={order.number}><TableCell className="pl-6 font-bold">#{order.number}</TableCell><TableCell><strong className="block">{order.customer}</strong><span className="text-xs text-zinc-500">{order.city}</span></TableCell><TableCell><StatusBadge label={order.payment} /></TableCell><TableCell><span className="flex items-center gap-2"><PackageCheck className="size-4 text-zinc-400" />{order.fulfillment}</span></TableCell><TableCell className="font-bold">{money(order.totalCents)}</TableCell></TableRow>)}{orders.length === 0 && <TableRow><TableCell colSpan={5} className="h-28 text-center text-zinc-500">Nenhum pedido recebido ainda.</TableCell></TableRow>}</TableBody></Table></section>
  </div>;
}

function StatusBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const className = ["approved", "paid", "pago", "aprovado"].includes(normalized) ? "bg-emerald-100 text-emerald-800" : normalized.includes("pending") || normalized.includes("pendente") ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-700";
  return <Badge variant="secondary" className={className}>{label}</Badge>;
}
