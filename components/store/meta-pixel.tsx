"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { trackGoogleEvent, trackMetaEvent } from "@/lib/client-analytics";

type Consent = "granted" | "denied" | null;
type FbqFunction = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string };

function storeConsent(value: Exclude<Consent, null>) {
  localStorage.setItem("tj_meta_consent", value);
  document.cookie = `tj_meta_consent=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.dispatchEvent(new CustomEvent("tj-meta-consent", { detail: value }));
}

function initializePixel(pixelId: string) {
  window.__TJ_META_PIXEL_ID = pixelId;
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      const current = window.fbq;
      if (current?.callMethod) current.callMethod(...args);
      else fbq.queue.push(args);
    } as FbqFunction;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/pt_BR/fbevents.js";
    document.head.appendChild(script);
  }
  window.fbq("init", pixelId);
}

function initializeGoogleAds(conversionId: string) {
  window.__TJ_GOOGLE_ADS_ID = conversionId;
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => { window.dataLayer?.push(args); };
    window.gtag("js", new Date());
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(conversionId)}`;
    document.head.appendChild(script);
  }
  window.gtag("config", conversionId, { send_page_view: false });
}

export function MarketingTags({ pixelId, googleAdsId, googlePurchaseLabel }: { pixelId?: string; googleAdsId?: string; googlePurchaseLabel?: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    if (!pixelId && !googleAdsId) return;
    const frame = requestAnimationFrame(() => {
      const stored = localStorage.getItem("tj_meta_consent");
      setConsent(stored === "granted" || stored === "denied" ? stored : null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pixelId, googleAdsId]);

  useEffect(() => {
    if (consent !== "granted") return;
    if (pixelId) { initializePixel(pixelId); trackMetaEvent("PageView"); }
    if (googleAdsId) {
      initializeGoogleAds(googleAdsId);
      window.__TJ_GOOGLE_PURCHASE_LABEL = googlePurchaseLabel;
      trackGoogleEvent("page_view", { page_path: pathname });
    }
  }, [pixelId, googleAdsId, googlePurchaseLabel, consent, pathname]);

  if (!pixelId && !googleAdsId) return null;
  const choose = (value: Exclude<Consent, null>) => { storeConsent(value); setConsent(value); setShowPreferences(false); };
  return <>
    {(consent === null || showPreferences) && <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-4xl rounded-2xl border border-zinc-300 bg-white p-4 shadow-2xl sm:flex sm:items-center sm:gap-5 sm:p-5">
      <div className="flex-1"><strong className="text-sm">Sua privacidade importa</strong><p className="mt-1 text-xs leading-5 text-zinc-600">Usamos cookies de medição da Meta e do Google para entender anúncios e compras. Eles só são ativados com sua permissão. Veja a <Link href="/politica-de-privacidade" className="font-bold underline">política de privacidade</Link>.</p></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-0 sm:w-64"><button type="button" onClick={() => choose("denied")} className="rounded-xl border border-zinc-300 px-3 py-3 text-xs font-bold">Recusar</button><button type="button" onClick={() => choose("granted")} className="rounded-xl bg-black px-3 py-3 text-xs font-bold text-white">Aceitar</button></div>
    </div>}
    {consent !== null && !showPreferences && <button type="button" onClick={() => setShowPreferences(true)} className="fixed bottom-3 left-3 z-40 rounded-full border border-zinc-300 bg-white px-3 py-2 text-[11px] font-bold shadow">Cookies</button>}
  </>;
}

declare global {
  interface Window {
    __TJ_META_PIXEL_ID?: string;
    __TJ_GOOGLE_ADS_ID?: string;
    __TJ_GOOGLE_PURCHASE_LABEL?: string;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: FbqFunction;
  }
}
