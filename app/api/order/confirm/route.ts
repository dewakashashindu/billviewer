// ============================================================
// LOCATION: app/api/order/confirm/route.ts
// POST /api/order/confirm
//
// Body:
//   { tableNo, tableGroup?, t?, pax?, customerName?, customerPhone?,
//     customerCode?, orderType?, items: [{ itemId, quantity, remark? }] }
//
// tableNo = "TA" → takeaway: OrderType TA, TabelNo from Tbl_Serials('TA')
// (e.g. TA-0001) and InvoiceNo from Tbl_Serials('INV') (same as DI).
//
// Guards (see web-qr-ordering-spec.md §6):
//   1. the table token must match the table number
//   2. rate limit per IP and per table
//   3. prices + availability are re-read from the DB inside
//      lib/menuService.confirmOrder — the browser price is never
//      trusted
//   4. the invoice is derived from the table on the server, so a
//      guest cannot add items to somebody else's bill
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { checkTableAccess } from "@/lib/orderToken";
import { confirmOrder, OrderError } from "@/lib/menuService";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const IP_LIMIT = 12; // orders per IP per 5 minutes
const TABLE_LIMIT = 25; // orders per table per 5 minutes
const WINDOW_MS = 5 * 60_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const tableNo = String(body.tableNo ?? "").trim();
    const token = String(body.t ?? "").trim();

    if (!tableNo) {
      return NextResponse.json(
        { ok: false, error: "Table number is missing. Please scan the table QR again." },
        { status: 400 }
      );
    }

    /* 1) table token ------------------------------------------------ */
    const access = checkTableAccess(tableNo, token);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    /* 2) rate limit -------------------------------------------------- */
    const ip = clientIp(request.headers);
    const ipLimit = rateLimit(`order-ip:${ip}`, IP_LIMIT, WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many orders from this device. Please wait ${ipLimit.retryAfterSeconds}s and try again.`,
        },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
      );
    }
    const tableLimit = rateLimit(`order-table:${tableNo}:${ip}`, TABLE_LIMIT, WINDOW_MS);
    if (!tableLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many orders for this table. Please wait ${tableLimit.retryAfterSeconds}s and try again.`,
        },
        { status: 429, headers: { "Retry-After": String(tableLimit.retryAfterSeconds) } }
      );
    }

    /* 3) place the order --------------------------------------------- */
    const result = await confirmOrder({
      tableNo,
      tableGroup: body.tableGroup ? String(body.tableGroup) : undefined,
      items: Array.isArray(body.items) ? body.items : [],
      customerName: body.customerName ? String(body.customerName) : undefined,
      customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
      customerCode: body.customerCode ? String(body.customerCode) : undefined,
      pax: body.pax ? Number(body.pax) : undefined,
      localPax: body.localPax != null ? Number(body.localPax) : undefined,
      foreignPax: body.foreignPax != null ? Number(body.foreignPax) : undefined,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Order confirm route error:", error);
    return NextResponse.json(
      { ok: false, error: "Order could not be saved. Please try again." },
      { status: 500 }
    );
  }
}
