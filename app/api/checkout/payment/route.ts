import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateCart } from "@/lib/calculation";
import { getRuntimeProducts } from "@/lib/catalog-server";
import { createOrder, updateOrderPayment, validateCoupon } from "@/lib/database";
import { createMercadoPagoPayment } from "@/lib/integrations/mercado-pago";
import { sendMetaConversionEvent } from "@/lib/integrations/meta-conversions";
import { verifyQuoteToken } from "@/lib/quote-token";
import { allowRequest, clientIp, sameOriginRequest } from "@/lib/rate-limit";
import { getStoreSettings } from "@/lib/store-settings";
import { customerCookie, parseCustomerSession } from "@/lib/customer-auth";
import { getCustomerAccountById } from "@/lib/database";
import { issueFiscalInvoiceForOrder } from "@/lib/integrations/focus-nfe";

export const runtime = "nodejs";
const itemSchema = z.object({ lineId: z.string().min(1).max(100), productId: z.string().min(1).max(120), quantity: z.number().int().min(1).max(999), selection: z.object({ lengthM: z.number().positive().max(1000).optional(), heightM: z.number().positive().max(20).optional() }).optional() });
const customerSchema = z.object({
  name: z.string().trim().min(3).max(120), email: z.string().email().max(160), phone: z.string().min(10).max(25),
  document: z.string().min(11).max(22), postalCode: z.string().min(8).max(10), address: z.string().trim().min(3).max(180),
  number: z.string().trim().min(1).max(30), district: z.string().trim().max(100), city: z.string().trim().min(2).max(100), state: z.string().length(2),
});
const schema = z.object({
  items: z.array(itemSchema).min(1).max(50),
  shipping: z.object({ quoteToken: z.string().min(20) }).passthrough(),
  customer: customerSchema,
  couponCode: z.string().trim().min(3).max(30).optional(),
  paymentData: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "checkout", 12, 10 * 60_000)) return NextResponse.json({ error: "Muitas tentativas de pagamento. Aguarde alguns minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem da solicitação inválida" }, { status: 403 });
  try {
    const session = parseCustomerSession(request.cookies.get(customerCookie.name)?.value);
    const account = session ? await getCustomerAccountById(session.customerId) : null;
    if (!session || !account || account.email.toLowerCase() !== session.email) return NextResponse.json({ error: "Entre ou crie sua conta antes de finalizar a compra." }, { status: 401 });
    const input = schema.parse(await request.json());
    const quote = verifyQuoteToken(input.shipping.quoteToken, input.items);
    if (!quote) return NextResponse.json({ error: "A cotação do frete expirou. Calcule novamente." }, { status: 409 });
    const [products, settings] = await Promise.all([getRuntimeProducts(), getStoreSettings()]);
    const cart = calculateCart(input.items, products);
    const threshold = Number(settings.largeOrderQuantityThreshold) || 0;
    const totalQuantity = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
    if (threshold > 0 && totalQuantity >= threshold) return NextResponse.json({ error: "Este pedido precisa de cotação de frete pelo WhatsApp antes do pagamento." }, { status: 409 });
    const couponResult = input.couponCode ? await validateCoupon(input.couponCode, cart.subtotalCents) : null;
    if (couponResult && !couponResult.valid) return NextResponse.json({ error: couponResult.message }, { status: 409 });
    const discountCents = couponResult?.valid ? couponResult.discountCents : 0;
    const totalCents = Math.max(100, cart.subtotalCents + quote.priceCents - discountCents);
    const marketingConsent = request.cookies.get("tj_meta_consent")?.value === "granted";
    const attribution: Record<string, string> = marketingConsent ? {
      _metaFbp: request.cookies.get("_fbp")?.value || "",
      _metaFbc: request.cookies.get("_fbc")?.value || "",
      _metaClientIp: clientIp(request),
      _metaClientUserAgent: request.headers.get("user-agent") || "",
    } : {};
    const order = await createOrder({
      customerAccountId: account.id,
      customer: { ...input.customer, email: account.email, ...attribution },
      subtotalCents: cart.subtotalCents,
      shippingCents: quote.priceCents,
      shippingService: `${quote.carrier} · ${quote.service}`,
      shippingQuoteId: quote.id,
      discountCents,
      couponCode: couponResult?.valid ? couponResult.coupon.code : undefined,
      items: cart.lines.map((line) => ({
        productId: line.product.id, sku: line.product.sku, name: line.product.name, quantity: line.quantity,
        unitPriceCents: line.unitPriceCents, subtotalCents: line.subtotalCents, weightKg: line.weightKg,
        measurement: line.billedLengthM ? { lengthM: line.billedLengthM, heightM: line.billedHeightM, areaM2: line.billedAreaM2 } : undefined,
      })),
    });
    const paymentCustomer = { ...input.customer, email: account.email };
    const payment = await createMercadoPagoPayment({ orderPublicNumber: order.publicNumber, totalCents, customer: paymentCustomer, paymentData: input.paymentData });
    await updateOrderPayment(order.id, String(payment.status || "pending"), String(payment.id || ""), "mercado_pago");
    const approved = ["approved", "paid"].includes(String(payment.status || "").toLowerCase());
    const isDemo = input.paymentData.demo === true;
    if (approved && !isDemo) after(() => issueFiscalInvoiceForOrder(order.publicNumber).catch((error) => console.error("Automatic NF-e issuance failed", error)));
    const metaEventId = approved && !isDemo && marketingConsent ? `purchase-${order.publicNumber}` : undefined;
    if (metaEventId) await sendMetaConversionEvent({
      eventName: "Purchase",
      eventId: metaEventId,
      eventSourceUrl: new URL("/checkout", process.env.APP_URL || request.nextUrl.origin).toString(),
      customData: { value: totalCents / 100, currency: "BRL", content_type: "product", content_ids: cart.lines.map((line) => line.product.id), contents: cart.lines.map((line) => ({ id: line.product.id, quantity: line.quantity, item_price: line.unitPriceCents / 100 })) },
      userData: {
        email: account.email,
        phone: input.customer.phone,
        firstName: input.customer.name.split(/\s+/)[0],
        lastName: input.customer.name.split(/\s+/).slice(1).join(" "),
        city: input.customer.city,
        state: input.customer.state,
        postalCode: input.customer.postalCode,
        country: "br",
        externalId: input.customer.email,
        fbp: attribution._metaFbp,
        fbc: attribution._metaFbc,
        clientIpAddress: attribution._metaClientIp,
        clientUserAgent: attribution._metaClientUserAgent,
      },
    }).catch((error) => console.error("Meta Purchase failed", error));
    return NextResponse.json({ orderId: order.publicNumber, paymentStatus: payment.status || "pending", metaEventId });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Confira os dados do pedido." : error instanceof Error ? error.message : "Não foi possível concluir o pagamento.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
