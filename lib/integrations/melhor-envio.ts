import "server-only";
import { calculateCart, packageForLine } from "@/lib/calculation";
import { cartFingerprint, createQuoteToken } from "@/lib/quote-token";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";
import { getStoreSettings } from "@/lib/store-settings";
import type { CartItem, ShippingOption, StoreProduct } from "@/lib/types";

type MelhorEnvSlim = {
  id?: number | string;
  name?: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: { name?: string };
};

export async function quoteShipping(postalCode: string, items: CartItem[], catalog: StoreProduct[]): Promise<{ options: ShippingOption[]; mode: "live" | "demo" | "pending_measurements" | "manual_quote"; warning?: string; manualQuote?: { url: string } }> {
  const cart = calculateCart(items, catalog);
  const settings = getStoreSettings();
  const threshold = Number(settings.largeOrderQuantityThreshold) || 0;
  const totalQuantity = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  if (threshold > 0 && totalQuantity >= threshold) {
    const message = [
      "Olá! Quero solicitar uma cotação de frete para este pedido:",
      ...cart.lines.map((line) => `• ${line.product.name} — ${line.quantity} un.`),
      `CEP de destino: ${postalCode}`,
      `Subtotal: R$ ${(cart.subtotalCents / 100).toFixed(2).replace(".", ",")}`,
    ].join("\n");
    return {
      options: [],
      mode: "manual_quote",
      warning: `Pedidos com ${threshold} itens ou mais precisam de cotação personalizada pelo WhatsApp.`,
      manualQuote: { url: `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` },
    };
  }
  const cartHash = cartFingerprint(items);
  const expires = Date.now() + 20 * 60_000;
  const pickupPayload = { id: "pickup", carrier: "Telas Jort", service: "Retirada na loja", priceCents: 0, deliveryDays: 0, postalCode, cartHash, exp: expires };
  const pickup: ShippingOption = { ...pickupPayload, quoteToken: createQuoteToken(pickupPayload), source: "pickup" };
  const config = getRuntimeIntegrationConfig("melhor_envio");
  const token = config.enabled ? config.secrets.token : undefined;

  if (!token) {
    if (process.env.NODE_ENV === "production") return { options: [pickup], mode: "pending_measurements", warning: "A entrega ainda não foi conectada. Por enquanto, somente a retirada na loja está disponível." };
    const demos = [
      { id: "demo-pac", carrier: "Correios", service: "PAC", priceCents: 4890, deliveryDays: 7 },
      { id: "demo-jadlog", carrier: "Jadlog", service: ".Package", priceCents: 4250, deliveryDays: 6 },
      { id: "demo-sedex", carrier: "Correios", service: "SEDEX", priceCents: 7690, deliveryDays: 3 },
    ].map((option): ShippingOption => {
      const payload = { ...option, postalCode, cartHash, exp: expires };
      return { ...option, quoteToken: createQuoteToken(payload), source: "demo" };
    });
    return { options: [pickup, ...demos], mode: "demo" };
  }

  if (cart.lines.some((line) => !line.product.measurement.freightVerified)) {
    return { options: [pickup], mode: "pending_measurements", warning: "A entrega automática está bloqueada até a loja conferir o peso e a embalagem de todos os itens. A retirada continua disponível." };
  }

  const production = config.environment === "production";
  const base = production ? "https://melhorenvio.com.br/api/v2" : "https://sandbox.melhorenvio.com.br/api/v2";
  const response = await fetch(`${base}/me/shipment/calculate`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "user-agent": config.publicConfig.userAgentEmail || "Telas Jort (tecnologia@telasjort.com.br)",
    },
    body: JSON.stringify({
      from: { postal_code: (config.publicConfig.originPostalCode || "87308830").replace(/\D/g, "") },
      to: { postal_code: postalCode },
      volumes: cart.lines.map(packageForLine),
      options: { receipt: false, own_hand: false },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("A transportadora não retornou uma cotação agora. Tente novamente.");
  const data = await response.json() as MelhorEnvSlim[];
  const live = data.filter((item) => !item.error && Number(item.custom_price || item.price) > 0).map((item): ShippingOption => {
    const id = String(item.id);
    const carrier = item.company?.name || "Transportadora";
    const service = item.name || "Entrega";
    const priceCents = Math.round(Number(item.custom_price || item.price) * 100);
    const deliveryDays = Number(item.custom_delivery_time || item.delivery_time || 0);
    const payload = { id, carrier, service, priceCents, deliveryDays, postalCode, cartHash, exp: expires };
    return { id, carrier, service, priceCents, deliveryDays, quoteToken: createQuoteToken(payload), source: "melhor_envio" };
  });
  return { options: [pickup, ...live], mode: "live" };
}
