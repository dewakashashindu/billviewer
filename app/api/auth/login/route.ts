// ============================================================
// LOCATION: app/api/auth/login/route.ts
// POST { loginName (or username), password } → session cookie set karanawa
// Verify: Tbl_UserDetails.LoginName + Password, Enable=1
// (Legacy LogName column eka use karanne naha — aluth LoginName witharai)
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import {
  verifyPassword,
  isAdminSession,
  SESSION_COOKIE,
} from "@/lib/auth";
import {clientIp} from "@/lib/rateLimit";
import {issueWebSession} from "@/lib/webSession";
import {authLimit} from "@/lib/sqlAuthSecurity";
import crypto from "crypto";
import {captureLoginAudit} from "@/lib/loginAudit";

/** Per-IP: how many login POSTs in the window (any outcome). */
const IP_LIMIT = 30;
/** Per-account attempts, including successful attempts, in the window. */
const FAIL_LIMIT = 5;
/** Both windows — 15 minutes. */
const WINDOW_MS = 15 * 60_000;

const INVALID = { success: false, error: "Invalid username or password" };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const loginName = String(body?.loginName ?? body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  try {
    const ip = clientIp(req.headers);
    const ipLimit = await authLimit(`login-ip:${ip}`, IP_LIMIT, WINDOW_MS / 1000);
    const accountLimit = loginName && loginName.length <= 50
      ? await authLimit(`login-account:${loginName.toLowerCase()}`, FAIL_LIMIT, WINDOW_MS / 1000)
      : {allowed:true,retryAfterSeconds:0};
    const blocked = !ipLimit.allowed ? ipLimit : !accountLimit.allowed ? accountLimit : null;
    if (blocked) return NextResponse.json({success:false,error:"Too many sign-in attempts. Please try again later."},{status:429,headers:{"Retry-After":String(blocked.retryAfterSeconds)}});
    if (!loginName || loginName.length > 50 || !password || password.length > 256) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
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
    request.input("loginName", sql.VarChar(50), loginName);
    const res = await request.query(`
      SELECT TOP 2
        LTRIM(RTRIM(u.UserId))    AS UserId,
        LTRIM(RTRIM(u.LoginNameWeb)) AS LoginName,
        ISNULL(NULLIF(LTRIM(RTRIM(u.UserName)), ''), LTRIM(RTRIM(u.LoginNameWeb))) AS UserName,
        LTRIM(RTRIM(ISNULL(u.GroupId, ''))) AS GroupId,
        u.PasswordWeb AS Password,
        u.Enable
      FROM Tbl_UserDetails u
      WHERE NULLIF(LTRIM(RTRIM(u.LoginNameWeb)), '') IS NOT NULL
        AND LTRIM(RTRIM(u.LoginNameWeb)) = @loginName
    `);

    const user = res.recordset[0];
    if (res.recordset.length !== 1 || !user || !user.Enable) { await captureLoginAudit(req.headers,{loginName,success:false,failReason:"Invalid credentials or disabled account"}); return NextResponse.json(INVALID, { status: 401 }); }
    if (!verifyPassword(password, String(user.Password ?? ""))) { await captureLoginAudit(req.headers,{loginName,userId:String(user.UserId),userName:String(user.UserName),success:false,failReason:"Invalid password"}); return NextResponse.json(INVALID, { status: 401 }); }


    const sessionPayload = {
      userId: String(user.UserId),
      loginName: String(user.LoginName),
      userName: String(user.UserName),
      groupId: String(user.GroupId ?? ""),
    };

    const token = await issueWebSession(sessionPayload, String(user.Password ?? ""));
    let defaultLocation: string | undefined;
    try { const locRes = await pool.request().input("uid", sql.Char(10), sessionPayload.userId).query("SELECT TOP 1 LTRIM(RTRIM(LocationID)) AS code FROM dbo.Tbl_UserLocationAccess WHERE UserID=@uid AND IsDefault=1"); defaultLocation = locRes.recordset[0]?.code ? String(locRes.recordset[0].code) : undefined; } catch { /* location is best-effort */ }
    await captureLoginAudit(req.headers,{loginName:sessionPayload.loginName,userId:sessionPayload.userId,userName:sessionPayload.userName,success:true,locationCode:defaultLocation,sessionRef:crypto.createHash("sha256").update(token).digest("hex")});

    const out = NextResponse.json({
      success: true,
      user: {
        userId: sessionPayload.userId,
        userName: sessionPayload.userName,
        loginName: sessionPayload.loginName,
        groupId: sessionPayload.groupId,
        isAdmin: isAdminSession(sessionPayload),
      },
    });
    out.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 3600,
    });
    return out;
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { success: false, error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
