// ============================================================
// LOCATION: lib/tableLink.ts
// Encrypted table identifier for customer QR links.
//
// The QR link carries ONLY an encrypted id:
//     /menu?id=<encrypted>
// Nothing readable is in the URL — no table number, no group,
// no location code.
//
// Plaintext formats:
//   v3 (table):    "TBL:<tableGroup>\u001f<tableNo>\u001f<locCode>"
//   v2 (table):    "TBL:<tableGroup>\u001f<tableNo>"
//   v1 (table):    "TBL:<tableNo>"
//   v2 (takeaway): "TAK:TA\u001f<locCode>"
//   v1 (takeaway): "TAK:TA"
//
// Older printed QRs (v1 / v2) continue to decrypt cleanly.
// Server-only — the key must never reach the browser.
// ============================================================
import crypto from "crypto";

/* fixed IV — same scheme as the /api/bill decrypt route */
const IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
]);

const PREFIX = "TBL:";
/** Takeaway QR — "TAK:TA" or "TAK:TA\u001f<locCode>". */
const TAKEAWAY_PREFIX = "TAK:";

/** Table number used for takeaway QR links. */
export const TAKEAWAY_TABLE_NO = "TA";
/** Unit separator — safe as a field delimiter (never in a POS code/name). */
const SEP = "\u001f";

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

export interface TableLinkPayload {
  /** "table" = dine-in table QR · "takeaway" = the single TA QR */
  kind: "table" | "takeaway";
  /** Tbl_Tables.TableNo ("TA" for takeaway) */
  tableNo: string;
  /** Tbl_Tables.TableGroup (the group id as stored in the POS) */
  tableGroup: string;
  /** Tbl_LocationMaster.LocCode selected when the QR was created */
  locCode: string;
}

/**
 * "PICK 5" (+ group + locCode) → URL-safe encrypted id, or null when no
 * valid key is set.
 */
export function encryptTableId(
  tableNo: string,
  tableGroup: string = "",
  locCode: string = ""
): string | null {
  const table = String(tableNo ?? "").trim();
  const group = String(tableGroup ?? "").trim();
  const loc = String(locCode ?? "").trim();
  const key = keyBuffer();
  if (!table || !key) return null;
  try {
    const cipher = crypto.createCipheriv("aes-128-cbc", key, IV);
    const plain = loc
      ? `${PREFIX}${group}${SEP}${table}${SEP}${loc}`
      : group
        ? `${PREFIX}${group}${SEP}${table}`
        : `${PREFIX}${table}`;
    const encrypted = Buffer.concat([
      cipher.update(plain, "utf8"),
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

/**
 * The takeaway QR (+ optional locCode) → URL-safe encrypted id, or
 * null when ENCRYPTION_KEY is not configured.
 */
export function encryptTakeawayId(locCode: string = ""): string | null {
  const loc = String(locCode ?? "").trim();
  const key = keyBuffer();
  if (!key) return null;
  try {
    const cipher = crypto.createCipheriv("aes-128-cbc", key, IV);
    const plain = loc
      ? `${TAKEAWAY_PREFIX}${TAKEAWAY_TABLE_NO}${SEP}${loc}`
      : `${TAKEAWAY_PREFIX}${TAKEAWAY_TABLE_NO}`;
    const encrypted = Buffer.concat([
      cipher.update(plain, "utf8"),
      cipher.final(),
    ]);
    return encrypted
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch (error) {
    console.error("❌ Takeaway id encryption error:", error);
    return null;
  }
}

/** URL-safe encrypted id → { kind, tableNo, tableGroup, locCode }, or null. */
export function decryptTableLink(id: string): TableLinkPayload | null {
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

    /* Takeaway QR — "TAK:TA" or "TAK:TA\u001f<locCode>" */
    if (result.startsWith(TAKEAWAY_PREFIX)) {
      const body = result.slice(TAKEAWAY_PREFIX.length);
      const parts = body.split(SEP);
      const tableNo = (parts[0] ?? "").trim() || TAKEAWAY_TABLE_NO;
      const locCode = (parts[1] ?? "").trim();
      return { kind: "takeaway", tableNo, tableGroup: "", locCode };
    }

    if (!result.startsWith(PREFIX)) return null; // not a table link

    const body = result.slice(PREFIX.length);
    const parts = body.split(SEP);
    /* v3 — group + table + locCode */
    if (parts.length >= 3) {
      const tableGroup = (parts[0] ?? "").trim();
      const tableNo = (parts[1] ?? "").trim();
      const locCode = (parts[2] ?? "").trim();
      if (!tableNo) return null;
      return { kind: "table", tableNo, tableGroup, locCode };
    }
    /* v2 — group + table */
    if (parts.length === 2) {
      const tableGroup = (parts[0] ?? "").trim();
      const tableNo = (parts[1] ?? "").trim();
      if (!tableNo) return null;
      return { kind: "table", tableNo, tableGroup, locCode: "" };
    }
    /* v1 — table number only */
    const tableNo = body.trim();
    return tableNo ? { kind: "table", tableNo, tableGroup: "", locCode: "" } : null;
  } catch {
    return null; // bad padding / wrong key / tampered
  }
}

/** Backwards-compatible helper — returns just the table number. */
export function decryptTableId(id: string): string | null {
  return decryptTableLink(id)?.tableNo ?? null;
}
