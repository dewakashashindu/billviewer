import { NextRequest, NextResponse } from "next/server";
import { getMenuPage } from "@/lib/menuService";

// GET /api/menu/items?limit=50&after=ITEM050
// Public customer menu feed (keyset pagination by MenuItemCode).
// No menu caching — every request reads the database.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limit = Number(params.get("limit") ?? 50);
    const after = params.get("after") ?? "";
    const page = await getMenuPage(limit, after);
    return NextResponse.json({
      ok: true,
      items: page.items,
      limit: page.limit,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      source: page.source,
    });
  } catch (error) {
    console.error("Menu items error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to load menu" },
      { status: 500 }
    );
  }
}
