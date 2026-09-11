import { IntegrationManager } from "@/components/admin/integration-manager";
import { PageHeader } from "@/components/admin/page-header";
import { listSafeRuntimeIntegrationConfigs } from "@/lib/integration-config";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const integrations = listSafeRuntimeIntegrationConfigs();
  const defaultTab = ["pagamentos", "fiscal", "fretes", "marketplaces", "google", "meta", "database"].includes(aba || "") ? aba as "pagamentos" | "fiscal" | "fretes" | "marketplaces" | "google" | "meta" | "database" : "pagamentos";
  return <div className="mx-auto max-w-[1200px]"><PageHeader eyebrow="Sistema" title="Central de integrações" description="Conecte pagamentos, emissão fiscal, fretes, marketplaces, conversões e banco de dados sem expor chaves secretas no código ou no navegador." /><IntegrationManager initialConfigs={integrations} appUrl={appUrl} defaultTab={defaultTab} /></div>;
}
