// ============================================================
// LOCATION: app/api/auth/reset/route.ts
// POST { loginName, code, password } → OTP verify → Password column hash update
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import {
  verifyOtpToken,
  hashPassword,
  OTP_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth";
import { tooMany, registerHit, resetKey, clientIp } from "@/lib/rateLimit";

/** Same lifetime as the OTP cookie — 10 minutes. */
const WINDOW_MS = 10 * 60_000;
/** How many wrong codes one source may try per OTP. */
const GUESS_LIMIT = 5;

const tokenFingerprint = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const loginName = String(body?.loginName ?? body?.username ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const password = String(body?.password ?? "");

  if (!loginName || !code || !password) {
    return NextResponse.json(
      { success: false, error: "All fields are required" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { success: false, error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const otpToken = req.cookies.get(OTP_COOKIE)?.value ?? "";
  if (!otpToken) {
    return NextResponse.json(
      { success: false, error: "Invalid or expired verification code" },
      { status: 401 }
    );
  }

  const ip = clientIp(req.headers);
  const guessKey = `otp-guess:${ip}:${loginName.toLowerCase()}`;
  const usedKey = `otp-used:${tokenFingerprint(otpToken)}`;

  if (!tooMany(usedKey, 1, WINDOW_MS).allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "This verification code has already been used. Please request a new one.",
      },
      { status: 401 }
    );
  }

  const guesses = tooMany(guessKey, GUESS_LIMIT, WINDOW_MS);
  if (!guesses.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Too many incorrect codes. Please request a new verification code.",
      },
      { status: 429, headers: { "Retry-After": String(guesses.retryAfterSeconds) } }
    );
  }

  if (!verifyOtpToken(otpToken, loginName, code)) {
    registerHit(guessKey, WINDOW_MS);
    return NextResponse.json(
      { success: false, error: "Invalid or expired verification code" },
      { status: 401 }
    );
  }

  resetKey(guessKey);
  registerHit(usedKey, WINDOW_MS);

  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database not configured (DB_* env vars missing)" },
        { status: 500 }
      );
    }

    const pool = await getPool();
    const request = pool.request();
    request.input("loginName", sql.VarChar(50), loginName);
    request.input("psw", sql.VarChar(400), hashPassword(password));
    const res = await request.query(`
      UPDATE Tbl_UserDetails
      SET Password = @psw
      WHERE NULLIF(LTRIM(RTRIM(LoginName)), '') IS NOT NULL
        AND LTRIM(RTRIM(LoginName)) = @loginName
        AND Enable = 1
    `);

    if ((res.rowsAffected?.[0] ?? 0) === 0) {
      console.warn(`Password reset: no active account "${loginName}"`);
      return NextResponse.json(
        { success: false, error: "Reset failed. Please try again." },
        { status: 401 }
      );
    }

    const out = NextResponse.json({ success: true });
    out.cookies.set(OTP_COOKIE, "", { path: "/", maxAge: 0 });
    out.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return out;
  } catch (e) {
    console.error("Reset password error:", e);
    return NextResponse.json(
      { success: false, error: "Reset failed. Please try again." },
      { status: 500 }
    );
  }
}
