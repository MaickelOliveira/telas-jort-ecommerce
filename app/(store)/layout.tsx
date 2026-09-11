import { AnalyticsHeartbeat } from "@/components/store/analytics-heartbeat";
import { CatalogProvider } from "@/components/store/catalog-provider";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { getRuntimeProducts } from "@/lib/catalog-server";
import { MarketingTags } from "@/components/store/meta-pixel";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";
import { currentCustomer } from "@/lib/customer-auth";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [runtimeProducts, meta, googleAds, customer] = await Promise.all([
    getRuntimeProducts(),
    getRuntimeIntegrationConfig("meta_conversions"),
    getRuntimeIntegrationConfig("google_ads"),
    currentCustomer(),
  ]);
  const products = runtimeProducts.filter((product) => product.active);
  return <CatalogProvider products={products}><div className="jort-store min-h-screen bg-white"><StoreHeader customerName={customer?.name} /><AnalyticsHeartbeat /><MarketingTags pixelId={meta.enabled ? meta.publicConfig.pixelId : undefined} googleAdsId={googleAds.enabled ? googleAds.publicConfig.conversionId : undefined} googlePurchaseLabel={googleAds.enabled ? googleAds.publicConfig.purchaseLabel : undefined} />{children}<StoreFooter /></div></CatalogProvider>;
}

export const dynamic = "force-dynamic";
