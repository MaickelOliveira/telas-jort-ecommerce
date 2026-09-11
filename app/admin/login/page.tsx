import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { currentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export default async function AdminLoginPage() {
  if (await currentAdmin()) redirect("/admin");
  const demoEnabled = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_ADMIN === "true";
  return <main className="mesh-grid grid min-h-screen place-items-center overflow-hidden bg-[#17191b] p-3 sm:p-4"><section className="w-full min-w-0 max-w-md overflow-hidden rounded-3xl bg-white p-5 shadow-2xl sm:p-9"><Image src="/logo-telas-jort.webp" alt="Telas Jort" width={190} height={67} className="mx-auto h-auto max-h-20 w-auto max-w-[78%] object-contain" /><div className="my-6 text-center sm:my-7"><h1 className="display-title text-2xl leading-tight sm:text-3xl">Acesso administrativo</h1><p className="mt-2 text-sm leading-6 text-zinc-500">Pedidos, produtos, clientes e desempenho da loja.</p></div><LoginForm demoEnabled={demoEnabled} /><p className="mt-6 text-center text-xs leading-5 text-zinc-400">Sessão protegida, com duração máxima de 8 horas. Após tentativas repetidas, o acesso é bloqueado temporariamente.</p></section></main>;
}
