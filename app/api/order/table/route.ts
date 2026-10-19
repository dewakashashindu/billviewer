// ============================================================
// LOCATION: app/api/order/table/route.ts
// GET /api/order/table?table=05&t=<signed token>
//
// Public — the customer scans the table QR and lands here.
// Returns the table's details so the welcome screen can greet
// the guest properly ("Table 05 · Main Dining").
// The token is checked so a guest cannot ask about a table they
// did not scan.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { checkTableAccess } from "@/lib/orderToken";
import { getOrderTableInfo } from "@/lib/orderService";
import { TAKEAWAY_TABLE_NO } from "@/lib/tableLink";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const tableNo = (params.get("table") ?? "").trim();
    const token = params.get("t") ?? "";

    if (!tableNo) {
      return NextResponse.json(
        { ok: false, error: "No table number. Please scan the QR code on your table." },
        { status: 400 }
      );
    }

    // Gentle throttle — this endpoint is hit on every page open.
    const ipLimit = rateLimit(`order-table-ip:${clientIp(request.headers)}`, 120, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
      );
    }

    const access = checkTableAccess(tableNo, token);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    /* Takeaway QR — "TA" is not a POS table; answer with the
       takeaway context instead of a 404. */
    if (tableNo.toUpperCase() === TAKEAWAY_TABLE_NO) {
      return NextResponse.json({
        ok: true,
        data: {
          tableNo: TAKEAWAY_TABLE_NO,
          tableGroup: "Takeaway",
          groupId: "",
          vacant: true,
          area: "Takeaway",
          source: isDbConfigured() ? "database" : "mock",
          takeaway: true,
        },
      });
    }

    const info = await getOrderTableInfo(tableNo);
    if (!info) {
      return NextResponse.json(
        { ok: false, error: "Table not found. Please scan the QR code on your table again." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        tableNo: info.tableNo,
        tableGroup: info.tableGroup,
        groupId: info.groupId,
        vacant: info.vacant,
        area: info.area,
        source: info.source,
      },
    });
  } catch (error) {
    console.error("Order table route error:", error);
    return NextResponse.json(
      { ok: false, error: "Could not load the table details." },
      { status: 500 }
    );
  }
}
