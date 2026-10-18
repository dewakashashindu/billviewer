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
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/actionAuth";
import { signTableToken } from "@/lib/orderToken";

export const dynamic = "force-dynamic";

function buildUrl(
  base: string,
  tableNo: string,
  tableGroup: string,
  token: string
): string {
  let url = base.trim();

  // Replace the placeholders the QR screen offers.
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

    const urls = body.tables
      .filter((t: { tableNo?: string }) => t && String(t.tableNo ?? "").trim())
      .slice(0, 500)
      .map((t: { tableNo: string; tableGroup?: string }) => {
        const tableNo = String(t.tableNo).trim();
        const tableGroup = String(t.tableGroup ?? "").trim();
        const token = signTableToken(tableNo);
        return { tableNo, tableGroup, token, url: buildUrl(baseUrl, tableNo, tableGroup, token) };
      });

    return NextResponse.json({ ok: true, data: { urls } });
  } catch (error) {
    console.error("QR url route error:", error);
    return NextResponse.json(
      { ok: false, error: "Could not build the QR links." },
      { status: 500 }
    );
  }
}
