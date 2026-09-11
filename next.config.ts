import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/admin/supabase/schema": ["./db/supabase-schema.sql"],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
  async headers() {
    const scriptSources = [
      "'self'",
      "'unsafe-inline'",
      ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
      "https://sdk.mercadopago.com",
      "https://scripts.appmax.com.br",
      "https://connect.facebook.net",
      "https://www.googletagmanager.com",
    ].join(" ");

    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'",
            "img-src 'self' data: https://http2.mlstatic.com https://*.mercadopago.com https://www.facebook.com https://www.google.com https://www.google.com.br", "font-src 'self' data:",
            "style-src 'self' 'unsafe-inline'", `script-src ${scriptSources}`,
            "connect-src 'self' https://api.mercadopago.com https://api.melhorenvio.com.br https://sandbox.melhorenvio.com.br https://api.appmax.com.br https://api.sandboxappmax.com.br https://auth.appmax.com.br https://auth.sandboxappmax.com.br https://scripts.appmax.com.br https://www.facebook.com https://connect.facebook.net https://www.google-analytics.com https://www.google.com https://www.google.com.br https://www.googletagmanager.com",
            "frame-src https://*.mercadopago.com", process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
          ].filter(Boolean).join("; "),
        },
        ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
      ],
    }, {
      source: "/admin/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, private" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }, {
      source: "/api/admin/:path*",
      headers: [{ key: "Cache-Control", value: "no-store, private" }],
    }];
  },
};

export default nextConfig;
