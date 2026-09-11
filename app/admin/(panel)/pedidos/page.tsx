import { Download, Search, SlidersHorizontal } from "lucide-react";
import { OrderRefundButton } from "@/components/admin/order-refund-button";
import { OrderFiscalButton } from "@/components/admin/order-fiscal-button";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFiscalDocumentForOrder, listRefundRequestsForOrder, listStoredOrders } from "@/lib/database";
import { money } from "@/lib/format";
import { paymentStatusLabel } from "@/lib/order-status";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  let stored: Awaited<ReturnType<typeof listStoredOrders>> = [];
  try { stored = await listStoredOrders(); } catch { stored = []; }
  const orders = await Promise.all(stored.map(async (order) => {
    const [requests, fiscalDocument] = await Promise.all([
      listRefundRequestsForOrder(order.id),
      getFiscalDocumentForOrder(order.id),
    ]);
    const customerRequest = requests.find((request) => request.status === "requested" && request.requested_by.startsWith("customer:"));
    return { ...order, customerRequest, fiscalDocument };
  }));

  return <div className="mx-auto max-w-[1500px]">
    <PageHeader eyebrow="Operação" title="Pedidos" description="Acompanhe pagamentos, separação, etiquetas, entregas e solicitações de estorno." action={<Button asChild className="bg-[#17191b]"><a href="/api/admin/orders/export"><Download /> Exportar CSV</a></Button>} />
    <section className="metric-card overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-5 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-zinc-400" /><Input className="pl-9" placeholder="Busca visual — use a exportação para filtros avançados" disabled /></div><Button variant="outline" disabled><SlidersHorizontal /> Filtros</Button></div>
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 px-5 py-3 text-sm font-bold"><span className="rounded-full bg-zinc-900 px-4 py-2 text-white">Todos ({orders.length})</span>{orders.some((order) => order.customerRequest) && <span className="rounded-full bg-red-100 px-4 py-2 text-red-800">Estornos solicitados ({orders.filter((order) => order.customerRequest).length})</span>}</div>
      <Table><TableHeader><TableRow><TableHead className="pl-6">Pedido</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Pagamento</TableHead><TableHead>Fiscal</TableHead><TableHead>Envio</TableHead><TableHead>Total</TableHead><TableHead className="pr-6 text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
        {orders.map((order) => <TableRow key={order.public_number} className={order.customerRequest ? "bg-red-50/50" : undefined}>
          <TableCell className="pl-6 font-extrabold">#{order.public_number}{order.customerRequest && <span className="mt-1 block text-[11px] font-extrabold uppercase text-red-700">Estorno solicitado</span>}</TableCell>
          <TableCell className="text-zinc-500">{new Date(order.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell>
          <TableCell><strong className="block">{order.customer.name || "Cliente"}</strong><span className="text-xs text-zinc-500">{order.customer.city || ""}</span></TableCell>
          <TableCell><Badge className={order.status === "paid" ? "bg-emerald-100 text-emerald-800" : order.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{paymentStatusLabel(order.payment_status)}</Badge>{order.refunded_cents > 0 && <small className="mt-1 block text-red-700">{money(order.refunded_cents)} devolvido</small>}</TableCell>
          <TableCell>{order.fiscalDocument ? <div><Badge className={order.fiscalDocument.status === "authorized" ? "bg-emerald-100 text-emerald-800" : order.fiscalDocument.status === "error" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{order.fiscalDocument.status === "authorized" ? "NF-e autorizada" : order.fiscalDocument.status === "error" ? "Corrigir emissão" : "Em processamento"}</Badge>{order.fiscalDocument.danfe_url && <a className="mt-1 block text-xs font-bold underline" href={order.fiscalDocument.danfe_url} target="_blank" rel="noreferrer">Abrir DANFE</a>}</div> : <span className="text-xs text-zinc-400">Aguardando pagamento</span>}</TableCell>
          <TableCell>{order.fulfillment_status}</TableCell>
          <TableCell className="font-bold">{money(order.total_cents)}</TableCell>
          <TableCell className="pr-6"><div className="flex justify-end gap-2">{order.status === "paid" && (!order.fiscalDocument || order.fiscalDocument.status === "error") && <OrderFiscalButton orderNumber={order.public_number} retry={order.fiscalDocument?.status === "error"} />}{order.status === "paid" && <OrderRefundButton orderNumber={order.public_number} totalCents={order.total_cents} refundedCents={order.refunded_cents} paymentProviderId={order.payment_provider_id} customerRequest={order.customerRequest ? { id: order.customerRequest.id, reason: order.customerRequest.reason, requestedAmountCents: order.customerRequest.requested_amount_cents } : undefined} />}</div></TableCell>
        </TableRow>)}
        {orders.length === 0 && <TableRow><TableCell colSpan={8} className="h-28 text-center text-zinc-500">Nenhum pedido recebido ainda.</TableCell></TableRow>}
      </TableBody></Table>
    </section>
  </div>;
}
