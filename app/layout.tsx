import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/store/cart-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "Telas Jort", template: "%s | Telas Jort" },
  description: "Telas, arames e acessórios para cercamentos com compra por unidade, metro ou metro quadrado.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <CartProvider>{children}</CartProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
