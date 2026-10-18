// ============================================================
// LOCATION: app/(main)/orders/page.tsx
// Live web orders — what the kitchen / staff sees.
//
// Reads the open (unpaid) web orders from Tbl_HoldUpsCloud
// (UserID = 'WEB'), grouped per invoice and table.
//
// Staff only — the (main) layout already requires a session.
// ============================================================
import { getLiveWebOrders } from "@/lib/orderService";
import LiveOrdersView from "@/components/order/LiveOrdersView";

export const dynamic = "force-dynamic";

export default async function LiveOrdersPage() {
  const { orders, source } = await getLiveWebOrders(60);
  return <LiveOrdersView orders={orders} source={source} />;
}
