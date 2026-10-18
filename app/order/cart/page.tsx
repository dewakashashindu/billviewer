// ============================================================
// LOCATION: app/order/cart/page.tsx
// The cart screen — review, add special requests and place the
// order for this table.
//
//   /order/cart?table=05&t=<signed token>
// ============================================================
import CartPanel from "@/components/order/CartPanel";

export const dynamic = "force-dynamic";

export default async function OrderCartPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; group?: string; t?: string }>;
}) {
  const params = await searchParams;
  const table = (params.table ?? "").trim();
  const tableGroup = (params.group ?? "").trim();
  const token = (params.t ?? "").trim();

  return <CartPanel table={table} token={token} tableGroup={tableGroup} />;
}
