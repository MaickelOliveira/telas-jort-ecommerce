import Link from "next/link";
import { AlertTriangle, CheckCircle2, PackageCheck, Settings2, Truck } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listStoredOrders } from "@/lib/database";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";

export const dynamic = "force-dynamic";

export default function FreightPage() {
  const connected = getRuntimeIntegrationConfig("melhor_envio").enabled;
  const orders = listStoredOrders(500);
  const paid = orders.filter((order) => order.status === "paid");
  const awaiting = paid.filter((order) => order.fulfillment_status === "unfulfilled").length;
  const inTransit = paid.filter((order) => /transit|trânsito|postado/i.test(order.fulfillment_status)).length;
  const delivered = paid.filter((order) => /delivered|entregue/i.test(order.fulfillment_status)).length;
  const metrics = [["Aguardando expedição", awaiting, PackageCheck], ["Em trânsito", inTransit, Truck], ["Entregues", delivered, CheckCircle2]] as const;
  return <div className="mx-auto max-w-[1500px]">
    <PageHeader eyebrow="Logística" title="Fretes" description="Cotações do checkout e pedidos que precisam de expedição." action={<Button asChild className="bg-[#17191b] !text-white hover:bg-black"><Link href="/admin/integracoes"><Settings2 /> Configurar integrações</Link></Button>} />
    <div className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${connected ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>{connected ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertTriangle className="size-5 shrink-0" />}<div><strong>{connected ? "Melhor Envio habilitado" : "Melhor Envio ainda não conectado"}</strong><p className="mt-1 leading-6">{connected ? "O checkout pode consultar fretes reais dos serviços liberados na conta. A compra e impressão de etiquetas deve ser homologada antes de ser automatizada." : "Adicione o token e o CEP de origem em Integrações. Em produção, a loja oferece apenas retirada enquanto o frete não estiver conectado."}</p></div></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3">{metrics.map(([label, value, Icon]) => <article key={label} className="metric-card rounded-3xl border border-zinc-200 bg-white p-5"><Icon className="size-5 text-zinc-500" /><p className="mt-4 text-sm text-zinc-500">{label}</p><strong className="mt-1 block text-2xl">{value.toLocaleString("pt-BR")}</strong></article>)}</div>
    <section className="metric-card overflow-hidden rounded-3xl border border-zinc-200 bg-white"><Table><TableHeader><TableRow><TableHead className="pl-6">Pedido</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Serviço escolhido</TableHead><TableHead>Pagamento</TableHead><TableHead>Expedição</TableHead></TableRow></TableHeader><TableBody>{orders.map((order) => <TableRow key={order.id}><TableCell className="pl-6 font-extrabold">#{order.public_number}</TableCell><TableCell className="text-zinc-500">{new Date(order.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell><TableCell>{order.customer.name || "Cliente"}</TableCell><TableCell>{order.shipping_service}</TableCell><TableCell><Badge className={order.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>{order.payment_status}</Badge></TableCell><TableCell>{order.fulfillment_status}</TableCell></TableRow>)}{orders.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-zinc-500">Nenhum pedido para expedir.</TableCell></TableRow>}</TableBody></Table></section>
  </div>;
}
