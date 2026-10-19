// ============================================================
// LOCATION: app/api/order/qr/route.ts
// POST /api/order/qr  (staff only — session required)
//
// Body:
//   { tables: [{ tableNo, tableGroup, takeaway? }] }
//
// Returns one customer URL per table:
//   { tableNo, id, url, exists }
//
//   url = <QR_MENU_BASE_URL>?id=<encrypted>
//
// The base URL is hardcoded in config/qr.config.ts — it is never
// taken from (or shown to) the browser. The id is AES-encrypted
// server-side from the table number + table group, so nothing
// readable ends up in the URL and the HMAC secret never leaves
// the server.
//
// Each table number is also checked against Tbl_Tables (when the
// DB is configured) and returned as `exists` — a QR printed for
// a table the POS doesn't know fails with "Table not found" when
// the guest tries to order, so staff should see it here instead.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { requireSession } from "@/lib/actionAuth";
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

    const urls: {
      tableNo: string;
      tableGroup: string;
      id: string | null;
      url: string;
      takeaway: boolean;
    }[] = body.tables
      .filter((t: { tableNo?: string }) => t && String(t.tableNo ?? "").trim())
      .slice(0, 500)
      .map((t: { tableNo: string; tableGroup?: string; takeaway?: boolean }) => {
        const takeaway =
          t.takeaway === true || String(t.tableNo ?? "").trim().toUpperCase() === TAKEAWAY_TABLE_NO;
        const tableNo = takeaway ? TAKEAWAY_TABLE_NO : String(t.tableNo).trim();
        const tableGroup = takeaway ? "" : String(t.tableGroup ?? "").trim();

        /* Takeaway QR — one encrypted id ("TAK:TA") shared by every
           printed TA card; the order type is decided server-side from
           the table number, never from the browser. */
        const id = takeaway ? encryptTakeawayId() : encryptTableId(tableNo, tableGroup);
        const url = id
          ? `${QR_MENU_BASE_URL}?id=${encodeURIComponent(id)}`
          : `${QR_MENU_BASE_URL}?table=${encodeURIComponent(tableNo)}`;

        return { tableNo, tableGroup, id, url, takeaway };
      });

    /* ── validate table numbers against the POS (Tbl_Tables) ──
       Fail open: if the check itself errors, report every table as
       existing rather than blocking QR generation. */
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
          // Takeaway bars are not POS tables — never flag them.
          exists: u.takeaway ? true : existsByKey[u.tableNo.trim().toUpperCase()] ?? true,
        })),
      },
    });
  } catch (error) {
    console.error("QR url route error:", error);
    return NextResponse.json(
      { ok: false, error: "Could not build the QR links." },
      { status: 500 }
    );
  }
}
