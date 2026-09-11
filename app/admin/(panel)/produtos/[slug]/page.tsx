import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { ProductEditor } from "@/components/admin/product-editor";
import { getRuntimeProduct } from "@/lib/catalog-server";
export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) { const product = getRuntimeProduct((await params).slug); if (!product) notFound(); return <div className="mx-auto max-w-[1300px]"><PageHeader eyebrow="Editar produto" title={product.name} description={`SKU ${product.sku}`} /><ProductEditor product={product} /></div>; }
