// ============================================================
// LOCATION: lib/auth.ts
// Auth helpers (SERVER ONLY — node:crypto):
//   • Login verification — Tbl_UserDetails.LoginName + Password
//   • Password hashing   — scrypt + random salt (DB Password column)
//     format: "scrypt$<salthex>$<hashhex>"
//   • Session cookie     — HMAC-SHA256 signed
//     format: base64url(payload).hmac
// POS eke legacy "LogName" / "PSW" columns KEWAT TOUCH KARANNE NAHA —
// web auth eka "LoginName" saha "Password" columns witharak use karanawa.
// ============================================================
import crypto from "crypto";

export const SESSION_COOKIE = "mcf_session";
export const OTP_COOKIE = "mcf_otp";

export const UNAUTHORIZED_ERROR = "UNAUTHORIZED";
const SESSION_DAYS = 7;
const OTP_MINUTES = 10;

/** Session cookie signing secret. */
const SESSION_SECRET = () =>
  process.env.SESSION_SECRET ||
  process.env.ENCRYPTION_KEY ||
  "MySecretKey12345";

/** Password-reset OTP signing secret (own var, same fallback chain). */
const OTP_SECRET = () => process.env.OTP_SECRET || SESSION_SECRET();

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64url");

const hmac = (data: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(data).digest("base64url");

// ── Password hashing & verification ──
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const raw = String(stored ?? "").trim();
  if (!password || !raw) return false;

  // Standard web format: scrypt$<saltHex>$<hashHex>
  if (raw.startsWith("scrypt$")) {
    const parts = raw.split("$");
    if (parts.length !== 3) return false;
    try {
      const salt = Buffer.from(parts[1], "hex");
      const expected = Buffer.from(parts[2], "hex");
      const actual = crypto.scryptSync(password, salt, 64);
      return (
        actual.length === expected.length &&
        crypto.timingSafeEqual(actual, expected)
      );
    } catch {
      return false;
    }
  }

  // Fallback for accounts whose Password column was populated directly in SQL
  const a = Buffer.from(password, "utf8");
  const b = Buffer.from(raw, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Session cookie (signed) ──
export interface SessionUser {
  userId: string;
  loginName: string;
  userName: string;
  groupId?: string;
  exp: number; // epoch seconds
}

/** Check whether a session user has Admin privileges. */
export function isAdminSession(
  u:
    | Pick<SessionUser, "userId" | "loginName" | "groupId">
    | null
    | undefined
): boolean {
  if (!u) return false;
  const grp = String(u.groupId ?? "").trim().toUpperCase();
  const uid = String(u.userId ?? "").trim().toUpperCase();
  const login = String(u.loginName ?? "").trim().toLowerCase();
  return (
    grp === "ADMIN" ||
    grp === "ADMINISTRATOR" ||
    uid === "UADMIN" ||
    login === "admin"
  );
}

export function createSessionValue(u: Omit<SessionUser, "exp">): string {
  const payload: SessionUser = {
    ...u,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 3600,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body, SESSION_SECRET())}`;
}

export function verifySessionValue(value: string): SessionUser | null {
  const [body, sig] = String(value || "").split(".");
  if (!body || !sig) return null;
  const expected = hmac(body, SESSION_SECRET());
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionUser;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000))
      return null;
    return payload;
  } catch {
    return null;
  }
}

// ── OTP token (stateless — cookie eke HMAC witharai) ──
export function createOtpToken(loginName: string, code: string): string {
  const exp = Math.floor(Date.now() / 1000) + OTP_MINUTES * 60;
  const sig = hmac(`otp|${loginName}|${code}|${exp}`, OTP_SECRET());
  return `${exp}.${sig}`;
}

export function verifyOtpToken(
  token: string,
  loginName: string,
  code: string
): boolean {
  const [expStr, sig] = String(token || "").split(".");
  const exp = Number(expStr);
  if (!exp || exp < Math.floor(Date.now() / 1000) || !sig) return false;
  const expected = hmac(`otp|${loginName}|${code}|${exp}`, OTP_SECRET());
  return (
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  );
}

// ── generate 6-digit OTP ──
export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}
