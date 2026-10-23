// ============================================================
// LOCATION: app/api/order/qr/route.ts
// POST /api/order/qr  (staff only — session required)
//
// Body:
//   { locCode?: string, tables: [{ tableNo, tableGroup, takeaway?, locCode? }] }
//
// Returns one customer URL per table:
//   { tableNo, tableGroup, locCode, id, url, exists }
//
//   url = <QR_MENU_BASE_URL>?id=<encrypted>
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { requireSession, UnauthorizedError } from "@/lib/actionAuth";
import { getPool, isDbConfigured } from "@/lib/db";
import { encryptTableId, encryptTakeawayId, TAKEAWAY_TABLE_NO } from "@/lib/tableLink";
import { QR_MENU_BASE_URL } from "@/config/qr.config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireSession();

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.tables)) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const defaultLocCode = String(body.locCode ?? "").trim();

    const urls: {
      tableNo: string;
      tableGroup: string;
      locCode: string;
      id: string | null;
      url: string;
      takeaway: boolean;
    }[] = body.tables
      .filter((t: { tableNo?: string }) => t && String(t.tableNo ?? "").trim())
      .slice(0, 500)
      .map(
        (t: {
          tableNo: string;
          tableGroup?: string;
          takeaway?: boolean;
          locCode?: string;
        }) => {
          const takeaway =
            t.takeaway === true ||
            String(t.tableNo ?? "").trim().toUpperCase() === TAKEAWAY_TABLE_NO;
          const tableNo = takeaway ? TAKEAWAY_TABLE_NO : String(t.tableNo).trim();
          const tableGroup = takeaway ? "" : String(t.tableGroup ?? "").trim();
          const locCode = String(t.locCode ?? defaultLocCode).trim();

          const id = takeaway
            ? encryptTakeawayId(locCode)
            : encryptTableId(tableNo, tableGroup, locCode);
          const fallbackParams = new URLSearchParams({ table: tableNo });
          if (locCode) fallbackParams.set("loc", locCode);
          const url = id
            ? `${QR_MENU_BASE_URL}?id=${encodeURIComponent(id)}`
            : `${QR_MENU_BASE_URL}?${fallbackParams.toString()}`;

          return { tableNo, tableGroup, locCode, id, url, takeaway };
        }
      );

    /* ── validate table numbers against the POS (Tbl_Tables) ── */
    const existsByKey: Record<string, boolean> = {};
    if (isDbConfigured() && urls.length) {
      try {
        const pool = await getPool();
        const req = pool.request();
        const inList = urls.map((_, i) => `@t${i}`).join(", ");
        urls.forEach((u, i) => req.input(`t${i}`, sql.VarChar(50), u.tableNo));
        const res = await req.query(`
          SELECT LTRIM(RTRIM(TableNo)) AS TableNo
          FROM dbo.Tbl_Tables WITH (NOLOCK)
          WHERE Enable = 1 AND LTRIM(RTRIM(TableNo)) IN (${inList});
        `);
        const found = new Set(
          res.recordset.map((r) => String(r.TableNo).trim().toUpperCase())
        );
        for (const u of urls) {
          existsByKey[u.tableNo.trim().toUpperCase()] = found.has(
            u.tableNo.trim().toUpperCase()
          );
        }
      } catch (checkError) {
        console.error("QR table validation error:", checkError);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        urls: urls.map((u) => ({
          ...u,
          exists: u.takeaway ? true : existsByKey[u.tableNo.trim().toUpperCase()] ?? true,
        })),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
    }
    console.error("QR url route error:", error);
    return NextResponse.json(
      { ok: false, error: "Could not build the QR links." },
      { status: 500 }
    );
  }
}
