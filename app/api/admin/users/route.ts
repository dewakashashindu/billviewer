// ============================================================
// LOCATION: app/api/admin/users/route.ts
// ALUTH FILE — mekamama create karanna
// GET    — users list (session one)
// POST   — aluth user create (Tbl_UserDetails — okkoma NOT NULL
//          columns fill: NIC/GroupId/Rmks/Add1-4/DOB/DOJ/DOL/...)
// Password "Password" column ekata scrypt hash — legacy "PSW" untouched
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { verifySessionValue, hashPassword, SESSION_COOKIE } from "@/lib/auth";

function requireSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySessionValue(token) : null;
}

export async function GET(req: NextRequest) {
  const session = requireSession(req);
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
    const pool = await getPool();
    const res = await pool.request().query(`
      SELECT
        LTRIM(RTRIM(UserId))   AS UserId,
        LTRIM(RTRIM(LoginName)) AS LoginName,
        LTRIM(RTRIM(UserName)) AS UserName,
        LTRIM(RTRIM(GroupId))  AS GroupId,
        LTRIM(RTRIM(LOCCODE))  AS LocCode,
        LTRIM(RTRIM(ContNo))   AS ContNo,
        LTRIM(RTRIM(Email))    AS Email,
        Enable
      FROM Tbl_UserDetails WITH (NOLOCK)
      ORDER BY UserName;
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
  const session = requireSession(req);
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

    const b = await req.json();
    const loginName = String(b.loginName ?? "").trim();
    const userName = String(b.userName ?? "").trim();
    const password = String(b.password ?? "");
    const nic = String(b.nic ?? "").trim();
    const contNo = String(b.contNo ?? "").trim();
    const email = String(b.email ?? "").trim();
    const groupId = String(b.groupId ?? "STAFF").trim() || "STAFF";
    const locCode = String(b.locCode ?? "").trim();
    const dob = String(b.dob ?? "").trim() || "1980-01-01";
    const doj = String(b.doj ?? "").trim() || new Date().toISOString().split("T")[0];

    if (!loginName || !userName || !password || !nic) {
      return NextResponse.json(
        {
          success: false,
          error: "Login name, user name, NIC and password are required",
        },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const pool = await getPool();

    // LoginName unique check
    const dupReq = pool.request();
    dupReq.input("loginName", sql.VarChar(50), loginName);
    const dup = await dupReq.query(
      `SELECT TOP 1 1 FROM Tbl_UserDetails WITH (NOLOCK)
       WHERE LTRIM(RTRIM(LoginName)) = @loginName`
    );
    if (dup.recordset.length > 0) {
      return NextResponse.json(
        { success: false, error: "That login name is already taken" },
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
    ins.input("nic", sql.VarChar(20), nic);
    ins.input("logName", sql.VarChar(400), loginName);
    ins.input("psw", sql.VarChar(400), hashPassword(password));
    ins.input("loginName", sql.VarChar(50), loginName);
    ins.input("groupId", sql.Char(10), groupId);
    ins.input("userName", sql.VarChar(200), userName);
    ins.input("contNo", sql.VarChar(100), contNo);
    ins.input("email", sql.VarChar(100), email);
    ins.input("dob", sql.DateTime, new Date(dob));
    ins.input("doj", sql.DateTime, new Date(doj));
    ins.input("createUser", sql.Char(10), session.userId.slice(0, 10));
    ins.input("locCode", sql.Char(10), locCode);

    await ins.query(`
      INSERT INTO Tbl_UserDetails
        (UserId, NIC, LogName, PSW, LoginName, Password, GroupId, UserName,
         Rmks, Add1, Add2, Add3, Add4, ContNo, Email, DOB, DOJ, DOL,
         CreateUser, Picture, Enable, LOCCODE)
      VALUES
        (@userId, @nic, @logName, '', @loginName, @psw, @groupId, @userName,
         '', '', '', '', '', @contNo, @email, @dob, @doj, '1900-01-01',
         @createUser, NULL, 1, @locCode)
    `);

    return NextResponse.json({ success: true, userId });
  } catch (e) {
    console.error("Create user error:", e);
    return NextResponse.json(
      { success: false, error: "Failed to create user." },
      { status: 500 }
    );
  }
}
