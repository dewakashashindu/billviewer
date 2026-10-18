// ============================================================
// LOCATION: app/order/menu/page.tsx
// The menu screen — browse, search and add to the cart.
//
//   /order/menu?table=05&t=<signed token>
// ============================================================
import MenuPanel from "@/components/order/MenuPanel";

export const dynamic = "force-dynamic";

export default async function OrderMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; group?: string; t?: string }>;
}) {
  const params = await searchParams;
  const table = (params.table ?? "").trim();
  const tableGroup = (params.group ?? "").trim();
  const token = (params.t ?? "").trim();

  return <MenuPanel table={table} token={token} tableGroup={tableGroup} />;
}
