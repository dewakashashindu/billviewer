import { NextRequest, NextResponse } from "next/server";
import { confirmOrder, OrderError } from "@/lib/menuService";

// POST /api/orders/confirm
// Customer web order confirm. Body:
//   { tableNo, tableGroup?, requestId?,
//     customerName?, customerPhone?,
//     items: [{ itemId, quantity, remark? }] }
// Prices and availability are resolved on the server; the
// quantities in `items` are ADDITIONS to the table's bill
// (existing 3 + added 2 -> bill 5, activity +2).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }
    const result = await confirmOrder(body);
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
