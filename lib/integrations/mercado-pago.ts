import "server-only";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";

type MercadoPagoPaymentResult = { id?: number | string; status?: string; status_detail?: string; external_reference?: string; transaction_amount_refunded?: number };

export async function createMercadoPagoPayment(input: {
  orderPublicNumber: string;
  totalCents: number;
  customer: Record<string, string>;
  paymentData: Record<string, unknown>;
}) {
  const config = getRuntimeIntegrationConfig("mercado_pago");
  const token = config.enabled ? config.secrets.accessToken : undefined;
  if (input.paymentData.demo === true) {
    if (process.env.NODE_ENV === "production") throw new Error("Pagamentos simulados estão desativados em produção.");
    return { id: `demo-${Date.now()}`, status: "approved", status_detail: "accredited", external_reference: input.orderPublicNumber };
  }
  if (!token) {
    if (process.env.NODE_ENV === "production") throw new Error("Pagamento ainda não está configurado.");
    return { id: `demo-${Date.now()}`, status: "approved", status_detail: "accredited", external_reference: input.orderPublicNumber };
  }
  const allowed = ["token", "issuer_id", "payment_method_id", "transaction_amount", "installments", "payer"];
  const paymentData = Object.fromEntries(Object.entries(input.paymentData).filter(([key]) => allowed.includes(key)));
  const payerFromBrick = typeof paymentData.payer === "object" && paymentData.payer ? paymentData.payer as Record<string, unknown> : {};
  const document = input.customer.document.replace(/\D/g, "");
  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      ...paymentData,
      transaction_amount: input.totalCents / 100,
      description: `Pedido ${input.orderPublicNumber} — Telas Jort`,
      external_reference: input.orderPublicNumber,
      notification_url: process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}/api/webhooks/mercado-pago` : undefined,
      payer: {
        ...payerFromBrick,
        email: input.customer.email,
        first_name: input.customer.name.split(" ")[0],
        last_name: input.customer.name.split(" ").slice(1).join(" "),
        identification: { type: document.length === 11 ? "CPF" : "CNPJ", number: document },
      },
      additional_info: { items: [] },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json() as MercadoPagoPaymentResult & { message?: string };
  if (!response.ok) throw new Error(result.message || "Pagamento recusado pelo Mercado Pago.");
  return result;
}

export async function fetchMercadoPagoPayment(id: string) {
  const token = getRuntimeIntegrationConfig("mercado_pago").secrets.accessToken;
  if (!token) throw new Error("Mercado Pago não configurado.");
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Não foi possível confirmar o pagamento.");
  return response.json() as Promise<MercadoPagoPaymentResult>;
}

export async function refundMercadoPagoPayment(input: { paymentId: string; amountCents: number; full: boolean; idempotencyKey: string }) {
  if (!input.paymentId || input.paymentId.startsWith("demo-")) throw new Error("Pagamentos de demonstração não movimentam dinheiro e não podem ser estornados.");
  const config = getRuntimeIntegrationConfig("mercado_pago");
  if (!config.enabled || !config.secrets.accessToken) throw new Error("Configure e habilite o Mercado Pago antes de realizar o estorno.");
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(input.paymentId)}/refunds`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.secrets.accessToken}`,
      "content-type": "application/json",
      "x-idempotency-key": input.idempotencyKey,
    },
    body: JSON.stringify(input.full ? {} : { amount: input.amountCents / 100 }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({})) as { id?: string | number; status?: string; message?: string; cause?: Array<{ description?: string }> };
  if (!response.ok) throw new Error(result.cause?.[0]?.description || result.message || "O Mercado Pago recusou o estorno.");
  return { id: result.id ? String(result.id) : undefined, status: String(result.status || "approved") };
}
