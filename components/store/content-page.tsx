import Link from "next/link";
import { CompactPageBanner } from "@/components/store/compact-page-banner";

export function ContentPage({ eyebrow = "Telas Jort", title, intro, children }: { eyebrow?: string; title: string; intro?: string; children: React.ReactNode }) {
  const bannerText = intro || "Informações importantes para comprar com segurança na Telas Jort.";
  return <main className="bg-zinc-50 py-8 sm:py-10"><div className="page-shell"><nav className="mb-5 text-sm text-zinc-500"><Link href="/" className="hover:underline">Início</Link> / <span className="text-zinc-800">{title}</span></nav><CompactPageBanner eyebrow={eyebrow} title={title} text={bannerText} /><article className="mx-auto mt-7 max-w-4xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10"><div className="space-y-8 text-[15px] leading-7 text-zinc-700 [&_a]:font-bold [&_a]:underline [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3">{children}</div></article></div></main>;
}
