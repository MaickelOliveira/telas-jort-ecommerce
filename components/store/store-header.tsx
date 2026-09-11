"use client";

import Image from "next/image";
import Link from "next/link";
import {
  House,
  MapPin,
  Menu,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/store/cart-provider";

const nav = [
  ["Início", "/"],
  ["Telas", "/produtos?categoria=Telas"],
  ["Arames", "/produtos?categoria=Arames"],
  ["Acessórios", "/produtos?categoria=Acessórios"],
  ["Ferramentas", "/produtos?categoria=Ferramentas"],
  ["EPIs", "/produtos?categoria=EPIs"],
  ["Contato", "/contato"],
];

const mobileNav = [
  ...nav,
  ["Quem somos", "/quem-somos"],
  ["Trocas e devoluções", "/trocas-e-devolucoes"],
  ["Carrinho", "/carrinho"],
];

function Logo() {
  return (
    <Image
      src="/assets/images/storefront/logo-telas-jort.webp"
      alt="Telas Jort"
      width={240}
      height={85}
      priority
    />
  );
}

export function StoreHeader({ customerName }: { customerName?: string }) {
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  return (
    <header className="tj-site-header">
      <div className="tj-desktop-header">
        <div className="tj-header-main">
          <div className="tj-page-width tj-header-main__inner">
            <Link className="tj-header-logo" href="/" aria-label="Telas Jort — início">
              <Logo />
            </Link>

            <form className="tj-header-search" action="/produtos" role="search">
              <label className="tj-visually-hidden" htmlFor="desktop-store-search">
                O que você está buscando?
              </label>
              <input
                id="desktop-store-search"
                type="search"
                name="q"
                placeholder="O que você está buscando?"
              />
              <button type="submit" aria-label="Buscar">
                <Search aria-hidden="true" />
              </button>
            </form>

            <div className="tj-header-actions">
              <Link className="tj-header-action" href={customerName ? "/conta" : "/conta/entrar"} aria-label="Minha conta">
                <UserRound aria-hidden="true" />
                <span className="tj-header-action__text">
                  <strong>{customerName ? `Olá, ${customerName.split(" ")[0]}` : "Olá! Faça login"}</strong>
                  <span>{customerName ? "Acompanhar pedidos" : "Ou cadastre-se"}</span>
                </span>
              </Link>
              <Link className="tj-header-action" href="/carrinho" aria-label={`Carrinho com ${count} itens`}>
                <ShoppingCart aria-hidden="true" />
                <span className="tj-cart-count">{count}</span>
              </Link>
            </div>
          </div>
        </div>

        <nav className="tj-header-nav" aria-label="Menu principal">
          <div className="tj-page-width tj-header-nav__inner">
            <Link className="tj-header-category-link" href="/produtos">
              <Menu aria-hidden="true" />
              <span>Categorias</span>
            </Link>
            <ul className="tj-header-menu">
              {nav.map(([label, href]) => (
                <li key={label}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
            <div className="tj-header-benefits">
              <div className="tj-header-benefit">
                <span className="tj-header-benefit__icon"><House aria-hidden="true" /></span>
                <span>Compre online e retire o seu pedido na loja</span>
              </div>
              <div className="tj-header-benefit">
                <span className="tj-header-benefit__icon"><MapPin aria-hidden="true" /></span>
                <span>Enviamos para todo o Brasil</span>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <div className="tj-mobile-header tj-page-width">
        <button
          className="tj-mobile-icon-button"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu aria-hidden="true" />
        </button>
        <Link className="tj-header-logo" href="/" aria-label="Telas Jort — início">
          <Logo />
        </Link>
        <div className="tj-mobile-header__actions">
          <Link className="tj-mobile-icon-button" href={customerName ? "/conta" : "/conta/entrar"} aria-label="Minha conta">
            <UserRound aria-hidden="true" />
          </Link>
          <Link className="tj-mobile-icon-button tj-mobile-cart" href="/carrinho" aria-label={`Carrinho com ${count} itens`}>
            <ShoppingCart aria-hidden="true" />
            <span className="tj-cart-count">{count}</span>
          </Link>
        </div>
      </div>

      <div className="tj-mobile-search">
        <form className="tj-header-search tj-page-width" action="/produtos" role="search">
          <label className="tj-visually-hidden" htmlFor="mobile-store-search">
            Buscar produtos
          </label>
          <input
            id="mobile-store-search"
            type="search"
            name="q"
            placeholder="O que você está buscando?"
          />
          <button type="submit" aria-label="Buscar">
            <Search aria-hidden="true" />
          </button>
        </form>
      </div>

      <div
        className={`tj-mobile-drawer${open ? " is-open" : ""}`}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      >
        <div className="tj-mobile-drawer__panel" onClick={(event) => event.stopPropagation()}>
          <div className="tj-mobile-drawer__head">
            <strong>Categorias</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Menu móvel">
            <ul className="tj-mobile-menu">
              {mobileNav.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} onClick={() => setOpen(false)}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
