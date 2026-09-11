"use client";

import { FileText, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function OrderFiscalButton({ orderNumber, retry = false }: { orderNumber: string; retry?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function issue() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderNumber)}/invoice`, { method: "POST" });
      const result = await response.json().catch(() => ({})) as { error?: string; status?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível emitir a NF-e.");
      toast.success(result.status === "authorized" ? "NF-e autorizada." : "NF-e enviada para processamento.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível emitir a NF-e."); }
    finally { setLoading(false); }
  }
  return <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={issue} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <FileText />} {retry ? "Tentar NF-e" : "Emitir NF-e"}</Button>;
}
