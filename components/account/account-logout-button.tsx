"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AccountLogoutButton() {
  const router = useRouter();
  return <Button variant="outline" className="rounded-xl" onClick={async () => {
    await fetch("/api/customer/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }}><LogOut /> Sair</Button>;
}
