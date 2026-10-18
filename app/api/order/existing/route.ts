// ============================================================
// LOCATION: app/api/order/existing/route.ts
// GET /api/order/existing?table=05&t=<signed token>
//
// The table's current unpaid bill (read-only baseline for the
// cart) — the customer sees "already on your bill" lines and
// the guest can only add on top of them.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { checkTableAccess } from "@/lib/orderToken";
import { getExistingBill } from "@/lib/menuService";

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

    const access = checkTableAccess(tableNo, token);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    const bill = await getExistingBill(tableNo);
    return NextResponse.json({ ok: true, data: bill });
  } catch (error) {
    console.error("Order existing route error:", error);
    return NextResponse.json(
      { ok: false, error: "Could not load the current bill." },
      { status: 500 }
    );
  }
}
