// ============================================================
// LOCATION: app/api/admin/users/route.ts
// GET    — web users list (Admin session required)
// POST   — create new user (Username -> LoginName, Password -> Password)
//          Legacy POS "LogName" & "PSW" columns are left empty ''.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { ensureLoginNameColumn } from "@/lib/userSchema";
import {
  verifySessionValue,
  hashPassword,
  isAdminSession,
  SESSION_COOKIE,
  type SessionUser,
} from "@/lib/auth";

async function requireAdmin(
  req: NextRequest
): Promise<
  | { ok: true; session: SessionUser }
  | { ok: false; status: number; error: string }
> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionValue(token) : null;
  if (!session) {
    return { ok: false, status: 401, error: "Not logged in" };
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
      /* ignore lookup error */
    }
  }

  const enriched = { ...session, groupId };
  if (!isAdminSession(enriched)) {
    return { ok: false, status: 403, error: "Admin access required" };
  }
  return { ok: true, session: enriched };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database not configured (DB_* env vars missing)" },
        { status: 500 }
      );
    }
    const pool = await getPool();
    await ensureLoginNameColumn(pool);

    const res = await pool.request().query(`
      SELECT
        LTRIM(RTRIM(UserId))    AS UserId,
        LTRIM(RTRIM(LoginName)) AS LoginName,
        ISNULL(NULLIF(LTRIM(RTRIM(UserName)), ''), LTRIM(RTRIM(LoginName))) AS UserName,
        LTRIM(RTRIM(ISNULL(GroupId, 'USER'))) AS GroupId,
        LTRIM(RTRIM(ISNULL(LOCCODE, '')))     AS LocCode,
        LTRIM(RTRIM(ISNULL(ContNo, '')))      AS ContNo,
        LTRIM(RTRIM(ISNULL(Email, '')))       AS Email,
        Enable
      FROM Tbl_UserDetails WITH (NOLOCK)
      WHERE NULLIF(LTRIM(RTRIM(LoginName)), '') IS NOT NULL
      ORDER BY
        CASE WHEN UPPER(LTRIM(RTRIM(ISNULL(GroupId, '')))) = 'ADMIN'
               OR UPPER(LTRIM(RTRIM(UserId))) = 'UADMIN'
             THEN 0 ELSE 1 END,
        LoginName;
    `);
    return NextResponse.json({ success: true, data: res.recordset });
  } catch (e) {
    console.error("Users list error:", e);
    return NextResponse.json(
      { success: false, error: "Database Data Fetching Failed." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database not configured (DB_* env vars missing)" },
        { status: 500 }
      );
    }

    const b = await req.json().catch(() => ({}));
    const loginName = String(b?.username ?? b?.loginName ?? "").trim();
    const password = String(b?.password ?? "");
    const userName = String(b?.userName ?? "").trim() || loginName;
    const nic = String(b?.nic ?? "").trim() || "N/A";
    const contNo = String(b?.contNo ?? "").trim();
    const email = String(b?.email ?? "").trim();
    const rawGroup = String(b?.groupId ?? "USER").trim().toUpperCase() || "USER";
    const groupId = rawGroup.slice(0, 10);
    const locCode = String(b?.locCode ?? "").trim().slice(0, 10);
    const dob = String(b?.dob ?? "").trim() || "1980-01-01";
    const doj =
      String(b?.doj ?? "").trim() || new Date().toISOString().split("T")[0];

    if (!loginName || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }
    if (loginName.length > 50) {
      return NextResponse.json(
        { success: false, error: "Username must be 50 characters or fewer" },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await ensureLoginNameColumn(pool);

    // LoginName unique check
    const dupReq = pool.request();
    dupReq.input("loginName", sql.VarChar(50), loginName);
    const dup = await dupReq.query(`
      SELECT TOP 1 1
      FROM Tbl_UserDetails WITH (NOLOCK)
      WHERE LOWER(LTRIM(RTRIM(LoginName))) = LOWER(@loginName)
    `);
    if (dup.recordset.length > 0) {
      return NextResponse.json(
        { success: false, error: "That username is already taken" },
        { status: 409 }
      );
    }

    // UserId — 'U' + base36 timestamp (<= 10 chars), collision check
    let userId = `U${Date.now().toString(36).toUpperCase()}`.slice(0, 10);
    for (let i = 0; i < 5; i++) {
      const chk = await pool
        .request()
        .input("uid", sql.Char(10), userId)
        .query(`SELECT TOP 1 1 FROM Tbl_UserDetails WHERE UserId = @uid`);
      if (chk.recordset.length === 0) break;
      userId = `U${Date.now().toString(36).toUpperCase()}${i}`.slice(0, 10);
    }

    const ins = pool.request();
    ins.input("userId", sql.Char(10), userId);
    ins.input("nic", sql.VarChar(20), nic.slice(0, 20));
    ins.input("loginName", sql.VarChar(50), loginName);
    ins.input("psw", sql.VarChar(400), hashPassword(password));
    ins.input("groupId", sql.Char(10), groupId);
    ins.input("userName", sql.VarChar(200), userName.slice(0, 200));
    ins.input("contNo", sql.VarChar(100), contNo.slice(0, 100));
    ins.input("email", sql.VarChar(100), email.slice(0, 100));
    ins.input("dob", sql.DateTime, new Date(dob));
    ins.input("doj", sql.DateTime, new Date(doj));
    ins.input("createUser", sql.Char(10), auth.session.userId.slice(0, 10));
    ins.input("locCode", sql.Char(10), locCode);

    // Note: LogName and PSW are left empty '' — Username goes strictly into LoginName,
    // and hashed Password goes into Password.
    await ins.query(`
      INSERT INTO Tbl_UserDetails
        (UserId, NIC, LogName, PSW, LoginName, Password, GroupId, UserName,
         Rmks, Add1, Add2, Add3, Add4, ContNo, Email, DOB, DOJ, DOL,
         CreateUser, Picture, Enable, LOCCODE)
      VALUES
        (@userId, @nic, '', '', @loginName, @psw, @groupId, @userName,
         '', '', '', '', '', @contNo, @email, @dob, @doj, '1900-01-01',
         @createUser, NULL, 1, @locCode)
    `);

    return NextResponse.json({
      success: true,
      userId,
      loginName,
    });
  } catch (e) {
    console.error("Create user error:", e);
    return NextResponse.json(
      { success: false, error: "Failed to create user." },
      { status: 500 }
    );
  }
}
