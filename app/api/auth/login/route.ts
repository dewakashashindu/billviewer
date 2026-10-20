// ============================================================
// LOCATION: app/api/auth/login/route.ts
// ALUTH FILE — mekamama create karanna
// POST { loginName, password } → session cookie set karanawa
// Verify: Tbl_UserDetails.LoginName + Password (scrypt hash), Enable=1
//
// BRUTE-FORCE PROTECTION (2 layers, lib/rateLimit.ts):
//   1. per-IP       — 30 attempts / 15 min  → 429
//   2. per-account  — 5 FAILED attempts / 15 min → account locked 429
//      (successful login eken counter eka reset wenawa)
// Layer 2 eka failures witharak count karanne — horu attempt 5k
// passe login name eka hari unath 15 min lock. Message eka
// "invalid login name or password" ekama — account ekak thiyenawada
// kiyala penwanne naha.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import {
  verifyPassword,
  createSessionValue,
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

const INVALID = { success: false, error: "Invalid login name or password" };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const loginName = String(body?.loginName ?? "").trim();
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

  /* Per-source lock — checked before any DB work so a locked
     source cannot hammer the database either.

     Keyed by IP **and** login name on purpose: a global per-account
     lock would let anyone lock a real manager out by typing 5 wrong
     passwords for their login name. The per-IP bucket above caps the
     total guessing one source can do across all accounts. */
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
    if (!loginName || !password) {
      return NextResponse.json(
        { success: false, error: "Login name and password are required" },
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
      SELECT TOP 1
        LTRIM(RTRIM(u.UserId))   AS UserId,
        LTRIM(RTRIM(u.LoginName)) AS LoginName,
        ISNULL(NULLIF(LTRIM(RTRIM(u.UserName)), ''), LTRIM(RTRIM(u.LoginName))) AS UserName,
        u.Password,
        u.Enable
      FROM Tbl_UserDetails u WITH (NOLOCK)
      WHERE LTRIM(RTRIM(u.LoginName)) = @loginName
    `);

    const user = res.recordset[0];
    if (!user || !user.Enable) return fail();
    if (!verifyPassword(password, String(user.Password ?? ""))) return fail();

    /* Success — clear the failure counter for this account. */
    resetKey(failKey);

    const token = createSessionValue({
      userId: String(user.UserId),
      loginName: String(user.LoginName),
      userName: String(user.UserName),
    });

    const out = NextResponse.json({
      success: true,
      user: { userName: String(user.UserName), loginName: String(user.LoginName) },
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
