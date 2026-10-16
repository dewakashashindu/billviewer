// ============================================================
// LOCATION: app/menu/page.tsx
// PUBLIC customer menu + ordering page (no login).
// The table QR points here:  /menu?table=T-07&group=Main%20Dining
// (app/(main) group eken PITA — auth guard eka mekata wadā karanne naha)
// ============================================================

import type { Metadata } from "next";
import MenuClient from "@/components/menu/MenuClient";

export const metadata: Metadata = {
  title: "Mila Mirissa — Menu & Order",
  description: "Browse the menu and order from your table",
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; group?: string }>;
}) {
  const params = await searchParams;
  const table = (params.table ?? "").trim();
  const tableGroup = (params.group ?? "").trim();

  return <MenuClient table={table} tableGroup={tableGroup} />;
}
