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
  createSessionValue,
  isAdminSession,
  SESSION_COOKIE,
} from "@/lib/auth";
import {
  rateLimit,
  tooMany,
  registerHit,
  resetKey,
  clientIp,
} from "@/lib/rateLimit";

/** Per-IP: how many login POSTs in the window (any outcome). */
const IP_LIMIT = 30;
/** Per-account: how many FAILED logins before a temporary lock. */
const FAIL_LIMIT = 5;
/** Both windows — 15 minutes. */
const WINDOW_MS = 15 * 60_000;

const INVALID = { success: false, error: "Invalid username or password" };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const loginName = String(body?.loginName ?? body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  const ip = clientIp(req.headers);
  const ipLimit = rateLimit(`login-ip:${ip}`, IP_LIMIT, WINDOW_MS);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many sign-in attempts. Please try again later.",
      },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  const failKey = `login-fail:${ip}:${loginName.toLowerCase()}`;
  const locked = tooMany(failKey, FAIL_LIMIT, WINDOW_MS);
  if (!locked.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many failed sign-in attempts. Please try again later.",
      },
      { status: 429, headers: { "Retry-After": String(locked.retryAfterSeconds) } }
    );
  }

  /** Count this as a failed attempt (used by every 401 path). */
  const fail = () => {
    registerHit(failKey, WINDOW_MS);
    return NextResponse.json(INVALID, { status: 401 });
  };

  try {
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
    if (res.recordset.length !== 1 || !user || !user.Enable) return fail();
    if (!verifyPassword(password, String(user.Password ?? ""))) return fail();

    /* Success — clear the failure counter for this account. */
    resetKey(failKey);

    const sessionPayload = {
      userId: String(user.UserId),
      loginName: String(user.LoginName),
      userName: String(user.UserName),
      groupId: String(user.GroupId ?? ""),
    };

    const token = createSessionValue(sessionPayload);

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
      maxAge: 7 * 24 * 3600,
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
