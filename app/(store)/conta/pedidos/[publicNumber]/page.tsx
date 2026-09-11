import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDollarSign, FileText, MapPin, Package, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import { RefundRequestButton } from "@/components/account/refund-request-button";
import { Badge } from "@/components/ui/badge";
import { requireCustomer } from "@/lib/customer-auth";
import { getFiscalDocumentForOrder, getStoredOrderForCustomer, listRefundRequestsForOrder, listStoredOrderItems } from "@/lib/database";
import { dateTimePt, money } from "@/lib/format";
import { fulfillmentStatusLabel, paymentStatusLabel, refundStatusLabel } from "@/lib/order-status";

export const metadata: Metadata = { title: "Detalhes do pedido" };

export default async function CustomerOrderPage({ params }: { params: Promise<{ publicNumber: string }> }) {
  const customer = await requireCustomer();
  const { publicNumber } = await params;
  const order = getStoredOrderForCustomer(publicNumber, customer.id);
  if (!order) notFound();
  const items = listStoredOrderItems(order.id);
  const refunds = listRefundRequestsForOrder(order.id);
  const fiscalDocument = getFiscalDocumentForOrder(order.id);
  const activeRefund = refunds.find((refund) => ["requested", "processing"].includes(refund.status));
  const refundable = order.status === "paid" && order.refunded_cents < order.total_cents;
  const address = [order.customer.address, order.customer.number, order.customer.district, order.customer.city, order.customer.state, order.customer.postalCode].filter(Boolean).join(", ");
  return <main className="min-h-[65vh] bg-zinc-100 py-7 sm:py-10"><div className="page-shell max-w-6xl">
    <Link href="/conta" className="inline-flex items-center gap-2 text-sm font-extrabold"><ArrowLeft className="size-4" /> Voltar aos pedidos</Link>
    <div className="mt-5 flex flex-col justify-between gap-5 rounded-3xl bg-[#17191b] p-6 text-white sm:flex-row sm:items-center sm:p-8"><div><span className="text-xs font-bold uppercase tracking-[.18em] text-[#fff100]">Pedido realizado em {dateTimePt(order.created_at)}</span><h1 className="display-title mt-2 text-4xl">#{order.public_number}</h1><p className="mt-2 text-sm text-white/65">Acompanhe abaixo cada etapa da sua compra.</p></div><div className="flex flex-wrap gap-3"><Badge className="bg-white/10 px-4 py-2 text-white">{paymentStatusLabel(order.payment_status)}</Badge><Badge className="bg-[#fff100] px-4 py-2 text-black">{fulfillmentStatusLabel(order.fulfillment_status)}</Badge></div></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]"><div className="grid gap-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6"><h2 className="flex items-center gap-3 text-xl font-extrabold"><Package className="size-5 shrink-0" /> Produtos</h2><div className="mt-5 divide-y divide-zinc-100">{items.map((item) => <div key={item.product_id} className="flex min-w-0 flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div className="min-w-0"><strong className="block break-words">{item.name}</strong><span className="break-words text-sm text-zinc-500">SKU {item.sku} · {item.quantity} unidade(s)</span></div><strong className="shrink-0">{money(item.subtotal_cents)}</strong></div>)}</div></section>
      <section className="rounded-3xl border border-zinc-200 bg-white p-6"><h2 className="flex items-center gap-3 text-xl font-extrabold"><Truck className="size-5" /> Entrega</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Forma de envio" value={order.shipping_service} /><Info label="Situação" value={fulfillmentStatusLabel(order.fulfillment_status)} /><Info label="Endereço" value={address || "Endereço não informado"} wide /></div></section>
      {fiscalDocument && <section className="rounded-3xl border border-zinc-200 bg-white p-6"><h2 className="flex items-center gap-3 text-xl font-extrabold"><FileText className="size-5" /> Nota fiscal</h2>{fiscalDocument.status === "authorized" ? <div className="mt-5 flex flex-col gap-3 sm:flex-row"><span className="flex-1 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">NF-e autorizada{fiscalDocument.number ? ` · nº ${fiscalDocument.number}` : ""}</span>{fiscalDocument.danfe_url && <a className="flex h-12 items-center justify-center rounded-xl bg-[#fff100] px-5 text-sm font-extrabold" href={fiscalDocument.danfe_url} target="_blank" rel="noreferrer">Abrir DANFE</a>}{fiscalDocument.xml_url && <a className="flex h-12 items-center justify-center rounded-xl border border-zinc-300 px-5 text-sm font-extrabold" href={fiscalDocument.xml_url} target="_blank" rel="noreferrer">Baixar XML</a>}</div> : <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">A emissão da sua nota fiscal está sendo processada pela loja.</p>}</section>}
      {refunds.length > 0 && <section className="rounded-3xl border border-zinc-200 bg-white p-6"><h2 className="flex items-center gap-3 text-xl font-extrabold"><CircleDollarSign className="size-5" /> Solicitações de estorno</h2><div className="mt-5 grid gap-3">{refunds.map((refund) => <div key={refund.id} className="rounded-2xl border border-zinc-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{refundStatusLabel(refund.status)}</strong><span className="text-sm font-bold">{money(refund.requested_amount_cents)}</span></div><p className="mt-2 text-sm leading-6 text-zinc-600">{refund.reason}</p>{refund.failure_message && <p className="mt-2 text-sm text-red-700">{refund.failure_message}</p>}<small className="mt-2 block text-zinc-400">{dateTimePt(refund.created_at)}</small></div>)}</div></section>}
    </div><aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-6 lg:sticky lg:top-28"><h2 className="text-xl font-extrabold">Resumo</h2><div className="mt-5 grid gap-3 text-sm"><div className="flex justify-between"><span className="text-zinc-500">Produtos</span><strong>{money(order.subtotal_cents)}</strong></div>{order.discount_cents > 0 && <div className="flex justify-between text-emerald-700"><span>Desconto</span><strong>− {money(order.discount_cents)}</strong></div>}<div className="flex justify-between"><span className="text-zinc-500">Frete</span><strong>{money(order.shipping_cents)}</strong></div>{order.refunded_cents > 0 && <div className="flex justify-between text-red-700"><span>Estornado</span><strong>− {money(order.refunded_cents)}</strong></div>}</div><div className="my-5 border-t border-zinc-200" /><div className="flex items-end justify-between"><span className="font-bold">Total</span><strong className="text-2xl">{money(order.total_cents)}</strong></div>
      <div className="mt-6 grid gap-3">{refundable && !activeRefund ? <RefundRequestButton orderNumber={order.public_number} /> : activeRefund ? <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Sua solicitação está sendo analisada pela loja.</p> : order.refunded_cents >= order.total_cents ? <p className="flex gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900"><CheckCircle2 className="size-5 shrink-0" /> Este pedido foi totalmente estornado.</p> : <p className="rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-600">O estorno poderá ser solicitado depois da confirmação do pagamento.</p>}<Link href="/contato" className="flex h-10 items-center justify-center rounded-xl bg-[#fff100] text-sm font-extrabold">Preciso de ajuda</Link></div>
    </aside></div>
  </div></main>;
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`min-w-0 rounded-2xl bg-zinc-100 p-4 ${wide ? "sm:col-span-2" : ""}`}><span className="text-xs font-bold uppercase tracking-wide text-zinc-400">{label}</span><p className="mt-2 flex min-w-0 gap-2 break-words text-sm font-bold"><MapPin className="size-4 shrink-0 text-zinc-400" /><span className="min-w-0">{value}</span></p></div>;
}
