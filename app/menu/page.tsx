// ============================================================
// LOCATION: app/menu/page.tsx
// PUBLIC customer menu + ordering page (no login).
//
// QR links (new):   /menu?id=<encrypted table + group + locCode>
//   The link carries ONLY the encrypted id — table number, group,
//   and location code are never visible in the URL.
// ============================================================

import type { Metadata } from "next";
import MenuClient from "@/components/menu/MenuClient";
import { getPool, isDbConfigured } from "@/lib/db";
import { TAKEAWAY_TABLE_NO } from "@/lib/tableLink";
import { readTableToken } from "@/lib/orderToken";
import "./menu.css";

export const metadata: Metadata = {
  title: "Mila Mirissa — Menu & Order",
  description: "Browse the menu and order from your table",
};

function findKey(keys: string[], candidates: string[]): string | null {
  const lower = new Map<string, string>();
  for (const k of keys) lower.set(k.toLowerCase(), k);
  for (const cand of candidates) {
    const hit = lower.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

async function resolveLocationName(locCode: string): Promise<string> {
  const code = String(locCode ?? "").trim();
  if (!code || !isDbConfigured()) return "";
  try {
    const pool = await getPool();
    const res = await pool
      .request()
      .query(`SELECT * FROM Tbl_LocationMaster WITH (NOLOCK);`)
      .catch(() =>
        pool.request().query(`SELECT * FROM dbo.Tbl_LocationMaster WITH (NOLOCK);`)
      );
    const rows = (res?.recordset ?? []) as Record<string, unknown>[];
    if (!rows.length) return "";
    const keys = Object.keys(rows[0]);
    const lcKey = findKey(keys, ["LocCode", "Code", "Loc"]);
    const ldKey = findKey(keys, ["LocDes", "LocName", "Description", "Name"]);
    if (!lcKey || !ldKey) return "";

    const target = code.toUpperCase();
    for (const r of rows) {
      const rowCode = String(r[lcKey] ?? "").trim().toUpperCase();
      if (rowCode === target) {
        return String(r[ldKey] ?? "").trim();
      }
    }
    return "";
  } catch {
    return "";
  }
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    table?: string;
    group?: string;
    loc?: string;
    t?: string;
  }>;
}) {
  const params = await searchParams;

  let table = "";
  let token = "";
  let invalidLink = false;
  let legacyGroup = "";
  let locCode = "";
  let isTakeaway = false;

  const id = (params.id ?? "").trim();
  const rawToken = id || (params.t ?? "").trim();
  const verified = rawToken ? readTableToken(rawToken) : null;
  if (verified) {
    table = verified.table;
    token = rawToken;
    legacyGroup = verified.group;
    locCode = verified.location;
    isTakeaway = table.toUpperCase() === TAKEAWAY_TABLE_NO;
  } else {
    invalidLink = true;
  }

  const tableGroup =
    legacyGroup || (isTakeaway ? "Takeaway" : "");
  const locationName = locCode ? await resolveLocationName(locCode) : "";

  return (
    <MenuClient
      table={table}
      tableGroup={tableGroup}
      locCode={locCode}
      locationName={locationName}
      token={token}
      invalidLink={invalidLink}
      isTakeaway={isTakeaway}
    />
  );
}
