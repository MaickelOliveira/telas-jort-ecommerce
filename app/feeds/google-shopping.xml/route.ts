import { getRuntimeProducts } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";
const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[char] || char);

export async function GET() {
  const origin = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const products = getRuntimeProducts();
  const eligible = products.filter((product) => product.active && (product.measurement.mode === "unit" || product.measurement.mode === "fixed_roll"));
  const items = eligible.map((product) => `
    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <title>${escapeXml(product.name)}</title>
      <description>${escapeXml(product.metaDescription)}</description>
      <link>${escapeXml(`${origin}/produto/${product.slug}`)}</link>
      <g:image_link>${escapeXml(`${origin}${product.image}`)}</g:image_link>
      <g:availability>${product.inventory === 0 ? "out_of_stock" : "in_stock"}</g:availability>
      <g:price>${(product.priceCents / 100).toFixed(2)} BRL</g:price>
      <g:condition>new</g:condition>
      <g:brand>Telas Jort</g:brand>
      <g:mpn>${escapeXml(product.sku)}</g:mpn>
      <g:product_type>${escapeXml(`${product.category} > ${product.subcategory}`)}</g:product_type>
    </item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel>
    <title>Telas Jort</title><link>${escapeXml(origin)}</link><description>Catálogo de produtos Telas Jort</description>${items}
  </channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
