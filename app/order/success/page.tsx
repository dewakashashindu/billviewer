// ============================================================
// LOCATION: app/order/success/page.tsx
// "Order received" — the last screen of the customer flow.
//
//   /order/success?table=05&t=<token>&inv=INV-20261018-001&n=3
// ============================================================
import SuccessPanel from "@/components/order/SuccessPanel";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; t?: string; inv?: string; n?: string }>;
}) {
  const params = await searchParams;
  const table = (params.table ?? "").trim();
  const token = (params.t ?? "").trim();
  const invoiceNo = (params.inv ?? "").trim();
  const itemCount = Number(params.n ?? 0) || 0;

  return (
    <SuccessPanel
      table={table}
      token={token}
      invoiceNo={invoiceNo}
      itemCount={itemCount}
    />
  );
}
