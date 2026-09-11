import { CouponManager } from "@/components/admin/coupon-manager";
import { PageHeader } from "@/components/admin/page-header";
import { listCoupons } from "@/lib/database";

export default function CouponsPage() {
  return <div className="mx-auto max-w-[1200px]">
    <PageHeader eyebrow="Vendas" title="Cupons de desconto" description="Crie os cupons na própria loja. O desconto é validado no servidor e o Mercado Pago recebe somente o valor final do pedido." />
    <CouponManager initialCoupons={listCoupons()} />
  </div>;
}
