"use client";

import { LoaderCircle, RotateCcw, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/format";

function parseMoney(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round(Number(normalized) * 100);
}

export function OrderRefundButton({ orderNumber, totalCents, refundedCents, paymentProviderId, customerRequest }: {
  orderNumber: string;
  totalCents: number;
  refundedCents: number;
  paymentProviderId: string | null;
  customerRequest?: { id: string; reason: string; requestedAmountCents: number };
}) {
  const router = useRouter();
  const remainingCents = Math.max(0, totalCents - refundedCents);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"total" | "partial">("total");
  const [amount, setAmount] = useState((remainingCents / 100).toFixed(2).replace(".", ","));
  const [reason, setReason] = useState(customerRequest?.reason || "Solicitação do cliente");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const amountCents = kind === "total" ? remainingCents : parseMoney(amount);
  const valid = useMemo(() => Number.isInteger(amountCents) && amountCents > 0 && amountCents <= remainingCents && reason.trim().length >= 5 && confirmation.trim().toUpperCase() === "ESTORNAR", [amountCents, remainingCents, reason, confirmation]);

  async function submit() {
    if (!valid) return toast.error("Confira o valor, o motivo e digite ESTORNAR para confirmar.");
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderNumber)}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents, reason, idempotencyKey, customerRequestId: customerRequest?.id }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; status?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível realizar o estorno.");
      toast.success(result.status === "processing" ? "Estorno solicitado ao provedor." : "Estorno realizado com sucesso.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível realizar o estorno.");
      setIdempotencyKey(crypto.randomUUID());
    } finally {
      setLoading(false);
    }
  }

  if (!paymentProviderId || remainingCents < 1) return null;
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setConfirmation(""); setIdempotencyKey(crypto.randomUUID()); } }}>
    <DialogTrigger asChild><Button size="sm" variant={customerRequest ? "destructive" : "outline"} className="rounded-xl"><RotateCcw /> {customerRequest ? "Analisar estorno" : "Estornar"}</Button></DialogTrigger>
    <DialogContent className="rounded-3xl">
      <DialogHeader><DialogTitle>Estornar pedido #{orderNumber}</DialogTitle><DialogDescription>Esta ação solicita uma devolução real ao meio de pagamento do comprador. Saldo disponível: {money(remainingCents)}.</DialogDescription></DialogHeader>
      {customerRequest && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Pedido do cliente:</strong><p className="mt-1 leading-6">{customerRequest.reason}</p></div>}
      <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setKind("total")} className={`rounded-2xl border-2 p-4 text-left ${kind === "total" ? "border-black bg-zinc-100" : "border-zinc-200"}`}><strong className="block">Todo o saldo</strong><span className="text-xs text-zinc-500">{money(remainingCents)}</span></button><button type="button" onClick={() => setKind("partial")} className={`rounded-2xl border-2 p-4 text-left ${kind === "partial" ? "border-black bg-zinc-100" : "border-zinc-200"}`}><strong className="block">Valor parcial</strong><span className="text-xs text-zinc-500">Escolher valor</span></button></div>
      {kind === "partial" && <div className="grid gap-2"><Label htmlFor={`refund-amount-${orderNumber}`}>Valor do estorno (R$)</Label><Input id={`refund-amount-${orderNumber}`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>}
      <div className="grid gap-2"><Label htmlFor={`refund-reason-${orderNumber}`}>Motivo</Label><Textarea id={`refund-reason-${orderNumber}`} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
      <div className="grid gap-2"><Label htmlFor={`refund-confirm-${orderNumber}`}>Digite ESTORNAR para confirmar</Label><Input id={`refund-confirm-${orderNumber}`} value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" /></div>
      <p className="flex gap-2 rounded-2xl bg-red-50 p-4 text-xs leading-5 text-red-900"><ShieldAlert className="mt-0.5 size-4 shrink-0" /> O painel só atualizará o pedido depois que o provedor aceitar a solicitação.</p>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button><Button variant="destructive" onClick={submit} disabled={loading || !valid}>{loading ? <LoaderCircle className="animate-spin" /> : <RotateCcw />} Confirmar estorno de {money(amountCents || 0)}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
