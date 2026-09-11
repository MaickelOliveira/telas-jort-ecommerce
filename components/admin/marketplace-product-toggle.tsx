"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { MarketplaceChannel } from "@/lib/integrations/marketplaces";

export function MarketplaceProductToggle({ channel, externalId, initialActive, disabled = false }: {
  channel: MarketplaceChannel;
  externalId: string;
  initialActive: boolean;
  disabled?: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);

  async function update(nextActive: boolean) {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/marketplaces/product-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, externalId, active: nextActive }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; active?: boolean };
      if (!response.ok) throw new Error(result.error || "Não foi possível alterar o anúncio.");
      setActive(Boolean(result.active));
      toast.success(result.active ? "Anúncio ativado no marketplace." : "Anúncio pausado no marketplace.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o anúncio.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="flex items-center gap-2">
    <Switch
      checked={active}
      onCheckedChange={update}
      disabled={disabled || saving}
      aria-label={active ? "Pausar anúncio" : "Ativar anúncio"}
    />
    <span className={`text-xs font-extrabold ${active ? "text-emerald-700" : "text-zinc-500"}`}>
      {saving ? "Salvando..." : active ? "Ativo" : "Pausado"}
    </span>
  </div>;
}
