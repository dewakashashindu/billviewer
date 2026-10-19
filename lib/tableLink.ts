// ============================================================
// LOCATION: lib/tableLink.ts
// Encrypted table identifier for customer QR links.
//
// The QR link carries ONLY an encrypted id:
//     /menu?id=<encrypted>
// Nothing readable is in the URL — no table number, no group.
//
// Plaintext format (v2):
//     "TBL:<tableGroup>\u001f<tableNo>"
//   e.g. "TBL:P/M 1\u001fPICK 5"
//
// The record separator (\u001f) can never appear in a POS name,
// so the two values survive the round-trip intact.
//
// v1 links ("TBL:<tableNo>") still decrypt — table number only,
// no group — so QRs printed with the old build keep working.
//
// The prefix stops a bill link id from being replayed as a table
// link (and vice versa). AES-128-CBC + the fixed IV used by the
// bill links, so the POS Windows service can mint these too.
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
/** Takeaway QR — the payload is just this prefix ("TAK:TA"). */
const TAKEAWAY_PREFIX = "TAK:";

/** Table number used for takeaway orders (Tbl_HoldUpsCloud.TabelNo). */
export const TAKEAWAY_TABLE_NO = "TA";
/** Unit separator — safe as a field delimiter (never in a table name). */
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
}

/**
 * "PICK 5" (+ group) → URL-safe encrypted id, or null when no
 * valid key is set.
 */
export function encryptTableId(
  tableNo: string,
  tableGroup: string = ""
): string | null {
  const table = String(tableNo ?? "").trim();
  const group = String(tableGroup ?? "").trim();
  const key = keyBuffer();
  if (!table || !key) return null;
  try {
    const cipher = crypto.createCipheriv("aes-128-cbc", key, IV);
    const plain = group
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
 * The single takeaway QR → URL-safe encrypted id ("TAK:TA"), or
 * null when ENCRYPTION_KEY is not configured.
 */
export function encryptTakeawayId(): string | null {
  const key = keyBuffer();
  if (!key) return null;
  try {
    const cipher = crypto.createCipheriv("aes-128-cbc", key, IV);
    const encrypted = Buffer.concat([
      cipher.update(`${TAKEAWAY_PREFIX}${TAKEAWAY_TABLE_NO}`, "utf8"),
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

/** URL-safe encrypted id → { kind, tableNo, tableGroup }, or null. */
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

    /* Takeaway QR — "TAK:TA" */
    if (result.startsWith(TAKEAWAY_PREFIX)) {
      const tableNo = result.slice(TAKEAWAY_PREFIX.length).trim() || TAKEAWAY_TABLE_NO;
      return { kind: "takeaway", tableNo, tableGroup: "" };
    }

    if (!result.startsWith(PREFIX)) return null; // not a table link

    const body = result.slice(PREFIX.length);
    const sep = body.indexOf(SEP);
    /* v2 — group + table */
    if (sep >= 0) {
      const tableGroup = body.slice(0, sep).trim();
      const tableNo = body.slice(sep + 1).trim();
      if (!tableNo) return null;
      return { kind: "table", tableNo, tableGroup };
    }
    /* v1 — table number only */
    const tableNo = body.trim();
    return tableNo ? { kind: "table", tableNo, tableGroup: "" } : null;
  } catch {
    return null; // bad padding / wrong key / tampered
  }
}

/** Backwards-compatible helper — returns just the table number. */
export function decryptTableId(id: string): string | null {
  return decryptTableLink(id)?.tableNo ?? null;
}
