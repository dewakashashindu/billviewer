// ============================================================
// LOCATION: lib/tableLink.ts
// Encrypted table identifier for customer QR links.
//
// The QR link carries ONLY an encrypted table id:
//     /menu?id=<encrypted>
// The table number is never shown in the URL — it is AES-128-CBC
// encrypted with ENCRYPTION_KEY (the same 16-char key + fixed IV
// scheme the bill links use, so the POS Windows service can mint
// these links too).
//
// Plaintext format:  "TBL:<tableNo>"   (e.g. "TBL:D12")
// The prefix stops a bill link id from being replayed as a table
// link (and vice versa).
//
// Server-only — the key must never reach the browser.
// ============================================================
import crypto from "crypto";

/* fixed IV — same scheme as the /api/bill decrypt route */
const IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
]);

const PREFIX = "TBL:";

function keyBuffer(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY ?? "";
  if (key.length !== 16) {
    console.error(
      `❌ ENCRYPTION_KEY must be exactly 16 characters (got ${key.length}). Table links cannot be encrypted.`
    );
    return null;
  }
  return Buffer.from(key, "utf8");
}

/** "D12" → URL-safe encrypted id, or null when no valid key is set. */
export function encryptTableId(tableNo: string): string | null {
  const table = String(tableNo ?? "").trim();
  const key = keyBuffer();
  if (!table || !key) return null;
  try {
    const cipher = crypto.createCipheriv("aes-128-cbc", key, IV);
    const encrypted = Buffer.concat([
      cipher.update(`${PREFIX}${table}`, "utf8"),
      cipher.final(),
    ]);
    return encrypted
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch (error) {
    console.error("❌ Table id encryption error:", error);
    return null;
  }
}

/** URL-safe encrypted id → "D12", or null when invalid/foreign. */
export function decryptTableId(id: string): string | null {
  const raw = String(id ?? "").trim();
  const key = keyBuffer();
  if (!raw || !key) return null;
  try {
    let base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, IV);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(base64, "base64")),
      decipher.final(),
    ]);
    const result = decrypted.toString("utf8");
    if (!result.startsWith(PREFIX)) return null; // not a table link
    const table = result.slice(PREFIX.length).trim();
    return table || null;
  } catch {
    return null; // bad padding / wrong key / tampered
  }
}
