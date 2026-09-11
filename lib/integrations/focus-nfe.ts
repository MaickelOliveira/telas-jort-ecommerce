import "server-only";
import { audit, beginFiscalDocument, getStoredOrderByPublicNumber, listStoredOrderItems, updateFiscalDocument } from "@/lib/database";
import { getRuntimeProduct } from "@/lib/catalog-server";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";

type FocusResponse = {
  status?: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  mensagem?: string;
  erro?: string;
  chave_nfe?: string;
  numero?: string | number;
  serie?: string | number;
  caminho_danfe?: string;
  caminho_xml_nota_fiscal?: string;
};

function focusBase(environment: "sandbox" | "production") {
  return environment === "production" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function money(cents: number) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

function absoluteUrl(base: string, value?: string) {
  if (!value) return null;
  try { return new URL(value, base).toString(); } catch { return null; }
}

function normalizeStatus(result: FocusResponse): "processing" | "authorized" | "error" | "cancelled" {
  const status = String(result.status || result.status_sefaz || "").toLowerCase();
  if (status.includes("autoriz")) return "authorized";
  if (status.includes("cancel")) return "cancelled";
  if (status.includes("erro") || status.includes("rejeit")) return "error";
  return "processing";
}

function fiscalQuantity(item: ReturnType<typeof listStoredOrderItems>[number]) {
  const product = getRuntimeProduct(item.product_id);
  if (product?.measurement.mode === "square_meter" && item.measurement?.areaM2) return Number((item.measurement.areaM2 * item.quantity).toFixed(4));
  if (product?.measurement.mode === "linear_meter" && item.measurement?.lengthM) return Number((item.measurement.lengthM * item.quantity).toFixed(4));
  return item.quantity;
}

function responseMessage(result: FocusResponse, fallback: string) {
  return String(result.mensagem_sefaz || result.mensagem || result.erro || fallback).slice(0, 500);
}

export async function issueFiscalInvoiceForOrder(publicNumber: string) {
  const config = getRuntimeIntegrationConfig("focus_nfe");
  if (!config.enabled) return { ok: false as const, skipped: true as const, reason: "Integração fiscal desabilitada." };
  const order = getStoredOrderByPublicNumber(publicNumber);
  if (!order || order.status !== "paid") return { ok: false as const, skipped: true as const, reason: "O pedido ainda não está pago." };
  const reference = `TJ-${order.public_number}`;
  const reservation = beginFiscalDocument(order.id, reference);
  if (!reservation.started) return { ok: true as const, duplicate: true as const, status: reservation.document.status };

  const fail = (message: string) => {
    updateFiscalDocument(reference, { status: "error", errorMessage: message });
    audit("system:fiscal", "fiscal.invoice_failed", order.public_number, { reference, message });
    return { ok: false as const, reason: message };
  };

  try {
    const issuerCnpj = digits(config.publicConfig.issuerCnpj);
    const issuerState = String(config.publicConfig.issuerState || "").toUpperCase();
    const token = config.secrets.token;
    if (!token || !/^\d{14}$/.test(issuerCnpj) || !/^[A-Z]{2}$/.test(issuerState)) return fail("Configuração fiscal incompleta: confira token, CNPJ e UF do emitente.");

    const items = listStoredOrderItems(order.id);
    if (!items.length) return fail("O pedido não possui itens para emissão fiscal.");
    let allocatedDiscount = 0;
    const fiscalItems = items.map((item, index) => {
      const product = getRuntimeProduct(item.product_id);
      const fiscal = product?.fiscal || {};
      const ncm = digits(fiscal.ncm || config.publicConfig.defaultNcm);
      const cfop = digits(fiscal.cfop || config.publicConfig.defaultCfop);
      const unit = String(fiscal.unit || config.publicConfig.defaultUnit || "").trim().toUpperCase();
      const origin = String(fiscal.origin || config.publicConfig.defaultOrigin || "").trim();
      const icmsCst = String(fiscal.icmsCst || config.publicConfig.defaultIcmsCst || "").trim();
      const pisCst = String(fiscal.pisCst || config.publicConfig.defaultPisCst || "").trim();
      const cofinsCst = String(fiscal.cofinsCst || config.publicConfig.defaultCofinsCst || "").trim();
      if (!/^\d{8}$/.test(ncm) || !/^\d{4}$/.test(cfop) || !unit || !/^[0-8]$/.test(origin) || !icmsCst || !/^\d{2}$/.test(pisCst) || !/^\d{2}$/.test(cofinsCst)) {
        throw new Error(`Cadastro fiscal incompleto no produto ${item.sku}: informe NCM, CFOP, unidade, origem, ICMS, PIS e COFINS.`);
      }
      const quantity = Math.max(0.0001, fiscalQuantity(item));
      const discountCents = index === items.length - 1
        ? Math.max(0, order.discount_cents - allocatedDiscount)
        : Math.round(order.discount_cents * item.subtotal_cents / Math.max(1, order.subtotal_cents));
      allocatedDiscount += discountCents;
      return {
        numero_item: index + 1,
        codigo_produto: item.sku,
        descricao: item.name.slice(0, 120),
        codigo_ncm: ncm,
        ...(fiscal.cest ? { cest: digits(fiscal.cest) } : {}),
        cfop,
        unidade_comercial: unit,
        quantidade_comercial: quantity,
        valor_unitario_comercial: Number((money(item.subtotal_cents) / quantity).toFixed(10)),
        valor_bruto: money(item.subtotal_cents),
        ...(discountCents ? { valor_desconto: money(discountCents) } : {}),
        unidade_tributavel: unit,
        quantidade_tributavel: quantity,
        valor_unitario_tributavel: Number((money(item.subtotal_cents) / quantity).toFixed(10)),
        icms_origem: origin,
        icms_situacao_tributaria: icmsCst,
        pis_situacao_tributaria: pisCst,
        cofins_situacao_tributaria: cofinsCst,
      };
    });

    const document = digits(order.customer.document);
    if (![11, 14].includes(document.length)) return fail("CPF/CNPJ do comprador está inválido para emissão da NF-e.");
    const recipientState = String(order.customer.state || "").toUpperCase();
    const base = focusBase(config.environment);
    const payload = {
      natureza_operacao: config.publicConfig.natureOperation,
      data_emissao: new Date().toISOString(),
      data_entrada_saida: new Date().toISOString(),
      tipo_documento: 1,
      finalidade_emissao: 1,
      consumidor_final: 1,
      presenca_comprador: 2,
      local_destino: recipientState === issuerState ? 1 : 2,
      cnpj_emitente: issuerCnpj,
      regime_tributario_emitente: Number(config.publicConfig.taxRegime),
      nome_destinatario: order.customer.name,
      ...(document.length === 14 ? { cnpj_destinatario: document } : { cpf_destinatario: document }),
      indicador_inscricao_estadual_destinatario: 9,
      logradouro_destinatario: order.customer.address,
      numero_destinatario: order.customer.number,
      bairro_destinatario: order.customer.district,
      municipio_destinatario: order.customer.city,
      uf_destinatario: recipientState,
      cep_destinatario: digits(order.customer.postalCode),
      pais_destinatario: "Brasil",
      telefone_destinatario: digits(order.customer.phone),
      email_destinatario: order.customer.email,
      valor_frete: money(order.shipping_cents),
      valor_desconto: money(order.discount_cents),
      valor_total: money(order.total_cents),
      valor_produtos: money(order.subtotal_cents),
      modalidade_frete: Number(config.publicConfig.freightMode),
      items: fiscalItems,
    };

    updateFiscalDocument(reference, { status: "processing" });
    let response = await fetch(`${base}/v2/nfe?ref=${encodeURIComponent(reference)}`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    let result = await response.json().catch(() => ({})) as FocusResponse;
    if (response.status === 422) {
      const lookup = await fetch(`${base}/v2/nfe/${encodeURIComponent(reference)}`, {
        headers: { authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (lookup.ok) { response = lookup; result = await lookup.json().catch(() => ({})) as FocusResponse; }
    }
    if (!response.ok) return fail(responseMessage(result, `Focus NFe respondeu HTTP ${response.status}.`));
    const status = normalizeStatus(result);
    updateFiscalDocument(reference, {
      status,
      accessKey: result.chave_nfe || null,
      number: result.numero ? String(result.numero) : null,
      series: result.serie ? String(result.serie) : null,
      danfeUrl: absoluteUrl(base, result.caminho_danfe),
      xmlUrl: absoluteUrl(base, result.caminho_xml_nota_fiscal),
      errorMessage: status === "error" ? responseMessage(result, "A SEFAZ rejeitou a emissão.") : null,
    });
    audit("system:fiscal", `fiscal.invoice_${status}`, order.public_number, { reference });
    return { ok: status !== "error", status, reference };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Falha inesperada na emissão fiscal.");
  }
}

export function syncFocusNfeWebhook(reference: string, result: FocusResponse) {
  const config = getRuntimeIntegrationConfig("focus_nfe");
  const base = focusBase(config.environment);
  const status = normalizeStatus(result);
  updateFiscalDocument(reference, {
    status,
    accessKey: result.chave_nfe || null,
    number: result.numero ? String(result.numero) : null,
    series: result.serie ? String(result.serie) : null,
    danfeUrl: absoluteUrl(base, result.caminho_danfe),
    xmlUrl: absoluteUrl(base, result.caminho_xml_nota_fiscal),
    errorMessage: status === "error" ? responseMessage(result, "A SEFAZ rejeitou a emissão.") : null,
  });
  audit("webhook:focus_nfe", `fiscal.invoice_${status}`, reference);
  return status;
}
