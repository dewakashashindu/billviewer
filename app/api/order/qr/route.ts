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
import { TAKEAWAY_TABLE_NO } from "@/lib/tableLink";
import { signTableToken } from "@/lib/orderToken";
import { QR_MENU_BASE_URL } from "@/config/qr.config";
import { AccessDeniedError, requireWebPermission, requireWebLocation } from "@/lib/webAuthorization";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const access = await requireWebPermission(session, "tableqr:PRINT");

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.tables)) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const defaultLocCode = String(body.locCode ?? "").trim();
    for (const table of body.tables) {
      if (!table || typeof table !== "object") {
        return NextResponse.json({ok:false,error:"Invalid table."},{status:400});
      }
      const location = String(table.locCode ?? defaultLocCode).trim();
      if (!location || location.length > 10) {
        return NextResponse.json({ok:false,error:"Select a valid location."},{status:400});
      }
      requireWebLocation(access, location);
    }

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

          const id = signTableToken(tableNo, locCode, tableGroup);
          const url = `${QR_MENU_BASE_URL}?id=${encodeURIComponent(id)}`;

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
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }
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
