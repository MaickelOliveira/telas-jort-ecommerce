import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Box, CircleDollarSign, PackageCheck, ShoppingBag } from "lucide-react";
import { AccountLogoutButton } from "@/components/account/account-logout-button";
import { CompactPageBanner } from "@/components/store/compact-page-banner";
import { Badge } from "@/components/ui/badge";
import { requireCustomer } from "@/lib/customer-auth";
import { listStoredOrdersForCustomer } from "@/lib/database";
import { dateTimePt, money } from "@/lib/format";
import { fulfillmentStatusLabel, paymentStatusLabel } from "@/lib/order-status";

export const metadata: Metadata = { title: "Minha conta" };

export default async function CustomerAccountPage() {
  const customer = await requireCustomer();
  const orders = listStoredOrdersForCustomer(customer.id);
  const paid = orders.filter((order) => order.status === "paid").length;
  return <main className="min-h-[65vh] bg-zinc-100 py-7 sm:py-10"><div className="page-shell">
    <CompactPageBanner eyebrow="Área do cliente" title={`Olá, ${customer.name.split(" ")[0]}`} text="Acompanhe suas compras, consulte os detalhes e solicite atendimento sem perder o histórico." />
    <div className="mt-6 flex flex-col items-stretch justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center"><div className="min-w-0"><strong className="block break-words text-lg">{customer.name}</strong><span className="block break-words text-sm text-zinc-500">{customer.email} · {customer.phone}</span></div><AccountLogoutButton /></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-3"><Metric icon={ShoppingBag} label="Pedidos" value={String(orders.length)} /><Metric icon={CircleDollarSign} label="Pagamentos aprovados" value={String(paid)} /><Metric icon={PackageCheck} label="Entregues" value={String(orders.filter((order) => /delivered|entregue/i.test(order.fulfillment_status)).length)} /></div>
    <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7"><div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-extrabold">Meus pedidos</h2><p className="mt-1 text-sm text-zinc-500">As novas compras aparecem aqui automaticamente.</p></div><Link href="/produtos" className="hidden rounded-xl bg-[#fff100] px-4 py-3 text-sm font-extrabold sm:block">Comprar novamente</Link></div>
      {!orders.length ? <div className="mt-7 rounded-2xl bg-zinc-100 p-6 text-center sm:p-10"><Box className="mx-auto size-12 text-zinc-400" /><h3 className="mt-4 text-xl font-extrabold">Você ainda não possui pedidos</h3><p className="mt-2 text-sm text-zinc-500">Escolha os produtos e finalize sua primeira compra.</p><Link href="/produtos" className="mt-5 inline-block rounded-xl bg-[#fff100] px-5 py-3 font-extrabold">Ver produtos</Link></div> : <div className="mt-6 grid gap-3">{orders.map((order) => <Link key={order.id} href={`/conta/pedidos/${encodeURIComponent(order.public_number)}`} className="group grid min-w-0 gap-4 rounded-2xl border border-zinc-200 p-4 transition hover:border-zinc-400 sm:grid-cols-[1.1fr_1fr_1fr_auto] sm:items-center">
        <div><span className="text-xs font-bold uppercase tracking-wide text-zinc-400">Pedido</span><strong className="mt-1 block text-lg">#{order.public_number}</strong><small className="text-zinc-500">{dateTimePt(order.created_at)}</small></div>
        <div><span className="text-xs font-bold uppercase tracking-wide text-zinc-400">Pagamento</span><Badge className={`mt-2 block w-fit ${order.status === "paid" ? "bg-emerald-100 text-emerald-800" : order.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{paymentStatusLabel(order.payment_status)}</Badge></div>
        <div><span className="text-xs font-bold uppercase tracking-wide text-zinc-400">Entrega</span><strong className="mt-2 block text-sm">{fulfillmentStatusLabel(order.fulfillment_status)}</strong></div>
        <div className="flex items-center justify-between gap-4 sm:justify-end"><strong>{money(order.total_cents)}</strong><ArrowRight className="size-5 transition group-hover:translate-x-1" /></div>
      </Link>)}</div>}
    </section>
  </div></main>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: string }) {
  return <article className="flex min-w-0 items-center gap-4 rounded-3xl border border-zinc-200 bg-white p-5"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff100]"><Icon className="size-5" /></span><div className="min-w-0"><span className="block text-xs font-bold uppercase tracking-wide text-zinc-400">{label}</span><strong className="block text-2xl">{value}</strong></div></article>;
}
