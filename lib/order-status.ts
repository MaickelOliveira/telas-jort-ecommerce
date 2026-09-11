export function paymentStatusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (["approved", "paid", "aprovado", "pago"].includes(normalized)) return "Pagamento aprovado";
  if (["partially_refunded", "estorno_parcial"].includes(normalized)) return "Estorno parcial";
  if (["refunded", "refund", "estornado"].includes(normalized)) return "Estornado";
  if (["rejected", "recusado"].includes(normalized)) return "Pagamento recusado";
  if (["cancelled", "canceled", "cancelado"].includes(normalized)) return "Cancelado";
  if (["pending", "in_process", "pendente"].includes(normalized)) return "Aguardando pagamento";
  return status || "Aguardando pagamento";
}
export function fulfillmentStatusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (["delivered", "entregue"].includes(normalized)) return "Entregue";
  if (/transit|trânsito|postado/.test(normalized)) return "Em transporte";
  if (/ready|pronto/.test(normalized)) return "Pronto para retirada";
  if (/processing|separa|prepar/.test(normalized)) return "Em preparação";
  return "Aguardando preparação";
}

export function refundStatusLabel(status: string) {
  return ({ requested: "Solicitação em análise", processing: "Estorno em processamento", completed: "Estorno concluído", failed: "Falha no estorno", rejected: "Solicitação não aprovada" } as Record<string, string>)[status] || status;
}
