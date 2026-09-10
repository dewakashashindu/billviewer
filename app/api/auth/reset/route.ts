// ============================================================
// LOCATION: app/api/auth/reset/route.ts
// ALUTH FILE — mekamama create karanna
// POST { loginName, code, password } → OTP verify → Password column hash update
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import {
  verifyOtpToken,
  hashPassword,
  OTP_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { loginName, code, password } = await req.json();
    if (!loginName || !code || !password) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 }
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const otpToken = req.cookies.get(OTP_COOKIE)?.value;
    if (!otpToken || !verifyOtpToken(otpToken, String(loginName).trim(), String(code))) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired verification code" },
        { status: 401 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database not configured (DB_* env vars missing)" },
        { status: 500 }
      );
    }

    const pool = await getPool();
    const request = pool.request();
    request.input("loginName", sql.VarChar(50), String(loginName).trim());
    request.input("psw", sql.VarChar(400), hashPassword(String(password)));
    await request.query(`
      UPDATE Tbl_UserDetails
      SET Password = @psw
      WHERE LTRIM(RTRIM(LoginName)) = @loginName AND Enable = 1
    `);

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
