"use client";

import { Activity, Check, CheckCircle2, CircleAlert, Clipboard, CreditCard, ExternalLink, FileText, KeyRound, LoaderCircle, PackageCheck, Save, ShieldCheck, Store, TestTube2, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Provider = "mercado_pago" | "appmax" | "melhor_envio" | "google_merchant" | "carrier_direct" | "mercado_livre" | "shopee" | "meta_conversions" | "google_ads" | "focus_nfe";
export type SafeIntegrationConfig = {
  provider: Provider;
  enabled: boolean;
  environment: "sandbox" | "production";
  publicConfig: Record<string, string>;
  secretKeys: string[];
  lastTestStatus: "success" | "failed" | null;
  lastTestMessage: string | null;
  lastTestedAt: string | null;
  updatedAt: string | null;
};

type FieldDefinition = { key: string; label: string; help?: string; placeholder?: string; type?: string; secret?: boolean; required?: boolean };

const definitions: Record<Provider, {
  title: string;
  description: string;
  icon: typeof CreditCard;
  publicFields: FieldDefinition[];
  secretFields: FieldDefinition[];
  note?: string;
  docsUrl?: string;
  docsLabel?: string;
  activationLocked?: boolean;
  activationLabel?: string;
  activationHelp?: string;
}> = {
  mercado_pago: {
    title: "Mercado Pago",
    description: "Checkout transparente com Pix, cartão e boleto. O cartão é tokenizado pelo SDK oficial.",
    icon: CreditCard,
    publicFields: [{ key: "publicKey", label: "Public Key", placeholder: "APP_USR-..." }],
    secretFields: [
      { key: "accessToken", label: "Access Token", placeholder: "APP_USR-...", secret: true },
      { key: "webhookSecret", label: "Assinatura secreta do webhook", placeholder: "Assinatura configurada no Mercado Pago", secret: true },
    ],
  },
  appmax: {
    title: "Appmax",
    description: "Gateway e checkout alternativo com autenticação oficial do merchant.",
    icon: PackageCheck,
    publicFields: [
      { key: "externalId", label: "External ID", help: "Necessário para tokenizar cartões com Appmax JS." },
      { key: "appId", label: "App ID", help: "Usado para conferir a origem dos webhooks da Appstore." },
      { key: "siteId", label: "Site ID", help: "Identificador da loja/instalação na Appmax." },
      { key: "softDescriptor", label: "Nome na fatura", placeholder: "TELASJORT" },
    ],
    secretFields: [
      { key: "clientId", label: "Merchant Client ID", secret: true },
      { key: "clientSecret", label: "Merchant Client Secret", secret: true },
    ],
    note: "A conexão da API pode ser testada aqui. A ativação como checkout principal deve ocorrer somente após homologar pagamentos e webhooks no sandbox da Appmax.",
  },
  melhor_envio: {
    title: "Melhor Envio",
    description: "Cotações de Correios e transportadoras conforme CEP, peso e embalagem de cada item.",
    icon: Truck,
    publicFields: [
      { key: "originPostalCode", label: "CEP de origem", placeholder: "87308830" },
      { key: "userAgentEmail", label: "Identificação técnica", placeholder: "Telas Jort (email@dominio.com.br)" },
    ],
    secretFields: [{ key: "token", label: "Token de acesso", secret: true }],
  },
  google_merchant: {
    title: "Google Merchant Center",
    description: "Feed do catálogo para Google Shopping e listagens gratuitas.",
    icon: ExternalLink,
    publicFields: [
      { key: "merchantId", label: "ID da conta Merchant Center", placeholder: "123456789" },
      { key: "businessName", label: "Nome da empresa", placeholder: "Telas Jort" },
    ],
    secretFields: [],
    note: "Depois de salvar, confirme o domínio e as políticas da loja dentro do Merchant Center.",
  },
  carrier_direct: {
    title: "Transportadora com contrato direto",
    description: "Guarde os dados do contrato para criar um adaptador específico fora do Melhor Envio.",
    icon: Truck,
    publicFields: [
      { key: "carrierType", label: "Transportadora", placeholder: "correios" },
      { key: "carrierName", label: "Nome do contrato", placeholder: "Contrato Telas Jort" },
      { key: "apiBaseUrl", label: "URL oficial da API (HTTPS)", placeholder: "https://api.transportadora.com.br" },
      { key: "contractCode", label: "Código do contrato" },
      { key: "accountCode", label: "Código/cartão de postagem" },
    ],
    secretFields: [
      { key: "apiToken", label: "Token/API Key", secret: true },
      { key: "apiSecret", label: "Senha/Client Secret", secret: true },
    ],
    note: "Cada transportadora usa campos e regras diferentes. Por segurança, o painel não envia testes para uma URL arbitrária; o adaptador deve ser homologado antes de ativar a cotação.",
  },
  mercado_livre: {
    title: "Mercado Livre",
    description: "Conecte a conta de vendedor para preparar anúncios, estoque e entrada de pedidos no painel.",
    icon: Store,
    publicFields: [
      { key: "appId", label: "App ID / Client ID", placeholder: "ID da aplicação" },
      { key: "userId", label: "ID do vendedor", placeholder: "Preenchido conforme a conta", required: false },
      { key: "siteId", label: "País da conta", placeholder: "MLB", help: "Para o Brasil, utilize MLB.", required: false },
    ],
    secretFields: [
      { key: "clientSecret", label: "Client Secret", secret: true },
      { key: "accessToken", label: "Access Token", secret: true },
      { key: "refreshToken", label: "Refresh Token", secret: true, required: false, help: "Recomendado para renovar o acesso sem desconectar a conta." },
    ],
    note: "As compras do Mercado Livre continuam no checkout e no frete do próprio marketplace. O painel centraliza a operação depois da autorização da conta.",
    docsUrl: "https://developers.mercadolivre.com.br/",
    docsLabel: "Abrir portal de desenvolvedores",
  },
  shopee: {
    title: "Shopee",
    description: "Conecte uma loja autorizada na Open Platform para preparar produtos, estoque e pedidos.",
    icon: Store,
    publicFields: [
      { key: "partnerId", label: "Partner ID", placeholder: "ID do parceiro" },
      { key: "shopId", label: "Shop ID", placeholder: "ID da loja" },
      { key: "region", label: "Região", placeholder: "BR", help: "Para a loja brasileira, utilize BR.", required: false },
    ],
    secretFields: [
      { key: "partnerKey", label: "Partner Key", secret: true },
      { key: "accessToken", label: "Access Token", secret: true },
      { key: "refreshToken", label: "Refresh Token", secret: true, required: false, help: "Recomendado para renovar o acesso da loja." },
    ],
    note: "A Shopee precisa aprovar/autorizar a aplicação. A compra e o pagamento permanecem dentro da Shopee; o pedido é trazido para este painel.",
    docsUrl: "https://open.shopee.com/",
    docsLabel: "Abrir Shopee Open Platform",
  },
  meta_conversions: {
    title: "Meta Pixel + API de Conversões",
    description: "Mede o funil no navegador e no servidor, com deduplicação dos eventos para Facebook e Instagram.",
    icon: Activity,
    publicFields: [
      { key: "pixelId", label: "ID do conjunto de dados / Pixel", placeholder: "Ex.: 123456789012345" },
      { key: "graphApiVersion", label: "Versão da Graph API", placeholder: "v25.0", help: "Pode ser atualizada sem alterar o código da loja." },
      { key: "testEventCode", label: "Código de evento de teste", placeholder: "TEST12345", help: "Copie em Gerenciador de Eventos → Testar eventos. Remova depois da validação para enviar eventos reais." },
    ],
    secretFields: [{ key: "accessToken", label: "Token da API de Conversões", secret: true, help: "Gere no Gerenciador de Eventos. Ele fica cifrado e nunca é enviado ao navegador." }],
    note: "A qualidade depende de consentimento, eventos corretos e dados reais. A loja envia e-mail, telefone, nome, cidade, estado, CEP, IP, navegador, _fbp e _fbc quando disponíveis e permitidos. Os identificadores pessoais são normalizados e criptografados com SHA-256 antes do envio.",
    docsUrl: "https://developers.facebook.com/docs/marketing-api/conversions-api/",
    docsLabel: "Abrir documentação oficial da Meta",
  },
  google_ads: {
    title: "Google Ads — tag de conversão",
    description: "Instala a Google tag em toda a loja e registra compras com valor, moeda e número único do pedido.",
    icon: Activity,
    publicFields: [
      { key: "conversionId", label: "ID da Google tag", placeholder: "AW-123456789" },
      { key: "purchaseLabel", label: "Rótulo da conversão de compra", placeholder: "AbCdEFghIjkLMn" },
    ],
    secretFields: [],
    note: "Crie no Google Ads uma ação de conversão de compra usando valores diferentes. O número do pedido é enviado como transaction_id para impedir duplicidade. Os dados fornecidos pelo cliente podem complementar a medição somente após consentimento.",
    docsUrl: "https://support.google.com/google-ads/answer/6095821?hl=pt-BR",
    docsLabel: "Abrir ajuda oficial do Google Ads",
  },
  focus_nfe: {
    title: "Focus NFe — emissão automática",
    description: "Emite a NF-e de produto automaticamente quando o pagamento do pedido é aprovado.",
    icon: FileText,
    publicFields: [
      { key: "issuerCnpj", label: "CNPJ do emitente", placeholder: "Somente os 14 números" },
      { key: "issuerState", label: "UF do emitente", placeholder: "PR", help: "Usada para identificar venda interna ou interestadual." },
      { key: "taxRegime", label: "Regime tributário", placeholder: "1", help: "1 = Simples Nacional; 2 = excesso de sublimite; 3 = regime normal." },
      { key: "natureOperation", label: "Natureza da operação", placeholder: "Venda de mercadoria" },
      { key: "freightMode", label: "Modalidade padrão do frete", placeholder: "0", help: "0 = emitente; 1 = destinatário; 2 = terceiros; 9 = sem frete." },
      { key: "defaultCfop", label: "CFOP padrão (opcional)", placeholder: "5102", required: false, help: "Só é usado quando o produto não tiver CFOP próprio." },
      { key: "defaultNcm", label: "NCM padrão (opcional)", placeholder: "8 números", required: false, help: "Prefira cadastrar o NCM correto em cada produto." },
      { key: "defaultUnit", label: "Unidade padrão (opcional)", placeholder: "UN", required: false },
      { key: "defaultOrigin", label: "Origem padrão (opcional)", placeholder: "0", required: false },
      { key: "defaultIcmsCst", label: "CST/CSOSN ICMS padrão (opcional)", placeholder: "102", required: false },
      { key: "defaultPisCst", label: "CST PIS padrão (opcional)", placeholder: "49", required: false },
      { key: "defaultCofinsCst", label: "CST COFINS padrão (opcional)", placeholder: "49", required: false },
    ],
    secretFields: [
      { key: "token", label: "Token da Focus NFe", secret: true },
      { key: "webhookSecret", label: "Segredo do webhook", secret: true, help: "Cadastre este valor como Authorization no webhook da Focus NFe." },
    ],
    note: "Antes de habilitar em produção, valide CNPJ, certificado digital, NCM, CFOP, CST/CSOSN, PIS e COFINS com o contador. Pedidos com cadastro fiscal incompleto são bloqueados e ficam sinalizados; a plataforma não inventa tributação.",
    docsUrl: "https://doc.focusnfe.com.br/reference/emitir_nfe",
    docsLabel: "Abrir documentação oficial da Focus NFe",
  },
};

function copy(value: string, label: string) {
  navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado`)).catch(() => toast.error("Não foi possível copiar."));
}

export function IntegrationManager({ initialConfigs, appUrl, defaultTab = "pagamentos" }: { initialConfigs: SafeIntegrationConfig[]; appUrl: string; defaultTab?: "pagamentos" | "fiscal" | "fretes" | "marketplaces" | "google" | "meta" }) {
  const [configs, setConfigs] = useState(initialConfigs);
  const byProvider = useMemo(() => Object.fromEntries(configs.map((config) => [config.provider, config])) as Record<Provider, SafeIntegrationConfig>, [configs]);
  const updateConfig = (config: SafeIntegrationConfig) => setConfigs((current) => current.map((item) => item.provider === config.provider ? config : item));
  const feedUrl = `${appUrl}/feeds/google-shopping.xml`;
  return <Tabs defaultValue={defaultTab} className="gap-6">
    <TabsList className="admin-integration-tabs h-14 w-full justify-start overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm" variant="default">
      <TabsTrigger className="admin-integration-tab h-11 rounded-xl px-4 font-bold focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-[#fff100] data-[state=active]:shadow-none" value="pagamentos"><CreditCard /> Pagamentos</TabsTrigger>
      <TabsTrigger className="admin-integration-tab h-11 rounded-xl px-4 font-bold focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-[#fff100] data-[state=active]:shadow-none" value="fiscal"><FileText /> Fiscal</TabsTrigger>
      <TabsTrigger className="admin-integration-tab h-11 rounded-xl px-4 font-bold focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-[#fff100] data-[state=active]:shadow-none" value="fretes"><Truck /> Fretes</TabsTrigger>
      <TabsTrigger className="admin-integration-tab h-11 rounded-xl px-4 font-bold focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-[#fff100] data-[state=active]:shadow-none" value="marketplaces"><Store /> Marketplaces</TabsTrigger>
      <TabsTrigger className="admin-integration-tab h-11 rounded-xl px-4 font-bold focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-[#fff100] data-[state=active]:shadow-none" value="google"><ExternalLink /> Google Shopping</TabsTrigger>
      <TabsTrigger className="admin-integration-tab h-11 rounded-xl px-4 font-bold focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-[state=active]:bg-[#fff100] data-[state=active]:shadow-none" value="meta"><Activity /> Conversões</TabsTrigger>
    </TabsList>
    <TabsContent value="pagamentos" className="admin-integration-grid grid items-stretch gap-5 xl:grid-cols-2">
      <IntegrationCard config={byProvider.mercado_pago} definition={definitions.mercado_pago} onUpdate={updateConfig} webhookUrl={`${appUrl}/api/webhooks/mercado-pago`} />
      <IntegrationCard config={byProvider.appmax} definition={definitions.appmax} onUpdate={updateConfig} webhookUrl={`${appUrl}/api/webhooks/appmax`} />
      <div className="rounded-3xl bg-[#17191b] p-6 text-white xl:col-span-2"><ShieldCheck className="text-[#fff100]" /><h3 className="mt-4 text-lg font-extrabold">Dados de cartão não ficam no servidor da loja</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">O Mercado Pago usa o Brick oficial. Para Appmax, a homologação deve usar Appmax JS. As chaves privadas ficam cifradas no banco e somente o proprietário pode substituí-las.</p></div>
    </TabsContent>
    <TabsContent value="fiscal" className="admin-integration-grid grid items-stretch gap-5 xl:grid-cols-2">
      <IntegrationCard config={byProvider.focus_nfe} definition={definitions.focus_nfe} onUpdate={updateConfig} webhookUrl={`${appUrl}/api/webhooks/focus-nfe`} />
      <section className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-4 sm:p-6">
        <div className="grid size-12 place-items-center rounded-2xl bg-[#fff100]"><FileText /></div>
        <h3 className="mt-5 text-lg font-extrabold">Fluxo automático e seguro</h3>
        <ol className="mt-4 grid gap-4 text-sm leading-6 text-zinc-600">
          <li><strong className="text-zinc-950">1. Pagamento aprovado:</strong> o webhook do checkout confirma o pagamento antes de iniciar a emissão.</li>
          <li><strong className="text-zinc-950">2. Validação fiscal:</strong> cada item precisa ter NCM, CFOP, unidade, origem e tributação cadastrados.</li>
          <li><strong className="text-zinc-950">3. Emissão única:</strong> o número público do pedido vira a referência idempotente e evita nota duplicada.</li>
          <li><strong className="text-zinc-950">4. Retorno:</strong> status, chave, XML e DANFE ficam vinculados ao pedido quando a Focus NFe concluir o processamento.</li>
        </ol>
        <p className="mt-auto rounded-xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"><ShieldCheck className="mr-2 inline size-4" /> Comece em homologação. Produção só deve ser habilitada depois da validação do contador e de uma nota de teste autorizada.</p>
      </section>
    </TabsContent>
    <TabsContent value="fretes" className="admin-integration-grid grid items-stretch gap-5 xl:grid-cols-2">
      <IntegrationCard config={byProvider.melhor_envio} definition={definitions.melhor_envio} onUpdate={updateConfig} />
      <IntegrationCard config={byProvider.carrier_direct} definition={definitions.carrier_direct} onUpdate={updateConfig} carrierSelect />
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 xl:col-span-2"><h3 className="text-lg font-extrabold">Transportadoras previstas</h3><p className="mt-2 text-sm leading-6 text-zinc-500">Pelo Melhor Envio, o painel consome os serviços liberados na conta. Contratos diretos entram pelo adaptador específico.</p><div className="mt-5 flex flex-wrap gap-2">{["Correios", "Jadlog", "J&T Express", "Loggi", "LATAM Cargo", "Azul Cargo", "Buslog", "Retirada na loja"].map((name) => <Badge key={name} variant="secondary" className="rounded-full px-3 py-1.5">{name}</Badge>)}</div></section>
    </TabsContent>
    <TabsContent value="marketplaces" className="admin-integration-grid grid items-stretch gap-5 xl:grid-cols-2">
      <IntegrationCard config={byProvider.mercado_livre} definition={definitions.mercado_livre} onUpdate={updateConfig} />
      <IntegrationCard config={byProvider.shopee} definition={definitions.shopee} onUpdate={updateConfig} />
      <section className="rounded-3xl bg-[#17191b] p-6 text-white xl:col-span-2"><Store className="text-[#fff100]" /><h3 className="mt-4 text-lg font-extrabold">Uma operação, três canais de venda</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">O site próprio, o Mercado Livre e a Shopee usam anúncios e checkouts separados. Produtos por metro ou m² precisam ser publicados nos marketplaces como medidas fixas ou pacotes; o painel ajuda a identificar esses itens antes da sincronização.</p></section>
    </TabsContent>
    <TabsContent value="google" className="admin-integration-grid grid items-stretch gap-5 xl:grid-cols-2">
      <IntegrationCard config={byProvider.google_merchant} definition={definitions.google_merchant} onUpdate={updateConfig} />
      <section className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-6"><div className="grid size-12 place-items-center rounded-2xl bg-[#fff100]"><ExternalLink /></div><h3 className="mt-5 text-lg font-extrabold">Feed já criado</h3><p className="mt-2 text-sm leading-6 text-zinc-500">Cadastre este endereço como fonte de dados programada no Merchant Center.</p><div className="mt-4 rounded-xl bg-zinc-100 p-4"><code className="block overflow-x-auto text-xs">{feedUrl}</code><Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => copy(feedUrl, "Endereço do feed")}><Clipboard /> Copiar endereço</Button></div><p className="mt-auto flex gap-2 pt-5 text-xs leading-5 text-amber-800"><CircleAlert className="size-4 shrink-0" /> Produtos vendidos por corte ficam fora do feed até preço, peso e disponibilidade estarem conferidos.</p></section>
    </TabsContent>
    <TabsContent value="meta" className="admin-integration-grid grid items-stretch gap-5 xl:grid-cols-2">
      <IntegrationCard config={byProvider.meta_conversions} definition={definitions.meta_conversions} onUpdate={updateConfig} />
      <IntegrationCard config={byProvider.google_ads} definition={definitions.google_ads} onUpdate={updateConfig} />
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 xl:col-span-2"><div className="grid size-12 place-items-center rounded-2xl bg-[#fff100]"><Activity /></div><h3 className="mt-5 text-lg font-extrabold">Medição preparada com consentimento</h3><p className="mt-2 text-sm leading-6 text-zinc-500">Meta: PageView, ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo e Purchase. Google Ads: tag em todas as páginas e conversão de compra com valor e transaction_id. O banner permite aceitar ou recusar cookies de marketing.</p></section>
    </TabsContent>
  </Tabs>;
}

function IntegrationCard({ config, definition, onUpdate, webhookUrl, carrierSelect = false }: {
  config: SafeIntegrationConfig;
  definition: (typeof definitions)[Provider];
  onUpdate: (config: SafeIntegrationConfig) => void;
  webhookUrl?: string;
  carrierSelect?: boolean;
}) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [environment, setEnvironment] = useState(config.environment);
  const [publicConfig, setPublicConfig] = useState(config.publicConfig);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const Icon = definition.icon;
  const requiredPublicFields = definition.publicFields.filter((field) => field.required !== false);
  const requiredSecretFields = definition.secretFields.filter((field) => field.required !== false);
  const configured = (requiredPublicFields.length > 0 || requiredSecretFields.length > 0)
    && requiredPublicFields.every((field) => Boolean(publicConfig[field.key]))
    && requiredSecretFields.every((field) => config.secretKeys.includes(field.key));

  const save = async (quiet = false) => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", provider: config.provider, enabled, environment, publicConfig, secrets }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; config?: SafeIntegrationConfig };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      if (!result.config) throw new Error("O servidor não confirmou a configuração.");
      onUpdate(result.config); setSecrets({});
      if (!quiet) toast.success(`${definition.title}: configuração salva`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
      return false;
    } finally { setSaving(false); }
  };

  const test = async () => {
    if (!(await save(true))) return;
    setTesting(true);
    try {
      const response = await fetch("/api/admin/integrations", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test", provider: config.provider }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string; config?: SafeIntegrationConfig };
      if (result.config) onUpdate(result.config);
      if (!response.ok) throw new Error(result.message || result.error || "Conexão não validada.");
      toast.success(result.message || "Conexão validada");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha no teste"); }
    finally { setTesting(false); }
  };

  return <section className="metric-card flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-zinc-100"><Icon /></span><StatusBadge config={config} configured={configured} /></div>
    <h2 className="mt-5 text-xl font-extrabold">{definition.title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-zinc-500">{definition.description}</p>
    <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4"><span className="min-w-0"><strong className="block text-sm">{definition.activationLabel || "Integração habilitada"}</strong><small className="text-zinc-500">{definition.activationHelp || "Use produção somente após os testes"}</small></span><Switch className="shrink-0" checked={enabled} onCheckedChange={setEnabled} disabled={definition.activationLocked} /></div>
    <div className="mt-4 grid gap-2"><Label>Ambiente</Label><Select value={environment} onValueChange={(value) => setEnvironment(value as "sandbox" | "production")}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sandbox">Sandbox / testes</SelectItem><SelectItem value="production">Produção / cobranças reais</SelectItem></SelectContent></Select></div>
    <div className="mt-5 grid gap-4">
      {definition.publicFields.map((field) => carrierSelect && field.key === "carrierType" ? <div className="grid gap-2" key={field.key}><Label>{field.label}</Label><Select value={publicConfig[field.key] || "correios"} onValueChange={(value) => setPublicConfig((current) => ({ ...current, [field.key]: value }))}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{[["correios", "Correios"], ["jadlog", "Jadlog"], ["jt", "J&T Express"], ["loggi", "Loggi"], ["azul", "Azul Cargo"], ["latam", "LATAM Cargo"], ["buslog", "Buslog"], ["other", "Outra"]].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div> : <ConfigField key={field.key} idPrefix={config.provider} field={field} value={publicConfig[field.key] || ""} onChange={(value) => setPublicConfig((current) => ({ ...current, [field.key]: value }))} />)}
      {definition.secretFields.map((field) => <ConfigField key={field.key} idPrefix={config.provider} field={field} value={secrets[field.key] || ""} onChange={(value) => setSecrets((current) => ({ ...current, [field.key]: value }))} saved={config.secretKeys.includes(field.key)} />)}
    </div>
    {webhookUrl && <div className="mt-5 rounded-xl bg-zinc-100 p-3"><span className="text-xs font-bold text-zinc-500">URL do webhook</span><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate text-xs">{webhookUrl}</code><button type="button" aria-label="Copiar webhook" onClick={() => copy(webhookUrl, "Webhook")} className="rounded-lg p-2 hover:bg-white"><Clipboard className="size-4" /></button></div></div>}
    {definition.note && <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><CircleAlert className="mt-0.5 size-4 shrink-0" />{definition.note}</p>}
    {config.lastTestMessage && <p className={`mt-4 flex gap-2 rounded-xl p-3 text-xs leading-5 ${config.lastTestStatus === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{config.lastTestStatus === "success" ? <Check className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}{config.lastTestMessage}</p>}
    <div className="mt-auto grid gap-3 pt-5 sm:grid-cols-2"><Button type="button" className="h-11 !text-white" onClick={() => save()} disabled={saving || testing}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />} Salvar</Button><Button type="button" className="h-11" variant="outline" onClick={test} disabled={saving || testing}>{testing ? <LoaderCircle className="animate-spin" /> : <TestTube2 />} Testar conexão</Button></div>
    {definition.docsUrl && <Button asChild variant="ghost" className="mt-2 w-full"><a href={definition.docsUrl} target="_blank" rel="noreferrer"><ExternalLink /> {definition.docsLabel || "Abrir documentação oficial"}</a></Button>}
  </section>;
}

function ConfigField({ field, value, onChange, saved = false, idPrefix }: { field: FieldDefinition; value: string; onChange: (value: string) => void; saved?: boolean; idPrefix: string }) {
  const fieldId = `${idPrefix}-${field.key}`;
  return <div className="grid min-w-0 gap-2"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><Label className="min-w-0" htmlFor={fieldId}>{field.label}</Label>{saved && <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-emerald-700"><Check className="size-3" /> já salva</span>}</div><Input id={fieldId} value={value} onChange={(event) => onChange(event.target.value)} type={field.secret ? "password" : field.type || "text"} placeholder={saved ? "Deixe vazio para manter a chave atual" : field.placeholder} autoComplete="off" className="h-11 min-w-0" />{field.help && <small className="text-xs leading-5 text-zinc-500">{field.help}</small>}</div>;
}

function StatusBadge({ config, configured }: { config: SafeIntegrationConfig; configured: boolean }) {
  if (config.lastTestStatus === "success") return <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800"><CheckCircle2 className="size-3.5" /> Conexão validada</span>;
  if (configured) return <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-800"><KeyRound className="size-3.5" /> Credenciais salvas</span>;
  return <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800"><CircleAlert className="size-3.5" /> Pendente</span>;
}
