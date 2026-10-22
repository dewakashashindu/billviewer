// ============================================================
// LOCATION: app/api/admin/users/update/route.ts
// POST { userId, action: "toggle" | "reset", password? }
//   toggle — Enable 0/1 (Admin only, cannot disable own account)
//   reset  — Password column ekata aluth scrypt hash
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import {
  verifySessionValue,
  hashPassword,
  isAdminSession,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionValue(token) : null;
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Not logged in" },
      { status: 401 }
    );
  }

  let groupId = session.groupId ?? "";
  if (!groupId && isDbConfigured()) {
    try {
      const pool = await getPool();
      const r = await pool
        .request()
        .input("uid", sql.Char(10), String(session.userId))
        .query(`
          SELECT TOP 1 LTRIM(RTRIM(ISNULL(GroupId, ''))) AS GroupId
          FROM Tbl_UserDetails WITH (NOLOCK)
          WHERE LTRIM(RTRIM(UserId)) = LTRIM(RTRIM(@uid))
        `);
      if (r.recordset[0]) groupId = String(r.recordset[0].GroupId ?? "");
    } catch {
      /* ignore */
    }
  }

  if (!isAdminSession({ ...session, groupId })) {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
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
      if (
        String(userId).trim().toUpperCase() ===
        String(session.userId).trim().toUpperCase()
      ) {
        return NextResponse.json(
          { success: false, error: "You cannot disable your own account" },
          { status: 400 }
        );
      }
      const req2 = pool.request();
      req2.input("userId", sql.Char(10), String(userId).trim());
      await req2.query(`
        UPDATE Tbl_UserDetails
        SET Enable = CASE WHEN Enable = 1 THEN 0 ELSE 1 END
        WHERE LTRIM(RTRIM(UserId)) = LTRIM(RTRIM(@userId))
      `);
      return NextResponse.json({ success: true });
    }

    if (action === "reset") {
      if (!password || String(password).length < 4) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 4 characters" },
          { status: 400 }
        );
      }
      const req2 = pool.request();
      req2.input("userId", sql.Char(10), String(userId).trim());
      req2.input("psw", sql.VarChar(400), hashPassword(String(password)));
      await req2.query(`
        UPDATE Tbl_UserDetails
        SET Password = @psw
        WHERE LTRIM(RTRIM(UserId)) = LTRIM(RTRIM(@userId))
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
