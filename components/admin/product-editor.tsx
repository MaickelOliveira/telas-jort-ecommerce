"use client";

import { Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SaleMode, StoreProduct } from "@/lib/types";

export function ProductEditor({ product }: { product?: StoreProduct }) {
  const router = useRouter();
  const config = product?.measurement;
  const [mode, setMode] = useState<SaleMode>(config?.mode || "unit");
  const [active, setActive] = useState(product?.active ?? true);
  const [freightVerified, setFreightVerified] = useState(config?.freightVerified ?? false);
  const [customerChoosesHeight, setCustomerChoosesHeight] = useState(config?.customerChoosesHeight ?? false);
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: product?.id, ...data, mode, active, freightVerified, customerChoosesHeight }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; id?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      toast.success("Produto salvo e catálogo atualizado");
      if (!product && result.id) router.push(`/admin/produtos/${result.id}`);
      else router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const measured = mode === "linear_meter" || mode === "square_meter";
  return <form onSubmit={save} className="grid gap-5 xl:grid-cols-[1fr_360px]">
    <div className="grid gap-5">
      <Section title="Informações básicas">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do produto" name="name" defaultValue={product?.name} className="sm:col-span-2" required />
          <Field label="SKU" name="sku" defaultValue={product?.sku} required />
          <Field label="Categoria" name="category" defaultValue={product?.category} required />
          <Field label="Subcategoria" name="subcategory" defaultValue={product?.subcategory} />
          <Field label="Preço de comparação (R$)" name="comparePrice" type="number" step="0.01" min="0" defaultValue={product?.compareAtPriceCents ? product.compareAtPriceCents / 100 : ""} />
          <Field label="Estoque" name="inventory" type="number" min="0" defaultValue={product?.inventory ?? ""} />
          <Field label="Descrição curta para Google" name="metaDescription" defaultValue={product?.metaDescription} className="sm:col-span-2" maxLength={300} />
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="descriptionText">Descrição do produto</Label><Textarea id="descriptionText" name="descriptionText" rows={5} placeholder={product ? "Deixe vazio para manter a descrição atual" : "Características, materiais, aplicações e cuidados"} /></div>
        </div>
      </Section>

      <Section title="Forma de venda e cálculo">
        <div className="grid gap-2"><Label>Como este produto será vendido?</Label><Select value={mode} onValueChange={(value) => setMode(value as SaleMode)}><SelectTrigger className="h-12 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unit">Por unidade</SelectItem><SelectItem value="fixed_roll">Rolo ou tamanho fechado</SelectItem><SelectItem value="linear_meter">Por metro corrido</SelectItem><SelectItem value="square_meter">Por metro quadrado (m²)</SelectItem></SelectContent></Select></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={mode === "linear_meter" ? "Preço por metro (R$)" : mode === "square_meter" ? "Preço por m² (R$)" : "Preço da unidade (R$)"} name="price" type="number" min="0.01" step="0.01" defaultValue={(config?.pricePerUnitCents || product?.priceCents || 0) / 100} required />
          {mode === "linear_meter" && <Field label="Peso por metro (kg)" name="kgPerLinearM" type="number" min="0.001" step="0.001" defaultValue={config?.kgPerLinearM} required />}
          {mode === "square_meter" && <Field label="Peso por m² (kg)" name="kgPerSquareM" type="number" min="0.001" step="0.001" defaultValue={config?.kgPerSquareM} required />}
          {(mode === "unit" || mode === "fixed_roll") && <Field label="Peso da unidade (kg)" name="kgPerUnit" type="number" min="0.001" step="0.001" defaultValue={config?.kgPerUnit || product?.weightKg} required />}
          {measured && <>
            <Field label="Comprimento mínimo (m)" name="minLengthM" type="number" min="0.01" step="0.01" defaultValue={config?.minLengthM || 1} />
            <Field label="Comprimento máximo (m)" name="maxLengthM" type="number" min="0.01" step="0.01" defaultValue={config?.maxLengthM || 25} />
            <Field label="Passo de corte (m)" name="lengthStepM" type="number" min="0.01" step="0.01" defaultValue={config?.lengthStepM || .5} />
            <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 sm:col-span-2"><span><strong className="block text-sm">Cliente escolhe a altura</strong><small className="text-zinc-500">Desligado = altura fixa da variação</small></span><Switch checked={customerChoosesHeight} onCheckedChange={setCustomerChoosesHeight} /></label>
            {customerChoosesHeight ? <><Field label="Altura mínima (m)" name="minHeightM" type="number" min="0.01" step="0.01" defaultValue={config?.minHeightM || .5} /><Field label="Altura máxima (m)" name="maxHeightM" type="number" min="0.01" step="0.01" defaultValue={config?.maxHeightM || 4} /><Field label="Passo da altura (m)" name="heightStepM" type="number" min="0.01" step="0.01" defaultValue={config?.heightStepM || .1} /></> : <Field label="Altura fixa (m)" name="fixedHeightM" type="number" min="0.01" step="0.01" defaultValue={config?.fixedHeightM || 1} />}
          </>}
        </div>
      </Section>

      <Section title="Dados fiscais da NF-e">
        <p className="mb-5 text-sm leading-6 text-zinc-500">Preencha conforme a classificação validada pelo contador. A emissão automática usa estes dados; se algum campo obrigatório estiver vazio, o pedido fica marcado para correção e nenhuma nota incorreta é enviada.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NCM (8 números)" name="ncm" inputMode="numeric" maxLength={8} placeholder="Ex.: 73144100" defaultValue={product?.fiscal?.ncm} />
          <Field label="CEST (quando aplicável)" name="cest" inputMode="numeric" maxLength={7} defaultValue={product?.fiscal?.cest} />
          <Field label="CFOP" name="cfop" inputMode="numeric" maxLength={4} placeholder="Ex.: 5102" defaultValue={product?.fiscal?.cfop} />
          <Field label="Unidade fiscal" name="fiscalUnit" maxLength={6} placeholder="UN, RL, M ou M2" defaultValue={product?.fiscal?.unit} />
          <Field label="Origem da mercadoria" name="fiscalOrigin" inputMode="numeric" maxLength={1} placeholder="Ex.: 0" defaultValue={product?.fiscal?.origin} />
          <Field label="CST/CSOSN do ICMS" name="icmsCst" maxLength={12} placeholder="Ex.: 102" defaultValue={product?.fiscal?.icmsCst} />
          <Field label="CST do PIS" name="pisCst" inputMode="numeric" maxLength={2} placeholder="Ex.: 49" defaultValue={product?.fiscal?.pisCst} />
          <Field label="CST da COFINS" name="cofinsCst" inputMode="numeric" maxLength={2} placeholder="Ex.: 49" defaultValue={product?.fiscal?.cofinsCst} />
        </div>
      </Section>

      <Section title="Embalagem para o frete">
        <p className="mb-5 text-sm leading-6 text-zinc-500">Informe as medidas do produto já enrolado ou embalado, não da tela aberta.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Peso da embalagem (kg)" name="packagingKg" type="number" min="0" step="0.01" defaultValue={config?.packagingKg ?? 0} />
          <Field label="Comprimento do volume (cm)" name="packageLengthCm" type="number" min="1" defaultValue={config?.packageLengthCm} />
          <Field label="Diâmetro/base do rolo (cm)" name="packageDiameterBaseCm" type="number" min="1" defaultValue={config?.packageDiameterBaseCm} />
          <Field label="Crescimento do rolo" name="packageDiameterGrowth" type="number" min="0" step="0.1" defaultValue={config?.packageDiameterGrowth} />
        </div>
        <label className="mt-5 flex items-center justify-between rounded-xl border border-zinc-200 p-4"><span><strong className="block text-sm">Medidas conferidas fisicamente</strong><small className="text-zinc-500">Libera cotação automática em produção</small></span><Switch checked={freightVerified} onCheckedChange={setFreightVerified} /></label>
      </Section>
    </div>

    <aside className="grid h-fit gap-5 xl:sticky xl:top-24">
      <section className="rounded-3xl border border-zinc-200 bg-white p-5"><h2 className="font-extrabold">Publicação</h2><label className="mt-5 flex items-center justify-between"><span className="text-sm font-bold">Produto ativo</span><Switch checked={active} onCheckedChange={setActive} /></label><Button disabled={saving} className="mt-5 h-12 w-full bg-[#fff100] text-black hover:bg-[#e9df00]"><Save /> {saving ? "Salvando…" : "Salvar produto"}</Button></section>
      <section className="rounded-3xl bg-[#17191b] p-5 text-white"><ShieldCheck className="text-[#fff100]" /><h2 className="mt-4 font-extrabold">Validação antes de publicar</h2><ul className="mt-3 grid gap-2 text-sm leading-6 text-zinc-400"><li>• Preço e unidade de venda</li><li>• Peso-base da variação</li><li>• Dimensões da embalagem</li><li>• Limites de corte e estoque</li><li>• NCM, CFOP e tributação fiscal</li></ul></section>
    </aside>
  </form>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="metric-card rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6"><h2 className="mb-5 text-lg font-extrabold">{title}</h2>{children}</section>;
}

function Field({ label, className = "", ...props }: React.ComponentProps<typeof Input> & { label: string }) {
  return <div className={`grid gap-2 ${className}`}><Label htmlFor={props.name}>{label}</Label><Input id={props.name} className="h-12" {...props} /></div>;
}
