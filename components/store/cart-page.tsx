"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { CompactPageBanner } from "@/components/store/compact-page-banner";
import { useCart } from "@/components/store/cart-provider";
import { useCatalog } from "@/components/store/catalog-provider";
import { calculateProductLine } from "@/lib/calculation";
import { money, numberPt } from "@/lib/format";

export function CartPage() {
  const { items, ready, updateQuantity, removeItem } = useCart();
  const { getProduct } = useCatalog();
  const lines = items.flatMap((item) => {
    const product = getProduct(item.productId);
    if (!product) return [];
    try { return [calculateProductLine(product, item.quantity, item.selection, item.lineId)]; } catch { return []; }
  });
  const subtotal = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  if (!ready) return <main className="page-shell min-h-[50vh] py-16"><p>Carregando carrinho…</p></main>;
  if (!lines.length) return <main className="page-shell py-10"><CompactPageBanner eyebrow="Seu pedido" title="Carrinho vazio" text="Escolha telas, arames e acessórios para começar seu projeto." /><div className="grid min-h-[34vh] place-items-center py-12 text-center"><div><span className="mx-auto grid size-20 place-items-center rounded-full bg-zinc-100"><ShoppingBag className="size-9" /></span><h2 className="display-title mt-5 text-4xl">Encontre o que precisa</h2><p className="mt-2 text-zinc-500">Você pode escolher medidas e quantidades na página de cada produto.</p><Link href="/produtos" className="mt-7 inline-block rounded-xl bg-[#fff100] px-6 py-4 font-extrabold">Ver produtos</Link></div></div></main>;
  return <main className="page-shell py-10"><CompactPageBanner eyebrow="Seu pedido" title="Carrinho" text="Revise os produtos, medidas e quantidades antes de continuar." images={lines.map((line) => line.product.image)} /><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_370px]"><div className="grid gap-4">{lines.map((line) => <article key={line.lineId} className="grid grid-cols-[92px_1fr] gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-[110px_1fr_auto]"><div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-50"><Image src={line.product.image} alt={line.product.name} fill className="object-cover" /></div><div><Link href={`/produto/${line.product.slug}`} className="font-bold hover:underline">{line.product.name}</Link>{line.billedLengthM && <p className="mt-2 text-sm text-zinc-500">{line.billedHeightM && `Altura: ${numberPt(line.billedHeightM)} m · `}Comprimento: {numberPt(line.billedLengthM)} m{line.billedAreaM2 && ` · Área: ${numberPt(line.billedAreaM2)} m²`}</p>}<p className="mt-1 text-sm text-zinc-500">Peso estimado: {numberPt(line.weightKg)} kg</p><div className="mt-4 flex w-fit items-center rounded-lg border border-zinc-200"><button className="p-2" onClick={() => updateQuantity(line.lineId, line.quantity - 1)} aria-label="Diminuir"><Minus className="size-4" /></button><span className="min-w-9 text-center text-sm font-bold">{line.quantity}</span><button className="p-2" onClick={() => updateQuantity(line.lineId, line.quantity + 1)} aria-label="Aumentar"><Plus className="size-4" /></button></div></div><div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:block sm:text-right"><strong className="text-lg">{money(line.subtotalCents)}</strong><button className="ml-auto mt-0 flex items-center gap-1 text-sm text-red-600 sm:mt-8" onClick={() => removeItem(line.lineId)}><Trash2 className="size-4" /> Remover</button></div></article>)}</div><aside className="h-fit rounded-3xl bg-[#17191b] p-6 text-white"><h2 className="text-xl font-extrabold">Resumo</h2><div className="mt-6 flex justify-between text-zinc-300"><span>Subtotal</span><strong className="text-white">{money(subtotal)}</strong></div><div className="mt-3 flex justify-between text-zinc-300"><span>Frete</span><span>Calculado no checkout</span></div><div className="my-6 border-t border-white/10" /><div className="flex items-end justify-between"><span>Total parcial</span><strong className="text-2xl text-[#fff100]">{money(subtotal)}</strong></div><Link href="/checkout" className="mt-6 block rounded-xl bg-[#fff100] px-5 py-4 text-center font-extrabold text-black">Ir para o checkout</Link><Link href="/produtos" className="mt-4 block text-center text-sm text-zinc-400 underline">Continuar comprando</Link></aside></div></main>;
}
