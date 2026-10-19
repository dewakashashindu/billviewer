// ============================================================
// LOCATION: app/menu/page.tsx
// PUBLIC customer menu + ordering page (no login).
//
// QR links (new):   /menu?id=<encrypted table id>
//   The link carries ONLY the encrypted table id — the table number
//   is never visible in the URL. This server component decrypts it
//   and mints a fresh API token (never exposed in the URL) for the
//   guarded /api/order/* calls the client makes.
//
// QR links (legacy): /menu?table=T-07&group=Main%20Dining&t=<token>
//   Older printed QRs keep working — table/group/t are read as-is.
//
// (app/(main) group eken PITA — auth guard eka mekata wadā karanne naha)
// ============================================================

import type { Metadata } from "next";
import MenuClient from "@/components/menu/MenuClient";
import { decryptTableLink, TAKEAWAY_TABLE_NO } from "@/lib/tableLink";
import { signTableToken } from "@/lib/orderToken";
import "./menu.css";

export const metadata: Metadata = {
  title: "Mila Mirissa — Menu & Order",
  description: "Browse the menu and order from your table",
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; table?: string; group?: string; t?: string }>;
}) {
  const params = await searchParams;

  let table = "";
  let token = "";
  let invalidLink = false;
  let legacyGroup = "";
  let isTakeaway = false;

  const id = (params.id ?? "").trim();
  if (id) {
    /* New format — decrypt the table id and mint a fresh API token.
       The token is passed to the client as a prop; it never appears
       in the URL, so it cannot be copied out of the address bar. */
    const decrypted = decryptTableLink(id);
    if (decrypted) {
      table = decrypted.tableNo;
      token = signTableToken(decrypted.tableNo);
      // The group is inside the encrypted payload too — used as the
      // initial value while /api/order/table resolves the live one.
      legacyGroup = decrypted.tableGroup;
      // Takeaway QR → no table, no pax; orders go in as OrderType TA.
      isTakeaway = decrypted.kind === "takeaway";
    } else {
      invalidLink = true; // tampered / wrong key / not a table link
    }
  } else {
    /* Legacy format — ?table=…&group=…&t=… */
    table = (params.table ?? "").trim();
    token = (params.t ?? "").trim();
    isTakeaway = table.toUpperCase() === TAKEAWAY_TABLE_NO;
  }

  // New links carry the group INSIDE the encrypted id (table no + group);
  // the client still adopts the live group name from the POS
  // (Tbl_Tables / Tbl_TableGroup) as soon as /api/order/table answers.
  const tableGroup =
    (params.group ?? "").trim() || legacyGroup || (isTakeaway ? "Takeaway" : "");

  return (
    <MenuClient
      table={table}
      tableGroup={tableGroup}
      token={token}
      invalidLink={invalidLink}
      isTakeaway={isTakeaway}
    />
  );
}
