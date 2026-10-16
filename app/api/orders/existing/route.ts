import { NextRequest, NextResponse } from "next/server";
import { getExistingBill } from "@/lib/menuService";

// GET /api/orders/existing?table=T-01
// The table's current unpaid bill (read-only baseline for the cart).
export async function GET(request: NextRequest) {
  try {
    const table = request.nextUrl.searchParams.get("table") ?? "";
    const bill = await getExistingBill(table);
    return NextResponse.json({ ok: true, data: bill });
  } catch (error) {
    console.error("Existing bill route error:", error);
    return NextResponse.json({ ok: false, error: "Could not load the current bill." }, { status: 500 });
  }
}
