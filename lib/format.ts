export function money(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);
}

export function numberPt(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value);
}

export function dateTimePt(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function cleanPostalCode(value: string) { return value.replace(/\D/g, "").slice(0, 8); }
export function maskPostalCode(value: string) {
  const digits = cleanPostalCode(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
