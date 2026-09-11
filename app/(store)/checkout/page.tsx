import type { Metadata } from "next";
import { CheckoutPage } from "@/components/checkout/checkout-page";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";
import { getStoreSettings } from "@/lib/store-settings";
import { requireCustomer } from "@/lib/customer-auth";
export const metadata: Metadata = { title: "Checkout" };
export default async function Page() {
  const customer = await requireCustomer("/checkout");
  const config = getRuntimeIntegrationConfig("mercado_pago");
  const settings = getStoreSettings();
  return <CheckoutPage
    mercadoPagoPublicKey={config.enabled ? config.publicConfig.publicKey : undefined}
    storeWhatsapp={settings.whatsapp}
    largeOrderQuantityThreshold={Number(settings.largeOrderQuantityThreshold) || null}
    account={{ name: customer.name, email: customer.email, phone: customer.phone }}
  />;
}
