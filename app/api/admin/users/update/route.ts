// ============================================================
// LOCATION: app/api/admin/users/update/route.ts
// ALUTH FILE — mekamama create karanna
// POST { userId, action: "toggle" | "reset", password? }
//   toggle — Enable 0/1 (thawa user kenekta witharak)
//   reset  — Password column ekata aluth scrypt hash
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { verifySessionValue, hashPassword, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = (() => {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    return token ? verifySessionValue(token) : null;
  })();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database not configured (DB_* env vars missing)" },
        { status: 500 }
      );
    }

    const { userId, action, password } = await req.json();
    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: "userId and action are required" },
        { status: 400 }
      );
    }

    const pool = await getPool();

    if (action === "toggle") {
      if (String(userId).toUpperCase() === String(session.userId).toUpperCase()) {
        return NextResponse.json(
          { success: false, error: "You cannot disable your own account" },
          { status: 400 }
        );
      }
      const req2 = pool.request();
      req2.input("userId", sql.Char(10), String(userId));
      await req2.query(`
        UPDATE Tbl_UserDetails
        SET Enable = CASE WHEN Enable = 1 THEN 0 ELSE 1 END
        WHERE UserId = @userId
      `);
      return NextResponse.json({ success: true });
    }

    if (action === "reset") {
      if (!password || String(password).length < 6) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      const req2 = pool.request();
      req2.input("userId", sql.Char(10), String(userId));
      req2.input("psw", sql.VarChar(400), hashPassword(String(password)));
      await req2.query(`
        UPDATE Tbl_UserDetails
        SET Password = @psw
        WHERE UserId = @userId
      `);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (e) {
    console.error("Update user error:", e);
    return NextResponse.json(
      { success: false, error: "Failed to update user." },
      { status: 500 }
    );
  }
}
