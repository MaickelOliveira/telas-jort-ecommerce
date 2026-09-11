"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RefundRequestButton({ orderNumber, disabled = false }: { orderNumber: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (reason.trim().length < 10) return toast.error("Explique o motivo em pelo menos 10 caracteres.");
    setSending(true);
    try {
      const response = await fetch(`/api/customer/orders/${encodeURIComponent(orderNumber)}/refund-request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar a solicitação.");
      toast.success("Solicitação enviada para a Telas Jort.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a solicitação.");
    } finally {
      setSending(false);
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" className="rounded-xl" disabled={disabled}><RotateCcw /> Solicitar estorno</Button></DialogTrigger>
    <DialogContent className="rounded-3xl">
      <DialogHeader><DialogTitle>Solicitar estorno do pedido #{orderNumber}</DialogTitle><DialogDescription>A loja analisará a situação antes de devolver o pagamento. O envio desta solicitação não realiza o estorno automaticamente.</DialogDescription></DialogHeader>
      <div className="grid gap-2"><Label htmlFor="refund-reason">Conte o motivo da solicitação</Label><Textarea id="refund-reason" rows={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: quero desistir da compra porque..." /></div>
      <p className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">Se o produto já tiver sido enviado ou cortado sob medida, a equipe entrará em contato para orientar os próximos passos.</p>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Voltar</Button><Button onClick={submit} disabled={sending} className="bg-[#17191b] text-white">{sending ? <LoaderCircle className="animate-spin" /> : <RotateCcw />} Enviar solicitação</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
