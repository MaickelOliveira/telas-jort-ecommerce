import { CheckCircle2, CircleAlert, DatabaseBackup, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { getStoreSettings } from "@/lib/store-settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = getStoreSettings();
  const adminAccessConfigured = Boolean(process.env.ADMIN_EMAIL && (process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD));
  const checks = [
    { title: "HTTPS automático", description: process.env.APP_URL?.startsWith("https://") ? "Configurado para o domínio de produção" : "Será ativado pelo Caddy quando o domínio apontar para a VPS", ready: Boolean(process.env.APP_URL?.startsWith("https://")), icon: LockKeyhole },
    { title: "Dados pessoais cifrados", description: process.env.DATA_ENCRYPTION_KEY ? "Chave AES-256-GCM carregada no servidor" : "Chave de produção ainda não carregada", ready: Boolean(process.env.DATA_ENCRYPTION_KEY), icon: ShieldCheck },
    { title: "Acesso administrativo", description: adminAccessConfigured ? "E-mail e senha segura configurados" : "Configure ADMIN_EMAIL e ADMIN_PASSWORD no servidor", ready: adminAccessConfigured, icon: KeyRound },
    { title: "Cópias de segurança", description: "O comando de backup está incluído; confirme o cron e a cópia externa na VPS", ready: false, icon: DatabaseBackup },
  ];
  return <div className="mx-auto max-w-[1200px]">
    <PageHeader eyebrow="Sistema" title="Configurações" description="Dados públicos da loja e situação das proteções de produção." />
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <SettingsForm initial={settings} />
      <aside className="h-fit rounded-3xl bg-[#17191b] p-6 text-white xl:sticky xl:top-24">
        <ShieldCheck className="size-8 text-[#fff100]" />
        <h2 className="mt-5 text-xl font-extrabold">Proteção da plataforma</h2>
        <div className="mt-6 grid gap-5">{checks.map(({ title, description, ready, icon: Icon }) => <div key={title} className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="size-4" /></span><div><strong className="block text-sm">{title}</strong><p className="mt-1 text-xs leading-5 text-zinc-400">{description}</p></div>{ready ? <CheckCircle2 className="ml-auto size-4 shrink-0 text-emerald-400" /> : <CircleAlert className="ml-auto size-4 shrink-0 text-amber-400" />}</div>)}</div>
        <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-zinc-500">Nenhum sistema é inviolável. Atualizações, monitoramento, senhas fortes e backups externos continuam obrigatórios depois da publicação.</p>
      </aside>
    </div>
  </div>;
}
