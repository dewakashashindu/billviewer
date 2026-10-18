// ============================================================
// LOCATION: app/order/page.tsx
// Welcome screen — the first thing the guest sees after
// scanning the table QR.
//
//   /order?table=05&t=<signed token>
// ============================================================
import WelcomePanel from "@/components/order/WelcomePanel";

export const dynamic = "force-dynamic";

export default async function OrderWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; t?: string }>;
}) {
  const params = await searchParams;
  const table = (params.table ?? "").trim();
  const token = (params.t ?? "").trim();

  return <WelcomePanel table={table} token={token} />;
}
