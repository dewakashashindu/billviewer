// ============================================================
// LOCATION: app/api/order/qr/route.ts
// POST /api/order/qr  (staff only — session required)
//
// Body:
//   { baseUrl?: string,
//     tables: [{ tableNo, tableGroup }] }
//
// Returns one signed customer URL per table:
//   { tableNo, url }   url = <baseUrl>?table=..&group=..&t=<signed>
//
// The signed token is what stops a guest from ordering into
// another table's bill (see lib/orderToken.ts).
//
// Each table number is also checked against Tbl_Tables (when the
// DB is configured) and returned as `exists` — a QR printed for a
// table the POS doesn't know fails with "Table not found" when the
// guest tries to order, so staff should see it here instead.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { requireSession } from "@/lib/actionAuth";
import { getPool, isDbConfigured } from "@/lib/db";
import { signTableToken } from "@/lib/orderToken";
import { encryptTableId } from "@/lib/tableLink";

export const dynamic = "force-dynamic";

function buildUrl(
  base: string,
  tableNo: string,
  tableGroup: string,
  token: string,
  encryptedId: string | null
): string {
  let url = base.trim();

  /* New format — the link carries ONLY the encrypted table id:
     /menu?id=<encrypted>. When the template contains {id} and the id
     was encrypted, nothing else is appended (no table, group or
     token leaks into the URL). */
  if (encryptedId) {
    url = url.replace(/\{id\}/gi, encodeURIComponent(encryptedId));
    if (new RegExp("[?&]id=", "i").test(url)) return url;
  }

  // Legacy format — replace the placeholders the QR screen offers.
  url = url
    .replace(/\{table\}/gi, encodeURIComponent(tableNo))
    .replace(/\{group\}/gi, encodeURIComponent(tableGroup))
    .replace(/\{token\}/gi, encodeURIComponent(token));

  // Anything still missing is appended.
  const has = (key: string) =>
    new RegExp(`[?&]${key}=`, "i").test(url);

  if (!has("table")) {
    url += `${url.includes("?") ? "&" : "?"}table=${encodeURIComponent(tableNo)}`;
  }
  if (!has("group") && tableGroup) {
    url += `${url.includes("?") ? "&" : "?"}group=${encodeURIComponent(tableGroup)}`;
  }
  if (!has("t") && token) {
    url += `${url.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}`;
  }
  return url;
}

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

    const baseUrl =
      String(body.baseUrl ?? "").trim() ||
      `${process.env.PUBLIC_BASE_URL ?? ""}/order`;

    const urls: {
      tableNo: string;
      tableGroup: string;
      token: string;
      id: string | null;
      url: string;
    }[] = body.tables
      .filter((t: { tableNo?: string }) => t && String(t.tableNo ?? "").trim())
      .slice(0, 500)
      .map((t: { tableNo: string; tableGroup?: string }) => {
        const tableNo = String(t.tableNo).trim();
        const tableGroup = String(t.tableGroup ?? "").trim();
        const token = signTableToken(tableNo);
        // Encrypted table id for the new link format (?id=…). Falls
        // back to the legacy ?table=…&t=… format when ENCRYPTION_KEY
        // is not configured (dev without a key).
        const id = encryptTableId(tableNo);
        return {
          tableNo,
          tableGroup,
          token,
          id,
          url: buildUrl(baseUrl, tableNo, tableGroup, token, id),
        };
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
          exists: existsByKey[u.tableNo.trim().toUpperCase()] ?? true,
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
