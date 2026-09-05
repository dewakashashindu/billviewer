import crypto from "crypto";
import { redirect } from "next/navigation";

// Demo bill number — encrypted at request time with the current
// ENCRYPTION_KEY, so this keeps working even if the key changes.
const DEMO_BILL_NO = "MC-8492";

function encryptBillNumber(billNumber: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 16) return "";

  const IV = Buffer.from([
    0x00, 0x01, 0x02, 0x03,
    0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b,
    0x0c, 0x0d, 0x0e, 0x0f,
  ]);

  const cipher = crypto.createCipheriv(
    "aes-128-cbc",
    Buffer.from(key, "utf8"),
    IV
  );
  const encrypted = Buffer.concat([
    cipher.update(billNumber, "utf8"),
    cipher.final(),
  ]);

  return encrypted
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const dynamic = "force-dynamic";

export default function HomePage() {
  const id = encryptBillNumber(DEMO_BILL_NO);

  // Demo bill ekata redirect — production eke remove karanna one
  redirect(id ? `/bill?id=${id}` : "/bill");
}
