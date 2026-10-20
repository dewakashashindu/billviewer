// ============================================================
// LOCATION: app/api/auth/reset/route.ts
// ALUTH FILE — mekamama create karanna
// POST { loginName, code, password } → OTP verify → Password column hash update
//
// HARDENING — OTP brute force / account takeover block
// The OTP is a 6-digit code with a 10-minute life, and the cookie
// is handed to WHOEVER called /api/auth/forgot (the SMS goes to the
// real user's phone). So without an attempt limit an attacker could
// simply guess the code: 10^6 combos inside 10 minutes.
//
//   1. per IP+loginName → 5 WRONG codes / 10 min, then 429
//      ("request a new code")
//   2. an OTP that verified successfully is CONSUMED server-side —
//      replaying the same cookie value again fails, even though the
//      cookie is only cleared on the client.
//   3. counters reset when a code verifies, so a real user who
//      mistypes once is not punished.
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
  const loginName = String(body?.loginName ?? "").trim();
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

  /* 2) already-consumed OTP → reject before doing any work. */
  if (!tooMany(usedKey, 1, WINDOW_MS).allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "This verification code has already been used. Please request a new one.",
      },
      { status: 401 }
    );
  }

  /* 1) too many wrong guesses for this code → 429, ask for a new one. */
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
    registerHit(guessKey, WINDOW_MS); // count the wrong guess
    return NextResponse.json(
      { success: false, error: "Invalid or expired verification code" },
      { status: 401 }
    );
  }

  /* Code is correct — clear the guess counter and consume the OTP. */
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
      WHERE LTRIM(RTRIM(LoginName)) = @loginName AND Enable = 1
    `);

    /* No row updated = unknown/disabled login name. The OTP was still
       consumed above, so it cannot be replayed against another name. */
    if ((res.rowsAffected?.[0] ?? 0) === 0) {
      console.warn(`Password reset: no active account "${loginName}"`);
      return NextResponse.json(
        { success: false, error: "Reset failed. Please try again." },
        { status: 401 }
      );
    }

    const out = NextResponse.json({ success: true });
    // otp cookie clear — session cookie witharak (reset wela session ekuth clear)
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
