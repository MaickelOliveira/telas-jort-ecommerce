import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ContentPage } from "@/components/store/content-page";
import { getStoreSettings } from "@/lib/store-settings";

export const metadata: Metadata = { title: "Contato", description: "Fale com a Telas Jort em Campo Mourão, Paraná." };
export default async function ContactPage() {
  const store = await getStoreSettings();
  const phoneDigits = store.phone.replace(/\D/g, "");
  const address = `${store.address}, ${store.number} — ${store.district}, ${store.city}/${store.state} — CEP ${store.postalCode}`;
  return <ContentPage title="Entre em contato" intro="Nossa equipe ajuda a escolher a tela, calcular medidas, conferir peso e acompanhar pedidos."><div className="grid gap-4 sm:grid-cols-2"><Contact icon={MessageCircle} label="WhatsApp" value={store.phone} href={`https://wa.me/${store.whatsapp}`} /><Contact icon={Phone} label="Telefone" value={store.phone} href={`tel:+${phoneDigits}`} /><Contact icon={Mail} label="E-mail" value={store.email} href={`mailto:${store.email}`} /><Contact icon={MapPin} label="Loja física" value={address} /></div><section><h2>Dados da empresa</h2><p>{store.name} · CNPJ {store.cnpj}</p></section></ContentPage>;
}
function Contact({ icon: Icon, label, value, href }: { icon: typeof Mail; label: string; value: string; href?: string }) { const content = <><Icon className="size-5 text-zinc-500" /><span><strong className="block text-zinc-900">{label}</strong><span className="text-sm leading-6">{value}</span></span></>; return href ? <a href={href} className="flex gap-3 rounded-2xl border border-zinc-200 p-4 no-underline transition hover:border-zinc-900">{content}</a> : <div className="flex gap-3 rounded-2xl border border-zinc-200 p-4">{content}</div>; }
