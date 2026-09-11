"use client";

import { LoaderCircle, Pencil, Save, TicketPercent, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { money } from "@/lib/format";
import type { Coupon } from "@/lib/database";

type FormState = { code: string; kind: "percentage" | "fixed"; value: string; minimum: string; expiresAt: string; active: boolean };
const emptyForm: FormState = { code: "", kind: "percentage", value: "", minimum: "", expiresAt: "", active: true };

function numberValue(value: string) {
  return Number(value.replace(",", "."));
}

export function CouponManager({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const numericValue = numberValue(form.value);
    const minimum = numberValue(form.minimum || "0");
    if (!form.code.trim() || !Number.isFinite(numericValue) || numericValue <= 0 || !Number.isFinite(minimum) || minimum < 0) return toast.error("Preencha o código e os valores do cupom.");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save", code: form.code, kind: form.kind,
          value: form.kind === "fixed" ? Math.round(numericValue * 100) : Math.round(numericValue),
          minimumCents: Math.round(minimum * 100),
          expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59-03:00`).toISOString() : null,
          active: form.active,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; coupons?: Coupon[] };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setCoupons(result.coupons || []); setForm(emptyForm); toast.success("Cupom salvo");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const edit = (coupon: Coupon) => setForm({
    code: coupon.code,
    kind: coupon.kind,
    value: coupon.kind === "fixed" ? (coupon.value / 100).toFixed(2).replace(".", ",") : String(coupon.value),
    minimum: (coupon.minimumCents / 100).toFixed(2).replace(".", ","),
    expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
    active: coupon.active,
  });

  const remove = async (code: string) => {
    if (!window.confirm(`Excluir o cupom ${code}?`)) return;
    const response = await fetch("/api/admin/coupons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", code }) });
    const result = await response.json().catch(() => ({})) as { error?: string; coupons?: Coupon[] };
    if (!response.ok) return toast.error(result.error || "Não foi possível excluir.");
    setCoupons(result.coupons || []); toast.success("Cupom excluído");
  };

  return <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
    <section className="h-fit rounded-3xl border border-zinc-200 bg-white p-6">
      <div className="grid size-12 place-items-center rounded-2xl bg-[#fff100]"><TicketPercent /></div>
      <h2 className="mt-5 text-xl font-extrabold">Criar ou editar cupom</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">O cliente informa o código no checkout. Não é necessário cadastrar o cupom no Mercado Pago.</p>
      <div className="mt-5 grid gap-4">
        <div className="grid gap-2"><Label htmlFor="coupon-code">Código</Label><Input id="coupon-code" value={form.code} onChange={(event) => set("code", event.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="EX.: BEMVINDO10" /></div>
        <div className="grid gap-2"><Label>Tipo</Label><Select value={form.kind} onValueChange={(value) => set("kind", value as FormState["kind"])}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Porcentagem (%)</SelectItem><SelectItem value="fixed">Valor fixo (R$)</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="coupon-value">{form.kind === "percentage" ? "Desconto em %" : "Desconto em reais"}</Label><Input id="coupon-value" inputMode="decimal" value={form.value} onChange={(event) => set("value", event.target.value)} placeholder={form.kind === "percentage" ? "10" : "25,00"} /></div>
        <div className="grid gap-2"><Label htmlFor="coupon-minimum">Compra mínima (R$)</Label><Input id="coupon-minimum" inputMode="decimal" value={form.minimum} onChange={(event) => set("minimum", event.target.value)} placeholder="0,00" /></div>
        <div className="grid gap-2"><Label htmlFor="coupon-expiration">Validade (opcional)</Label><Input id="coupon-expiration" type="date" value={form.expiresAt} onChange={(event) => set("expiresAt", event.target.value)} /></div>
        <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-sm font-bold">Cupom ativo <Switch checked={form.active} onCheckedChange={(value) => set("active", value)} /></label>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={() => setForm(emptyForm)}>Limpar</Button><Button onClick={save} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />} Salvar</Button></div>
    </section>
    <section className="rounded-3xl border border-zinc-200 bg-white p-6">
      <h2 className="text-xl font-extrabold">Cupons cadastrados</h2>
      {!coupons.length ? <p className="mt-8 rounded-2xl bg-zinc-100 p-6 text-center text-sm text-zinc-500">Nenhum cupom cadastrado.</p> : <div className="mt-5 grid gap-3">{coupons.map((coupon) => <article key={coupon.code} className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 p-4">
        <span className="grid size-11 place-items-center rounded-xl bg-zinc-100"><TicketPercent className="size-5" /></span>
        <div className="min-w-0 basis-[180px] flex-1"><strong className="block break-words">{coupon.code}</strong><small className="text-zinc-500">{coupon.kind === "percentage" ? `${coupon.value}% de desconto` : `${money(coupon.value)} de desconto`} · mínimo {money(coupon.minimumCents)}{coupon.expiresAt ? ` · até ${new Date(coupon.expiresAt).toLocaleDateString("pt-BR")}` : " · sem vencimento"}</small></div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${coupon.active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"}`}>{coupon.active ? "Ativo" : "Inativo"}</span>
        <Button size="icon" variant="outline" aria-label={`Editar ${coupon.code}`} onClick={() => edit(coupon)}><Pencil /></Button>
        <Button size="icon" variant="outline" aria-label={`Excluir ${coupon.code}`} onClick={() => remove(coupon.code)}><Trash2 className="text-red-600" /></Button>
      </article>)}</div>}
    </section>
  </div>;
}
