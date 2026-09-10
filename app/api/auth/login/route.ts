// ============================================================
// LOCATION: app/api/auth/login/route.ts
// ALUTH FILE — mekamama create karanna
// POST { loginName, password } → session cookie set karanawa
// Verify: Tbl_UserDetails.LoginName + Password (scrypt hash), Enable=1
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import {
  verifyPassword,
  createSessionValue,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { loginName, password } = await req.json();
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
    request.input("loginName", sql.VarChar(50), String(loginName).trim());
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
    if (!user || !user.Enable) {
      return NextResponse.json(
        { success: false, error: "Invalid login name or password" },
        { status: 401 }
      );
    }

    if (!verifyPassword(String(password), String(user.Password ?? ""))) {
      return NextResponse.json(
        { success: false, error: "Invalid login name or password" },
        { status: 401 }
      );
    }

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
