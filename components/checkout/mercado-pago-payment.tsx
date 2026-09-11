"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { CreditCard, LockKeyhole, QrCode } from "lucide-react";
import { toast } from "sonner";
import type { CartItem, ShippingOption } from "@/lib/types";
import { trackPurchaseConversions } from "@/lib/client-analytics";

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options: { locale: string }) => {
      bricks: () => { create: (type: string, id: string, config: unknown) => Promise<{ unmount: () => void }> };
    };
  }
}

type Customer = { name: string; email: string; phone: string; document: string; postalCode: string; address: string; number: string; district: string; city: string; state: string };

export function MercadoPagoPayment({ publicKey, amountCents, items, shipping, customer, couponCode, onSuccess }: {
  publicKey?: string;
  amountCents: number;
  items: CartItem[];
  shipping: ShippingOption;
  customer: Customer;
  couponCode?: string;
  onSuccess: (orderId: string) => void;
}) {
  const controller = useRef<{ unmount: () => void } | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey || !sdkReady || !window.MercadoPago) return;
    let cancelled = false;
    const mount = async () => {
      await controller.current?.unmount();
      const mp = new window.MercadoPago!(publicKey, { locale: "pt-BR" });
      const brick = await mp.bricks().create("payment", "paymentBrick_container", {
        initialization: { amount: amountCents / 100, payer: { email: customer.email } },
        customization: { paymentMethods: { creditCard: "all", debitCard: "all", bankTransfer: "all" } },
        callbacks: {
          onReady: () => undefined,
          onError: (error: unknown) => { console.error(error); toast.error("Não foi possível carregar o pagamento."); },
          onSubmit: async ({ formData }: { formData: unknown }) => {
            const response = await fetch("/api/checkout/payment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, shipping, customer, couponCode, paymentData: formData }) });
            const result = await response.json() as { error?: string; orderId?: string; paymentStatus?: string; metaEventId?: string };
            if (!response.ok) throw new Error(result.error || "Pagamento não concluído");
            if (!result.orderId) throw new Error("Pedido não confirmado pelo servidor.");
            if (result.metaEventId && ["approved", "paid"].includes(String(result.paymentStatus || "").toLowerCase())) trackPurchaseConversions({ orderId: result.orderId, value: amountCents / 100, customer, metaEventId: result.metaEventId });
            onSuccess(result.orderId);
          },
        },
      });
      if (!cancelled) controller.current = brick;
    };
    mount().catch(() => toast.error("Não foi possível iniciar o Mercado Pago."));
    return () => { cancelled = true; controller.current?.unmount(); controller.current = null; };
  }, [publicKey, sdkReady, amountCents, items, shipping, customer, couponCode, onSuccess]);

  if (publicKey) return <div><Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onLoad={() => setSdkReady(true)} /><div id="paymentBrick_container" /><p className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><LockKeyhole className="size-4" /> Os dados do cartão são enviados diretamente ao Mercado Pago.</p></div>;

  const demoPay = async (method: "pix" | "card") => {
    setLoading(true);
    try {
      const response = await fetch("/api/checkout/payment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, shipping, customer, couponCode, paymentData: { payment_method_id: method, demo: true } }) });
      const result = await response.json() as { error?: string; orderId?: string; paymentStatus?: string; metaEventId?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o pedido");
      if (!result.orderId) throw new Error("Pedido não confirmado pelo servidor.");
      if (result.metaEventId && ["approved", "paid"].includes(String(result.paymentStatus || "").toLowerCase())) trackPurchaseConversions({ orderId: result.orderId, value: amountCents / 100, customer, metaEventId: result.metaEventId });
      onSuccess(result.orderId);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro no pagamento"); }
    finally { setLoading(false); }
  };

  return <div className="grid gap-3"><div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Modo de demonstração.</strong> Nenhum dinheiro será cobrado até as credenciais de teste do Mercado Pago serem configuradas.</div><button disabled={loading} onClick={() => demoPay("pix")} className="flex items-center justify-between rounded-xl border-2 border-zinc-200 p-4 text-left hover:border-zinc-900"><span className="flex items-center gap-3"><QrCode /><span><strong className="block">Simular pagamento Pix</strong><small className="text-zinc-500">Aprovação de teste</small></span></span></button><button disabled={loading} onClick={() => demoPay("card")} className="flex items-center justify-between rounded-xl border-2 border-zinc-200 p-4 text-left hover:border-zinc-900"><span className="flex items-center gap-3"><CreditCard /><span><strong className="block">Simular cartão</strong><small className="text-zinc-500">Sem informar dados reais</small></span></span></button></div>;
}
