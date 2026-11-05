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
  if (loginName.length > 50 || password.length > 256 || password.length < 6) {
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

  let tx: sql.Transaction | undefined;
  try {
    if (!isDbConfigured()) return NextResponse.json({ success:false,error:"Database not configured" }, {status:503});
    tx = new sql.Transaction(await getPool());
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const users = await new sql.Request(tx).input("loginName",sql.VarChar(50),loginName).query(`
      SELECT TOP 2 LTRIM(RTRIM(LoginNameWeb)) AS LoginName,
        LTRIM(RTRIM(LOCCODE)) AS LocCode,LTRIM(RTRIM(UserId)) AS UserId,Enable
      FROM dbo.Tbl_UserDetails WITH (UPDLOCK,HOLDLOCK)
      WHERE NULLIF(LTRIM(RTRIM(LoginNameWeb)), '') IS NOT NULL
        AND LTRIM(RTRIM(LoginNameWeb))=@loginName
    `);
    const user=users.recordset[0];
    const identity=user?`${String(user.LoginName).toLowerCase()}|${String(user.LocCode).toLowerCase()}|${String(user.UserId).toLowerCase()}`:'';
    if(users.recordset.length!==1 || !user?.Enable || !verifyOtpToken(otpToken,identity,code)){
      await tx.rollback(); tx=undefined;registerHit(guessKey,WINDOW_MS);
      return NextResponse.json({success:false,error:"Invalid or expired verification code"},{status:401});
    }
    resetKey(guessKey);
    registerHit(usedKey,WINDOW_MS);
    const result=await new sql.Request(tx).input("loc",sql.Char(10),user.LocCode).input("id",sql.Char(10),user.UserId).input("loginName",sql.VarChar(50),user.LoginName).input("psw",sql.VarChar(255),hashPassword(password)).query(`
      UPDATE dbo.Tbl_UserDetails SET PasswordWeb=@psw
      WHERE LOCCODE=@loc AND UserId=@id AND LTRIM(RTRIM(LoginNameWeb))=@loginName AND Enable=1
    `);
    if(result.rowsAffected[0]!==1){await tx.rollback();tx=undefined;return NextResponse.json({success:false,error:"Reset failed. Please try again."},{status:409})}
    await tx.commit();tx=undefined;

    const out = NextResponse.json({ success: true });
    out.cookies.set(OTP_COOKIE, "", { path: "/", maxAge: 0 });
    out.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return out;
  } catch (e) {
    if(tx)try{await tx.rollback()}catch{}
    console.error("Reset password error:", e);
    return NextResponse.json(
      { success: false, error: "Reset failed. Please try again." },
      { status: 500 }
    );
  }
}
