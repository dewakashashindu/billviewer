import { NextRequest, NextResponse } from "next/server";
import { getMenuItemImage } from "@/lib/menuService";

// GET /api/menu/image/<MenuItemCode>
// Serves Tbl_MenuItems.ItemPicMob as a browser-displayable
// image (ICO/DIB frames are converted to PNG by lib/menuImage).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const image = await getMenuItemImage(decodeURIComponent(code));
    if (!image) {
      return NextResponse.json(
        { ok: false, error: "Image not found" },
        { status: 404 }
      );
    }
    return new NextResponse(new Uint8Array(image.body), {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Menu image error:", error);
    return NextResponse.json(
      { ok: false, error: "Image unavailable" },
      { status: 500 }
    );
  }
}
