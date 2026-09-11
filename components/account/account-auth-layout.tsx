import Image from "next/image";
import { Headphones, MapPin, PackageSearch, RotateCcw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const benefits = [
  {
    icon: PackageSearch,
    title: "Acompanhe cada etapa",
    text: "Consulte pagamento, preparação e entrega dos seus pedidos em um só lugar.",
  },
  {
    icon: RotateCcw,
    title: "Trocas e estornos organizados",
    text: "Abra uma solicitação pelo próprio pedido e acompanhe a análise da equipe.",
  },
  {
    icon: Headphones,
    title: "Atendimento especializado",
    text: "Conte com uma equipe que entende de telas, arames, cercamentos e instalação.",
  },
];

export function AccountAuthLayout({
  mode,
  children,
}: {
  mode: "login" | "register";
  children: ReactNode;
}) {
  const login = mode === "login";

  return (
    <main className="bg-white px-4 py-10 sm:px-6 sm:py-14 lg:py-18">
      <section className="mx-auto grid w-full max-w-6xl items-stretch gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
        <div className="order-2 flex min-w-0 flex-col justify-center py-2 lg:order-1 lg:py-8">
          <div className="max-w-2xl">
            <span className="block text-xs font-extrabold uppercase tracking-[.2em] text-zinc-500">
              Telas Jort · Área do cliente
            </span>
            <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#fff100] px-4 py-2 text-xs font-black uppercase tracking-[.14em] text-zinc-950">
              <ShieldCheck className="size-4" /> Compra segura e acompanhada
            </span>
            <h1 className="display-title mt-6 text-4xl leading-[1.02] text-zinc-950 sm:text-5xl lg:text-6xl">
              Tudo sobre o seu pedido, sempre à mão.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
              A Telas Jort reúne produtos e soluções para cercamentos, proteção e instalação. Na sua conta, você compra com mais agilidade e acompanha o atendimento do começo ao fim.
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {benefits.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 lg:max-w-xl">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff100] text-zinc-950">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h2 className="font-extrabold text-zinc-950">{title}</h2>
                  <p className="mt-1 text-sm leading-5 text-zinc-500">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-7 flex items-center gap-2 text-sm font-bold text-zinc-500">
            <MapPin className="size-4 text-zinc-950" /> Loja em Campo Mourão · Entregas para todo o Brasil
          </p>
        </div>

        <div className="relative order-1 min-w-0 overflow-hidden rounded-[2rem] bg-[#17191b] p-6 text-white shadow-[0_32px_80px_-32px_rgba(0,0,0,.55)] sm:p-9 lg:order-2 lg:flex lg:flex-col lg:justify-center lg:p-11">
          <span className="absolute -right-20 -top-20 size-56 rounded-full bg-[#fff100]/10 blur-2xl" aria-hidden="true" />
          <span className="absolute -bottom-28 -left-20 size-64 rounded-full bg-white/5 blur-2xl" aria-hidden="true" />
          <div className="relative">
            <Image
              src="/assets/images/storefront/logo-telas-jort.webp"
              alt="Telas Jort"
              width={198}
              height={70}
              className="mb-8 h-16 w-auto object-contain object-left"
              priority
            />
            <span className="inline-flex rounded-full border border-[#fff100]/50 bg-[#fff100]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#fff100]">
              {login ? "Bem-vindo de volta" : "Cadastro gratuito"}
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              {login ? "Entre na sua conta" : "Crie sua conta"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {login
                ? "Use o mesmo e-mail informado na compra para consultar seus pedidos e solicitações."
                : "Seus próximos pedidos serão vinculados ao seu acesso automaticamente."}
            </p>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
