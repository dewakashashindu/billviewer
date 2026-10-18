// ============================================================
// LOCATION: lib/orderToken.ts
// Signed table token for the customer QR ordering flow.
//
// Why: the QR URL is public. Without a signature anyone could
// change ?table=05 to ?table=VIP-01 and order into another
// table's bill, or spam a table that does not exist.
//
// The token is an HMAC-SHA256 over "<tableNo>|<expiry>" using
// ORDER_TOKEN_SECRET (falls back to ENCRYPTION_KEY). The table
// number is inside the signed payload, so the server can check
// that the URL's table and the token's table are the same.
//
// Token shape:  base64url(payload) "." base64url(hmac)
// ============================================================
import crypto from "crypto";

/** QR stickers live for months — the token is valid for 14 days. */
export const TABLE_TOKEN_TTL_HOURS = 24 * 14;

const secret = () =>
  process.env.ORDER_TOKEN_SECRET || process.env.ENCRYPTION_KEY || "";

const b64url = (buf: Buffer) => buf.toString("base64url");

function hmac(payload: string): string {
  return b64url(
    crypto.createHmac("sha256", secret()).update(payload).digest()
  );
}

/**
 * Is a valid table token mandatory for this environment?
 * Production -> yes (the QR always carries one).
 * Development -> no, so the flow can be tested by hand.
 */
export function isTableTokenRequired(): boolean {
  const flag = (process.env.ORDER_REQUIRE_TOKEN ?? "").trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return process.env.NODE_ENV === "production";
}

/** Build the signed token for a table QR URL. */
export function signTableToken(
  tableNo: string,
  ttlHours: number = TABLE_TOKEN_TTL_HOURS
): string {
  const key = secret();
  if (!key) {
    console.warn(
      "⚠️ ORDER_TOKEN_SECRET / ENCRYPTION_KEY not set — table tokens cannot be signed"
    );
    return "";
  }
  const table = String(tableNo ?? "").trim();
  if (!table) return "";
  const exp = Date.now() + Math.max(1, ttlHours) * 3600_000;
  const payload = `${table}|${exp}`;
  return `${b64url(Buffer.from(payload, "utf8"))}.${hmac(payload)}`;
}

export type TokenCheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "malformed" | "mismatch" | "expired" | "unsigned" };

/**
 * Verify that `token` was signed for exactly this table number.
 * Timing-safe comparison, and the expiry is inside the signed
 * payload so it cannot be extended by the client.
 */
export function verifyTableToken(tableNo: string, token: string): TokenCheck {
  const table = String(tableNo ?? "").trim();
  const tok = String(token ?? "").trim();

  if (!table) return { ok: false, reason: "mismatch" };
  if (!tok) return { ok: false, reason: "missing" };
  if (!secret()) return { ok: false, reason: "unsigned" };

  const dot = tok.indexOf(".");
  if (dot <= 0 || dot === tok.length - 1) return { ok: false, reason: "malformed" };

  const body = tok.slice(0, dot);
  const sig = tok.slice(dot + 1);

  let payload: string;
  try {
    payload = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "malformed" };
  }

  const sep = payload.lastIndexOf("|");
  if (sep <= 0) return { ok: false, reason: "malformed" };
  const tokenTable = payload.slice(0, sep);
  const exp = Number(payload.slice(sep + 1));

  if (tokenTable !== table) return { ok: false, reason: "mismatch" };
  if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true };
}

/**
 * Guard used by the public ordering APIs.
 * Returns null when the request may continue, or an error message.
 */
export function checkTableAccess(
  tableNo: string,
  token: string
): { ok: true } | { ok: false; error: string; status: number } {
  const check = verifyTableToken(tableNo, token);

  if (check.ok) return { ok: true };

  if (check.reason === "missing" && !isTableTokenRequired()) {
    // Development convenience — log it, but let the flow work.
    console.warn(
      "⚠️ Order request without a table token (dev mode). Set ORDER_REQUIRE_TOKEN=true in production."
    );
    return { ok: true };
  }

  switch (check.reason) {
    case "missing":
      return {
        ok: false,
        status: 403,
        error: "This link is missing its table code. Please scan the QR code on your table.",
      };
    case "expired":
      return {
        ok: false,
        status: 403,
        error: "This QR code has expired. Please ask our team for a fresh one.",
      };
    case "mismatch":
      return {
        ok: false,
        status: 403,
        error: "This QR code does not match the table. Please scan the table QR again.",
      };
    default:
      return {
        ok: false,
        status: 403,
        error: "This QR code could not be verified. Please scan it again.",
      };
  }
}
