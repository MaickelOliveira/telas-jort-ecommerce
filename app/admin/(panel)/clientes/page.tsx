import { Users } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listCustomerAccounts, listStoredOrders } from "@/lib/database";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function ClientsPage() {
  const orders = listStoredOrders(5000);
  const map = new Map<string, { name: string; email: string; phone: string; city: string; state: string; orders: number; total: number; last: string }>();
  for (const order of orders) {
    const customer = order.customer as Record<string, string>;
    const key = (customer.email || customer.phone || String(order.id)).toLowerCase();
    const current = map.get(key);
    map.set(key, {
      name: customer.name || "Cliente",
      email: customer.email || "",
      phone: customer.phone || "",
      city: customer.city || "",
      state: customer.state || "",
      orders: (current?.orders || 0) + 1,
      total: (current?.total || 0) + Number(order.status === "paid" ? order.total_cents : 0),
      last: current && new Date(current.last) > new Date(String(order.created_at)) ? current.last : String(order.created_at),
    });
  }
  const accounts = listCustomerAccounts();
  for (const account of accounts) {
    const key = account.email.toLowerCase();
    if (!map.has(key)) map.set(key, { name: account.name, email: account.email, phone: account.phone, city: "", state: "", orders: 0, total: 0, last: account.created_at });
  }
  const clients = [...map.entries()].map(([id, client]) => ({ id, ...client })).sort((a, b) => new Date(b.last).getTime() - new Date(a.last).getTime());
  const repeat = clients.length ? clients.filter((client) => client.orders > 1).length / clients.length * 100 : 0;
  const totalSpent = clients.reduce((sum, client) => sum + client.total, 0);
  return <div className="mx-auto max-w-[1500px]">
    <PageHeader eyebrow="Relacionamento" title="Clientes" description="Cadastros da área do cliente e histórico real dos pedidos vinculados." />
    <div className="mb-5 grid gap-4 sm:grid-cols-3">{[["Contas cadastradas", accounts.length.toLocaleString("pt-BR")], ["Compraram mais de uma vez", `${repeat.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`], ["Valor médio confirmado", money(clients.length ? Math.round(totalSpent / clients.length) : 0)]].map(([label, value]) => <article key={label} className="metric-card rounded-3xl border border-zinc-200 bg-white p-5"><p className="text-sm text-zinc-500">{label}</p><strong className="mt-2 block text-2xl">{value}</strong></article>)}</div>
    <section className="metric-card overflow-hidden rounded-3xl border border-zinc-200 bg-white"><Table><TableHeader><TableRow><TableHead className="pl-6">Cliente</TableHead><TableHead>Contato</TableHead><TableHead>Cidade</TableHead><TableHead>Pedidos</TableHead><TableHead>Total confirmado</TableHead><TableHead>Último pedido</TableHead></TableRow></TableHeader><TableBody>{clients.map((client) => <TableRow key={client.id}><TableCell className="pl-6"><strong>{client.name}</strong></TableCell><TableCell><span className="block text-sm">{client.email}</span><span className="text-xs text-zinc-500">{client.phone}</span></TableCell><TableCell>{client.city}{client.state ? ` — ${client.state}` : ""}</TableCell><TableCell>{client.orders}</TableCell><TableCell className="font-bold">{money(client.total)}</TableCell><TableCell>{new Date(client.last).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell></TableRow>)}{clients.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center"><Users className="mx-auto mb-2 text-zinc-400" /><span className="text-zinc-500">Nenhum cliente registrado ainda.</span></TableCell></TableRow>}</TableBody></Table></section>
  </div>;
}
