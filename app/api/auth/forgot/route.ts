// ============================================================
// LOCATION: app/api/auth/forgot/route.ts
// POST { loginName } → OTP generate → SMS eken ContNo ta →
// stateless OTP token httpOnly cookie ekata (10 min)
// Lookup strictly uses Tbl_UserDetails.LoginName (never LogName).
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { createOtpToken, generateOtp, OTP_COOKIE } from "@/lib/auth";
import { sendSms, isSmsConfigured } from "@/lib/sms";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const HOUR_MS = 60 * 60_000;
const IP_LIMIT = 3; // per IP, per hour
const USER_LIMIT = 2; // per login name, per hour

/** The ONE response shape — identical for every outcome. */
const uniformResponse = () =>
  NextResponse.json({
    success: true,
    smsSent: isSmsConfigured(),
    message:
      "If an active account exists for that username, a verification code has been sent by SMS. It is valid for 10 minutes.",
  });

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);

  const ipLimit = rateLimit(`forgot-ip:${ip}`, IP_LIMIT, HOUR_MS);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please try again later.",
      },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const loginName = String(body?.loginName ?? body?.username ?? "").trim();
  if (!loginName) {
    return NextResponse.json(
      { success: false, error: "Username is required" },
      { status: 400 }
    );
  }

  const userLimit = rateLimit(
    `forgot-user:${loginName.toLowerCase()}`,
    USER_LIMIT,
    HOUR_MS
  );
  if (!userLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests for this username. Please try again later.",
      },
      { status: 429, headers: { "Retry-After": String(userLimit.retryAfterSeconds) } }
    );
  }

  try {
    if (!isDbConfigured()) {
      console.warn("Forgot password: DB_* env vars missing — nothing to look up");
      return uniformResponse();
    }

    const pool = await getPool();
    const request = pool.request();
    request.input("loginName", sql.VarChar(50), loginName);
    const res = await request.query(`
      SELECT TOP 1
        LTRIM(RTRIM(LoginName)) AS LoginName,
        LTRIM(RTRIM(ContNo))    AS ContNo
      FROM Tbl_UserDetails WITH (NOLOCK)
      WHERE NULLIF(LTRIM(RTRIM(LoginName)), '') IS NOT NULL
        AND LTRIM(RTRIM(LoginName)) = @loginName
        AND Enable = 1
    `);

    const user = res.recordset[0];
    if (!user) {
      console.warn(`Forgot password: no active account "${loginName}" — uniform 200`);
      return uniformResponse();
    }
    if (!user.ContNo) {
      console.warn(`Forgot password: "${loginName}" has no ContNo — uniform 200`);
      return uniformResponse();
    }

    const code = generateOtp();
    const sent = await sendSms(
      String(user.ContNo),
      `Mila Mirissa password reset code: ${code} (valid 10 minutes)`
    );
    if (!sent) {
      console.error(`Forgot password: SMS send FAILED for "${loginName}"`);
      return uniformResponse();
    }

    const out = uniformResponse();
    out.cookies.set(OTP_COOKIE, createOtpToken(String(user.LoginName), code), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
    return out;
  } catch (e) {
    console.error("Forgot password error:", e);
    return uniformResponse();
  }
}
