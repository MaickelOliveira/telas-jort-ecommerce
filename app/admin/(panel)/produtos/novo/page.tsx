import { PageHeader } from "@/components/admin/page-header";
import { ProductEditor } from "@/components/admin/product-editor";
export default function NewProductPage() { return <div className="mx-auto max-w-[1300px]"><PageHeader eyebrow="Catálogo" title="Novo produto" description="Escolha a forma de venda; os campos de preço e peso mudam automaticamente." /><ProductEditor /></div>; }
