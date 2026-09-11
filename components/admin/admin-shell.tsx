"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Box, ChevronRight, CircleDollarSign, ExternalLink, Gauge, LogOut, PackageSearch, Settings, ShoppingBag, Store, TicketPercent, Truck, UsersRound } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";

const nav = [
  { label: "Visão geral", href: "/admin", icon: Gauge },
  { label: "Pedidos", href: "/admin/pedidos", icon: ShoppingBag },
  { label: "Produtos", href: "/admin/produtos", icon: Box },
  { label: "Clientes", href: "/admin/clientes", icon: UsersRound },
  { label: "Cupons", href: "/admin/cupons", icon: TicketPercent },
  { label: "Fretes e etiquetas", href: "/admin/fretes", icon: Truck },
  { label: "Marketplaces", href: "/admin/marketplaces", icon: Store },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];
const setup = [
  { label: "Integrações", href: "/admin/integracoes", icon: PackageSearch },
  { label: "Configurações", href: "/admin/configuracoes", icon: Settings },
];

export function AdminShell({ children, userEmail }: { children: React.ReactNode; userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = (href: string) => href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const logout = async () => { await fetch("/api/admin/logout", { method: "POST" }); router.push("/admin/login"); router.refresh(); };
  return <SidebarProvider defaultOpen>
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-white/10 p-3"><Link href="/admin" className="flex min-h-14 items-center gap-3 overflow-hidden rounded-xl bg-transparent px-2 py-1.5"><Image src="/logo-telas-jort.webp" alt="Telas Jort" width={150} height={50} priority className="h-11 w-full object-contain" /><span className="sr-only">Painel administrativo Telas Jort</span></Link></SidebarHeader>
      <SidebarContent className="px-2 py-4"><SidebarGroup><SidebarGroupLabel className="text-zinc-400">LOJA</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{nav.map((item) => <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={active(item.href)} tooltip={item.label} className="h-10 text-zinc-200 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#fff100] data-[active=true]:font-bold data-[active=true]:text-black"><Link href={item.href}><item.icon /><span>{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup><SidebarGroup><SidebarGroupLabel className="text-zinc-400">SISTEMA</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{setup.map((item) => <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={active(item.href)} tooltip={item.label} className="h-10 text-zinc-200 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#fff100] data-[active=true]:font-bold data-[active=true]:text-black"><Link href={item.href}><item.icon /><span>{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
      <SidebarFooter className="border-t border-white/10 p-3"><SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild tooltip="Ver loja"><Link href="/" target="_blank"><ExternalLink /><span>Ver loja</span></Link></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton tooltip="Sair" onClick={logout}><LogOut /><span>Sair</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
    </Sidebar>
    <SidebarInset className="min-w-0 overflow-x-hidden bg-[#f5f6f7] text-zinc-950"><header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white/95 px-3 backdrop-blur sm:gap-4 sm:px-7"><SidebarTrigger className="shrink-0" /><div className="h-6 border-l border-zinc-200" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-zinc-950">Painel da loja</p><p className="hidden truncate text-xs text-zinc-600 sm:block">{userEmail}</p></div><Link href="/admin/pedidos" className="hidden shrink-0 items-center gap-2 rounded-xl bg-[#17191b] px-4 py-2 text-sm font-bold !text-white hover:bg-black sm:flex"><CircleDollarSign className="size-4" /> Ver pedidos <ChevronRight className="size-4" /></Link></header><div className="min-w-0 p-3 sm:p-7">{children}</div></SidebarInset>
  </SidebarProvider>;
}
