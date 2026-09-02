import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getBillByNumber } from "@/lib/mockBills";

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

  const bill = getBillByNumber(billNumber);

  if (!bill) {
    return NextResponse.json(
      { success: false, error: "Bill not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, bill });
}