import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getBillByNumber } from "@/lib/mockBills";
import { getBillFromDb } from "@/lib/billService";
import { isDbConfigured } from "@/lib/db";

const IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03,
  0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b,
  0x0c, 0x0d, 0x0e, 0x0f,
]);

function decryptBillNumber(encryptedText: string): string | null {
  try {
    const key = process.env.ENCRYPTION_KEY;

    if (!key || key.length !== 16) {
      console.error("Invalid ENCRYPTION_KEY");
      return null;
    }

    let base64 = encryptedText.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";

    const encryptedBuffer = Buffer.from(base64, "base64");
    const decipher = crypto.createDecipheriv(
      "aes-128-cbc",
      Buffer.from(key, "utf8"),
      IV
    );

    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption error:", error);
    console.error(
      "💡 Hint: me error eka wenne ENCRYPTION_KEY eka link eka encrypt karapu key ekata aduwa nisa. " +
        "Check: node scripts/diagnose-link.mjs <link-id>"
    );
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const encryptedId = searchParams.get("id");

  if (!encryptedId) {
    return NextResponse.json(
      { success: false, error: "No encrypted ID provided" },
      { status: 400 }
    );
  }

  if (!process.env.ENCRYPTION_KEY) {
    return NextResponse.json(
      { success: false, error: "Server configuration error" },
      { status: 500 }
    );
  }

  const billNumber = decryptBillNumber(encryptedId);

  if (!billNumber) {
    return NextResponse.json(
      { success: false, error: "Invalid encrypted ID" },
      { status: 400 }
    );
  }

  let bill;
  let source: "database" | "mock";

  if (isDbConfigured()) {
    try {
      bill = await getBillFromDb(billNumber);
      source = "database";
    } catch (error) {
      console.error("❌ MSSQL error while fetching bill:", error);
      return NextResponse.json(
        { success: false, error: "Database error while fetching bill" },
        { status: 500 }
      );
    }
  } else {
    // Dev fallback — DB env vars not set, serve mock data so the
    // app stays usable locally. Set DB_* vars in .env.local for real data.
    console.warn(
      "⚠️ DB_* env vars not configured — serving MOCK bill (dev fallback)"
    );
    bill = getBillByNumber(billNumber);
    source = "mock";
  }

  if (!bill) {
    return NextResponse.json(
      { success: false, error: "Bill not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, source, bill });
}
