import Link from "next/link";
import { AlertTriangle, Boxes, CircleDollarSign, ExternalLink, PackageCheck, Settings, ShoppingBag, Store } from "lucide-react";
import { MarketplaceProductToggle } from "@/components/admin/marketplace-product-toggle";
import { MarketplaceRefreshButton } from "@/components/admin/marketplace-refresh-button";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMarketplaceDashboard, isMarketplaceProductActive, type MarketplaceChannel } from "@/lib/integrations/marketplaces";

export const dynamic = "force-dynamic";

const channelNames: Record<MarketplaceChannel, string> = { mercado_livre: "Mercado Livre", shopee: "Shopee" };

function marketplaceMoney(valueCents: number, currency = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(valueCents / 100);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueCents / 100);
  }
}

function countsAsRevenue(status: string) {
  const normalized = status.toLowerCase();
  return !normalized.includes("cancel") && !normalized.includes("refund") && !normalized.includes("unpaid");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Ativo", paused: "Pausado", closed: "Encerrado", under_review: "Em revisão",
    paid: "Pago", confirmed: "Confirmado", payment_required: "Aguardando pagamento",
    normal: "Ativo", unlist: "Pausado", banned: "Bloqueado", ready_to_ship: "Pronto para envio",
    processed: "Processado", shipped: "Enviado", completed: "Concluído", cancelled: "Cancelado",
  };
  return labels[status.toLowerCase()] || status.replaceAll("_", " ");
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (["active", "normal", "paid", "completed", "shipped"].includes(normalized)) return "bg-emerald-100 text-emerald-800";
  if (normalized.includes("cancel") || normalized === "banned" || normalized === "closed") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-900";
}

export default async function MarketplacesPage() {
  const dashboard = await getMarketplaceDashboard();
  const validOrders = dashboard.orders.filter((order) => countsAsRevenue(order.status));
  const revenueCents = validOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const activeProducts = dashboard.products.filter(isMarketplaceProductActive).length;
  const lowStock = dashboard.products.filter((product) => isMarketplaceProductActive(product) && product.stock <= 5).length;
  const anyConnected = dashboard.channels.some((channel) => channel.connected);

  return <div className="mx-auto max-w-[1500px]">
    <PageHeader
      eyebrow="Operação multicanal"
      title="Marketplaces"
      description="Acompanhe vendas, faturamento e produtos publicados no Mercado Livre e na Shopee."
      action={<MarketplaceRefreshButton />}
    />

    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard icon={CircleDollarSign} label="Faturamento em 30 dias" value={marketplaceMoney(revenueCents)} detail="Pedidos não cancelados dos dois canais" />
      <SummaryCard icon={ShoppingBag} label="Pedidos em 30 dias" value={String(dashboard.orders.length)} detail="Mercado Livre + Shopee" />
      <SummaryCard icon={Boxes} label="Produtos ativos" value={String(activeProducts)} detail={`${dashboard.products.length} anúncios encontrados`} />
      <SummaryCard icon={PackageCheck} label="Estoque baixo" value={String(lowStock)} detail="Anúncios ativos com até 5 unidades" />
    </div>

    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      {dashboard.channels.map((channel) => {
        const channelRevenue = channel.orders.filter((order) => countsAsRevenue(order.status)).reduce((sum, order) => sum + order.totalCents, 0);
        return <section key={channel.channel} className="metric-card rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff100]"><Store className="size-5" /></span><div className="min-w-0"><h2 className="font-extrabold">{channelNames[channel.channel]}</h2><p className="truncate text-xs text-zinc-500">{channel.accountName}</p></div></div>
            <Badge className={channel.connected ? channel.error ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-700"}>{channel.connected ? channel.error ? "Requer atenção" : "Conectado" : "Não conectado"}</Badge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-5 sm:grid-cols-3"><ChannelMetric label="Vendas" value={marketplaceMoney(channelRevenue)} /><ChannelMetric label="Pedidos" value={String(channel.orders.length)} /><ChannelMetric label="Produtos" value={String(channel.products.length)} /></div>
          {channel.error && <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{channel.error}</p>}
          {!channel.connected && <Button asChild variant="outline" className="mt-4 w-full"><Link href="/admin/integracoes?aba=marketplaces"><Settings /> Configurar integração</Link></Button>}
        </section>;
      })}
    </div>

    {!anyConnected && <div className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><Store className="mt-0.5 size-5 shrink-0" /><div><strong>Conecte pelo menos um canal para carregar os dados reais.</strong><p className="mt-1 leading-6">As credenciais ficam em Integrações. Depois de habilitar a conta, vendas, valores e anúncios aparecerão automaticamente aqui.</p></div></div>}

    <section className="metric-card overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="text-xl font-extrabold">Pedidos recentes</h2><p className="mt-1 text-sm text-zinc-500">Últimas vendas encontradas nos marketplaces nos últimos 30 dias.</p></div><Badge variant="secondary">{dashboard.orders.length} pedidos</Badge></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-6">Canal / pedido</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Itens</TableHead><TableHead>Status</TableHead><TableHead className="pr-6 text-right">Valor</TableHead></TableRow></TableHeader><TableBody>
        {dashboard.orders.slice(0, 50).map((order) => <TableRow key={`${order.channel}-${order.externalId}`}><TableCell className="pl-6"><strong className="block">{channelNames[order.channel]}</strong><span className="text-xs text-zinc-500">#{order.externalId}</span></TableCell><TableCell className="whitespace-nowrap text-zinc-600">{new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}</TableCell><TableCell>{order.customer}</TableCell><TableCell>{order.itemCount}</TableCell><TableCell><Badge className={statusTone(order.status)}>{statusLabel(order.status)}</Badge></TableCell><TableCell className="pr-6 text-right font-extrabold">{marketplaceMoney(order.totalCents, order.currency)}</TableCell></TableRow>)}
        {dashboard.orders.length === 0 && <TableRow><TableCell colSpan={6} className="h-28 text-center text-zinc-500">Nenhuma venda de marketplace disponível ainda.</TableCell></TableRow>}
      </TableBody></Table></div>
    </section>

    <section className="metric-card mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="text-xl font-extrabold">Produtos nos marketplaces</h2><p className="mt-1 text-sm text-zinc-500">Preço, estoque, vendas e situação atual de cada anúncio.</p></div><Badge variant="secondary">{dashboard.products.length} anúncios</Badge></div>
      <div className="max-h-[720px] overflow-auto"><Table><TableHeader><TableRow><TableHead className="pl-6">Produto</TableHead><TableHead>Canal</TableHead><TableHead>Preço</TableHead><TableHead>Estoque</TableHead><TableHead>Vendidos</TableHead><TableHead>Status</TableHead><TableHead className="pr-6">Ativar / pausar</TableHead></TableRow></TableHeader><TableBody>
        {dashboard.products.map((product) => {
          const locked = ["closed", "under_review", "banned"].includes(product.status.toLowerCase());
          return <TableRow key={`${product.channel}-${product.externalId}`}><TableCell className="pl-6"><strong className="block max-w-[420px]">{product.name}</strong><span className="text-xs text-zinc-500">{product.sku} · {product.externalId}</span></TableCell><TableCell><Badge variant="secondary">{channelNames[product.channel]}</Badge></TableCell><TableCell className="font-bold">{marketplaceMoney(product.priceCents)}</TableCell><TableCell className={product.stock <= 5 ? "font-extrabold text-amber-700" : ""}>{product.stock}</TableCell><TableCell>{product.sold}</TableCell><TableCell>{product.url ? <a href={product.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><Badge className={statusTone(product.status)}>{statusLabel(product.status)}</Badge><ExternalLink className="size-3" /></a> : <Badge className={statusTone(product.status)}>{statusLabel(product.status)}</Badge>}</TableCell><TableCell className="pr-6"><MarketplaceProductToggle channel={product.channel} externalId={product.externalId} initialActive={isMarketplaceProductActive(product)} disabled={locked} /></TableCell></TableRow>;
        })}
        {dashboard.products.length === 0 && <TableRow><TableCell colSpan={7} className="h-28 text-center text-zinc-500">Os produtos aparecerão aqui após conectar e habilitar o Mercado Livre ou a Shopee.</TableCell></TableRow>}
      </TableBody></Table></div>
      <div className="flex items-start gap-3 border-t border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" /><p>O interruptor pausa ou reativa o anúncio diretamente no marketplace. Produtos encerrados, bloqueados ou em revisão ficam travados porque o canal não permite reativação simples.</p></div>
    </section>
  </div>;
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: typeof Store; label: string; value: string; detail: string }) {
  return <section className="metric-card rounded-3xl border border-zinc-200 bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#fff100]"><Icon className="size-5" /></span><span className="text-sm font-bold text-zinc-500">{label}</span></div><strong className="mt-5 block text-3xl font-black">{value}</strong><p className="mt-1 text-xs text-zinc-500">{detail}</p></section>;
}

function ChannelMetric({ label, value }: { label: string; value: string }) {
  return <div><span className="text-xs font-bold text-zinc-500">{label}</span><strong className="mt-1 block truncate text-lg">{value}</strong></div>;
}
