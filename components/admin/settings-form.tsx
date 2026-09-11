"use client";

import { useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StoreSettings } from "@/lib/store-settings";

const fields: Array<{ key: keyof StoreSettings; label: string; type?: string; help?: string }> = [
  { key: "name", label: "Nome da loja" },
  { key: "cnpj", label: "CNPJ" },
  { key: "email", label: "E-mail", type: "email" },
  { key: "phone", label: "Telefone exibido" },
  { key: "whatsapp", label: "WhatsApp com DDI e DDD", help: "Somente números. Ex.: 5544991572075" },
  { key: "postalCode", label: "CEP de origem" },
  { key: "address", label: "Logradouro" },
  { key: "number", label: "Número" },
  { key: "district", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado (UF)" },
  { key: "instagram", label: "Instagram", type: "url" },
  { key: "largeOrderQuantityThreshold", label: "Quantidade para cotação manual", type: "number", help: "Deixe vazio enquanto o limite não estiver definido. A partir desta quantidade, o checkout oferecerá somente a cotação pelo WhatsApp." },
];

export function SettingsForm({ initial }: { initial: StoreSettings }) {
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
      const result = await response.json().catch(() => ({})) as { error?: string; settings?: StoreSettings };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      if (result.settings) setSettings(result.settings);
      toast.success("Dados da loja atualizados");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  };
  return <section className="metric-card rounded-3xl border border-zinc-200 bg-white p-6">
    <h2 className="text-lg font-extrabold">Dados públicos da loja</h2>
    <p className="mt-1 text-sm text-zinc-500">As alterações aparecem no contato e no rodapé da loja.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map((field) => <div key={field.key} className="grid gap-2"><Label htmlFor={field.key}>{field.label}</Label><Input id={field.key} type={field.type || "text"} value={settings[field.key]} onChange={(event) => setSettings((current) => ({ ...current, [field.key]: event.target.value }))} className="h-12" />{field.help && <small className="text-xs text-zinc-500">{field.help}</small>}</div>)}</div>
    <Button type="button" onClick={save} disabled={saving} className="mt-5 w-full bg-[#17191b] !text-white hover:bg-black sm:w-auto">{saving ? <LoaderCircle className="animate-spin" /> : <Save />} Salvar alterações</Button>
  </section>;
}
