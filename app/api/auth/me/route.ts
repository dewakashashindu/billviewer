// ============================================================
// LOCATION: app/api/auth/me/route.ts
// GET — session eken logged-in user info (client components ata)
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { verifySessionValue, isAdminSession, SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? verifySessionValue(token) : null;
  if (!user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let groupId = user.groupId ?? "";
  if (!groupId && isDbConfigured()) {
    try {
      const pool = await getPool();
      const r = await pool
        .request()
        .input("uid", sql.Char(10), String(user.userId))
        .query(`
          SELECT TOP 1 LTRIM(RTRIM(ISNULL(GroupId, ''))) AS GroupId
          FROM Tbl_UserDetails WITH (NOLOCK)
          WHERE LTRIM(RTRIM(UserId)) = LTRIM(RTRIM(@uid))
        `);
      if (r.recordset[0]) groupId = String(r.recordset[0].GroupId ?? "");
    } catch {
      /* ignore DB fallback error */
    }
  }

  const info = {
    userId: user.userId,
    loginName: user.loginName,
    userName: user.userName,
    groupId,
    isAdmin: isAdminSession({ ...user, groupId }),
  };

  return NextResponse.json({
    success: true,
    user: info,
    data: info,
  });
}
