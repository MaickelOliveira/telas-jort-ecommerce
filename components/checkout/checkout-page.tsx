"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, LockKeyhole, MapPin, MessageCircle, Package, Tag, Truck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MercadoPagoPayment } from "@/components/checkout/mercado-pago-payment";
import { useCart } from "@/components/store/cart-provider";
import { useCatalog } from "@/components/store/catalog-provider";
import { CompactPageBanner } from "@/components/store/compact-page-banner";
import { calculateProductLine } from "@/lib/calculation";
import { trackAnalytics, trackGoogleEvent, trackMetaEvent } from "@/lib/client-analytics";
import { cleanPostalCode, maskPostalCode, money, numberPt } from "@/lib/format";
import type { ShippingOption } from "@/lib/types";

const initialCustomer = { name: "", email: "", phone: "", document: "", postalCode: "", address: "", number: "", district: "", city: "", state: "PR" };
type AppliedCoupon = { code: string; discountCents: number; cartKey: string };

export function CheckoutPage({ mercadoPagoPublicKey, storeWhatsapp, largeOrderQuantityThreshold, account }: {
  mercadoPagoPublicKey?: string;
  storeWhatsapp: string;
  largeOrderQuantityThreshold: number | null;
  account: { name: string; email: string; phone: string };
}) {
  const router = useRouter();
  const { items, ready, clear } = useCart();
  const { getProduct } = useCatalog();
  const [customer, setCustomer] = useState({ ...initialCustomer, ...account });
  const [shipping, setShipping] = useState<ShippingOption[]>([]);
  const [selected, setSelected] = useState<ShippingOption | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const lines = useMemo(() => items.flatMap((item) => {
    const product = getProduct(item.productId);
    if (!product) return [];
    try { return [calculateProductLine(product, item.quantity, item.selection, item.lineId)]; } catch { return []; }
  }), [items, getProduct]);
  const subtotal = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const manualFreightRequired = Boolean(largeOrderQuantityThreshold && totalQuantity >= largeOrderQuantityThreshold);
  const cartKey = JSON.stringify(items);
  const discount = Math.min(coupon?.cartKey === cartKey ? coupon.discountCents : 0, subtotal);
  const total = subtotal - discount + (selected?.priceCents || 0);

  useEffect(() => {
    if (ready && items.length) trackAnalytics("begin_checkout", { itemCount: totalQuantity, value: subtotal / 100, currency: "BRL" });
  }, [ready, items.length, subtotal, totalQuantity]);

  const update = (field: keyof typeof customer, value: string) => setCustomer((current) => ({ ...current, [field]: value }));
  const validContact = customer.name.trim().length >= 3 && /.+@.+\..+/.test(customer.email) && customer.phone.replace(/\D/g, "").length >= 10 && customer.document.replace(/\D/g, "").length >= 11;
  const validAddress = cleanPostalCode(customer.postalCode).length === 8 && customer.address.trim().length >= 3 && Boolean(customer.number.trim()) && customer.city.trim().length >= 2 && customer.state.length === 2;
  const whatsappMessage = [
    "Olá! Quero solicitar uma cotação de frete para este pedido:",
    ...lines.map((line) => `• ${line.product.name} — ${line.quantity} un.${line.billedLengthM ? ` — ${numberPt(line.billedLengthM)} m` : ""}`),
    `Subtotal: ${money(subtotal)}`,
    customer.name.trim() ? `Cliente: ${customer.name.trim()}` : "",
  ].filter(Boolean).join("\n");
  const whatsappUrl = `https://wa.me/${storeWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMessage)}`;

  const quote = async () => {
    if (!validContact || !validAddress) return toast.error("Preencha seus dados e o endereço para calcular o frete.");
    setQuoting(true); setSelected(null);
    try {
      const response = await fetch("/api/shipping/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postalCode: cleanPostalCode(customer.postalCode), items }) });
      const result = await response.json() as { error?: string; options?: ShippingOption[]; warning?: string; mode?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível calcular o frete");
      const options = result.options || [];
      setShipping(options); setSelected(options[0] || null);
      if (result.warning) toast.warning(result.warning);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao calcular frete"); }
    finally { setQuoting(false); }
  };

  const applyCoupon = async () => {
    if (couponInput.trim().length < 3) return toast.error("Digite o código do cupom.");
    setApplyingCoupon(true);
    try {
      const response = await fetch("/api/checkout/coupon", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: couponInput, items }) });
      const result = await response.json().catch(() => ({})) as { error?: string; code?: string; discountCents?: number };
      if (!response.ok || !result.code || typeof result.discountCents !== "number") throw new Error(result.error || "Cupom inválido.");
      setCoupon({ code: result.code, discountCents: result.discountCents, cartKey }); setCouponInput(result.code); toast.success("Cupom aplicado");
    } catch (error) { setCoupon(null); toast.error(error instanceof Error ? error.message : "Não foi possível aplicar o cupom"); }
    finally { setApplyingCoupon(false); }
  };

  const changeAccepted = (value: boolean) => {
    setAccepted(value);
    if (value) {
      trackMetaEvent("AddPaymentInfo", { value: total / 100, currency: "BRL", content_type: "product", content_ids: lines.map((line) => line.product.id) });
      trackGoogleEvent("add_payment_info", { value: total / 100, currency: "BRL", items: lines.map((line) => ({ item_id: line.product.id, quantity: line.quantity, price: line.unitPriceCents / 100 })) });
    }
  };

  const onSuccess = useCallback((orderId: string) => { clear(); router.push(`/pedido/sucesso?pedido=${encodeURIComponent(orderId)}`); }, [clear, router]);

  if (!ready) return <main className="page-shell py-16">Carregando checkout…</main>;
  if (!lines.length) return <main className="page-shell min-h-[55vh] py-10"><CompactPageBanner eyebrow="Finalização segura" title="Checkout" text="Adicione produtos ao carrinho para calcular entrega e concluir sua compra." /><div className="py-12 text-center"><h2 className="display-title text-4xl">Seu carrinho está vazio</h2><Link href="/produtos" className="mt-6 inline-block rounded-xl bg-[#fff100] px-6 py-4 font-bold">Escolher produtos</Link></div></main>;

  return <main className="bg-zinc-100 py-10"><div className="page-shell">
    <CompactPageBanner eyebrow="Finalização segura" title="Checkout" text="Confirme seus dados, escolha a entrega e finalize o pagamento em ambiente protegido." images={lines.map((line) => line.product.image)} />
    <div className="mb-5 mt-4 flex justify-end"><span className="flex items-center gap-2 text-sm font-bold text-zinc-600"><LockKeyhole className="size-5" /> Ambiente protegido</span></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_390px]"><div className="grid gap-5">
      <section className="rounded-3xl bg-white p-5 sm:p-7"><h2 className="mb-5 flex items-center gap-3 text-xl font-extrabold"><span className="grid size-9 place-items-center rounded-full bg-[#fff100] text-sm">1</span> Seus dados</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome completo" value={customer.name} onChange={(v) => update("name", v)} /><Field label="E-mail da conta" type="email" value={customer.email} onChange={() => undefined} readOnly /><Field label="Telefone/WhatsApp" value={customer.phone} onChange={(v) => update("phone", v)} /><Field label="CPF ou CNPJ" value={customer.document} onChange={(v) => update("document", v)} /></div><p className="mt-3 text-xs text-zinc-500">Este pedido aparecerá automaticamente na conta vinculada a <strong>{customer.email}</strong>.</p></section>
      {manualFreightRequired ? <section className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 sm:p-7">
        <h2 className="flex items-center gap-3 text-xl font-extrabold"><span className="grid size-9 place-items-center rounded-full bg-[#fff100] text-sm">2</span> Frete sob consulta</h2>
        <p className="mt-4 leading-7 text-amber-950">Este pedido tem {totalQuantity} itens e precisa de uma cotação personalizada. A equipe vai conferir o volume e buscar a melhor transportadora.</p>
        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] px-5 font-extrabold text-white"><MessageCircle /> Solicitar frete pelo WhatsApp</a>
        <p className="mt-3 text-xs text-amber-800">O pagamento on-line será liberado depois que a equipe confirmar o valor do frete.</p>
      </section> : <>
        <section className="rounded-3xl bg-white p-5 sm:p-7"><h2 className="mb-5 flex items-center gap-3 text-xl font-extrabold"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fff100] text-sm">2</span> Entrega</h2><p className="mb-4 text-sm leading-6 text-zinc-500">Escolha retirada gratuita na loja ou uma transportadora disponível pelo Melhor Envio.</p><div className="grid gap-4 sm:grid-cols-6"><div className="sm:col-span-2"><Field label="CEP" value={maskPostalCode(customer.postalCode)} onChange={(v) => update("postalCode", v)} /></div><div className="sm:col-span-4"><Field label="Endereço" value={customer.address} onChange={(v) => update("address", v)} /></div><div className="sm:col-span-2"><Field label="Número" value={customer.number} onChange={(v) => update("number", v)} /></div><div className="sm:col-span-2"><Field label="Bairro" value={customer.district} onChange={(v) => update("district", v)} /></div><div className="sm:col-span-2"><Field label="Cidade" value={customer.city} onChange={(v) => update("city", v)} /></div></div><button onClick={quote} disabled={quoting} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#17191b] px-4 py-3 text-center font-bold text-white disabled:opacity-60">{quoting ? <LoaderCircle className="animate-spin" /> : <Truck />} Calcular opções de entrega</button>{shipping.length > 0 && <div className="mt-5 grid gap-3">{shipping.map((option) => <button key={option.id} onClick={() => setSelected(option)} className={`flex min-w-0 flex-col gap-3 rounded-xl border-2 p-4 text-left sm:flex-row sm:items-center sm:justify-between ${selected?.id === option.id ? "border-[#e2d700] bg-[#fffef0]" : "border-zinc-200"}`}><span className="flex min-w-0 items-center gap-3">{option.source === "pickup" ? <MapPin className="shrink-0" /> : <Truck className="shrink-0" />}<span className="min-w-0"><strong className="block break-words">{option.carrier} · {option.service}</strong><small className="text-zinc-500">{option.deliveryDays === 0 ? "Retirada combinada" : `${option.deliveryDays} a ${option.deliveryDays + 2} dias úteis`}</small></span></span><strong className="shrink-0">{option.priceCents === 0 ? "Grátis" : money(option.priceCents)}</strong></button>)}</div>}</section>
        {selected && <section className="rounded-3xl bg-white p-5 sm:p-7"><h2 className="mb-5 flex items-center gap-3 text-xl font-extrabold"><span className="grid size-9 place-items-center rounded-full bg-[#fff100] text-sm">3</span> Pagamento</h2><label className="mb-5 flex items-start gap-3 rounded-xl border border-zinc-200 p-4 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 accent-black" checked={accepted} onChange={(event) => changeAccepted(event.target.checked)} /><span>Li e aceito os <Link href="/termos" target="_blank" className="font-bold underline">termos de compra</Link>, a <Link href="/politica-de-privacidade" target="_blank" className="font-bold underline">política de privacidade</Link> e conferi as medidas do pedido.</span></label>{accepted ? <MercadoPagoPayment publicKey={mercadoPagoPublicKey} amountCents={total} items={items} shipping={selected} customer={customer} couponCode={coupon?.cartKey === cartKey ? coupon.code : undefined} onSuccess={onSuccess} /> : <p className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600">Marque a confirmação acima para liberar as opções de pagamento.</p>}</section>}
      </>}
    </div>
    <aside className="h-fit rounded-3xl bg-white p-6 lg:sticky lg:top-28"><h2 className="text-xl font-extrabold">Resumo do pedido</h2><div className="mt-5 max-h-72 space-y-4 overflow-auto pr-1">{lines.map((line) => <div key={line.lineId} className="flex gap-3"><div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-50"><Image src={line.product.image} alt="" fill className="object-cover" /><span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black text-[10px] text-white">{line.quantity}</span></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-bold">{line.product.name}</p>{line.billedLengthM && <p className="text-xs text-zinc-500">{numberPt(line.billedLengthM)} m{line.billedAreaM2 ? ` · ${numberPt(line.billedAreaM2)} m²` : ""}</p>}<strong className="text-sm">{money(line.subtotalCents)}</strong></div></div>)}</div>
      {!manualFreightRequired && <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-4"><label htmlFor="coupon" className="flex items-center gap-2 text-sm font-extrabold"><Tag className="size-4" /> Cupom de desconto</label><div className="mt-3 flex gap-2"><input id="coupon" value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} disabled={Boolean(coupon)} placeholder="Digite o código" className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 text-sm font-bold outline-none focus:border-black" />{coupon ? <button type="button" onClick={() => { setCoupon(null); setCouponInput(""); }} aria-label="Remover cupom" className="grid size-11 place-items-center rounded-xl border border-zinc-300"><X className="size-4" /></button> : <button type="button" onClick={applyCoupon} disabled={applyingCoupon} className="rounded-xl bg-black px-4 text-sm font-bold text-white disabled:opacity-60">{applyingCoupon ? "..." : "Aplicar"}</button>}</div>{coupon && <p className="mt-2 text-xs font-bold text-emerald-700">Cupom {coupon.code} aplicado.</p>}</div>}
      <div className="my-5 border-t border-zinc-200" /><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-zinc-500">Produtos</span><strong>{money(subtotal)}</strong></div>{discount > 0 && <div className="flex justify-between text-emerald-700"><span>Desconto</span><strong>− {money(discount)}</strong></div>}<div className="flex justify-between"><span className="text-zinc-500">Frete</span><strong>{manualFreightRequired ? "Sob consulta" : selected ? money(selected.priceCents) : "—"}</strong></div></div><div className="my-5 border-t border-zinc-200" /><div className="flex items-end justify-between"><span className="font-bold">Total</span><strong className="text-2xl">{manualFreightRequired ? "A confirmar" : money(total)}</strong></div><p className="mt-5 flex gap-2 rounded-xl bg-zinc-100 p-3 text-xs leading-5 text-zinc-600"><Package className="size-5 shrink-0" /> Peso e dimensões são recalculados no servidor antes do pagamento.</p>{selected && <p className="mt-3 flex gap-2 text-xs text-emerald-700"><Check className="size-4" /> Frete selecionado</p>}
    </aside></div>
  </div></main>;
}

function Field({ label, value, onChange, type = "text", readOnly = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; readOnly?: boolean }) {
  return <label className="grid gap-2 text-sm font-bold">{label}<input className="h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base outline-none read-only:bg-zinc-100 read-only:text-zinc-500 focus:border-zinc-900 focus:ring-2 focus:ring-[#fff100]" type={type} value={value} onChange={(event) => onChange(event.target.value)} readOnly={readOnly} autoComplete="off" /></label>;
}
