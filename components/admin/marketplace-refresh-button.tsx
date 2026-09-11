"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MarketplaceRefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  return <Button type="button" className="bg-[#17191b] text-white" disabled={refreshing} onClick={() => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 1200);
  }}><RefreshCw className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Atualizando" : "Atualizar dados"}</Button>;
}
