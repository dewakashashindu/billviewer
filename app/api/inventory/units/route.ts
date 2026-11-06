import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { isAdminSession, SESSION_COOKIE, verifySessionValue } from "@/lib/auth";

const definitions = {
  master: { table: "[dbo].[Tbl_Unit]", code: "[UnitID]", name: "[UnitDes]", enabled: "[Enable]" },
  sub: { table: "[dbo].[Tbl_UnitSub]", code: "[SubUnitID]", name: "[SubUnitDes]", enabled: "[SubItemEnable]" },
} as const;
async function authorize(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionValue(token) : null;
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  let groupId = session.groupId ?? "";
  if (!groupId) {
    const r = await (await getPool()).request().input("uid", sql.Char(10), String(session.userId)).query("SELECT TOP 1 LTRIM(RTRIM(ISNULL(GroupId,''))) AS GroupId FROM Tbl_UserDetails WHERE LTRIM(RTRIM(UserId)) = LTRIM(RTRIM(@uid))");
    groupId = r.recordset[0]?.GroupId ?? "";
  }
  return isAdminSession({ ...session, groupId }) ? null : NextResponse.json({ error: "Admin access required." }, { status: 403 });
}
function kind(req: NextRequest): "master" | "sub" | "conversion" | null { const k = req.nextUrl.searchParams.get("type"); return k === "master" || k === "sub" || k === "conversion" ? k : null; }
function fail(e: unknown) {
  console.error("Unit database error:", e); const number = (e as { number?: number })?.number;
  const message = number === 2627 || number === 2601 ? "A record with this ID already exists." : number === 547 ? "This unit is referenced by another record and cannot be deleted or changed." : number === 8152 || number === 2628 ? "ID or description is too long for the database column." : "Unable to access units. Check the database connection and table schema.";
  return NextResponse.json({ error: message }, { status: number === 2627 || number === 2601 || number === 547 ? 409 : 500 });
}
async function setup(req: NextRequest) { const auth = await authorize(req); if (auth) return { error: auth, kind: null }; const k = kind(req); if (!k) return { error: NextResponse.json({ error: "Invalid unit type." }, { status: 400 }), kind: null }; return { error: null, kind: k }; }
export async function GET(req: NextRequest) {
  try { const ctx = await setup(req); if (ctx.error || !ctx.kind) return ctx.error!; const pool = await getPool();
    if (ctx.kind === "conversion") {
      const r = await pool.request().query(`SELECT RTRIM(c.MasterUnitID) AS master, RTRIM(c.SubUnitID) AS sub, c.Units AS ratio, c.Enable AS enabled, u.UnitDes AS masterName, s.SubUnitDes AS subName FROM dbo.Tbl_UnitConversion c LEFT JOIN dbo.Tbl_Unit u ON u.UnitID = c.MasterUnitID LEFT JOIN dbo.Tbl_UnitSub s ON s.SubUnitID = c.SubUnitID ORDER BY c.MasterUnitID, c.SubUnitID`);
      return NextResponse.json({ data: r.recordset }, { headers: { "Cache-Control": "no-store" } });
    }
    const d = definitions[ctx.kind]; const r = await pool.request().query(`SELECT RTRIM(${d.code}) AS code, ${d.name} AS name, ${d.enabled} AS enabled FROM ${d.table} ORDER BY ${d.name}, ${d.code}`);
    return NextResponse.json({ data: r.recordset }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
function validUnit(x: Record<string, unknown>) { return typeof x.code === "string" && !!x.code.trim() && x.code.length <= 4000 && typeof x.name === "string" && !!x.name.trim() && x.name.length <= 4000 && typeof x.enabled === "boolean"; }
function validConversion(x: Record<string, unknown>) { return typeof x.master === "string" && !!x.master.trim() && x.master.length <= 4000 && typeof x.sub === "string" && !!x.sub.trim() && x.sub.length <= 4000 && typeof x.ratio === "number" && Number.isFinite(x.ratio) && x.ratio > 0 && typeof x.enabled === "boolean"; }
export async function POST(req: NextRequest) {
  try { const ctx = await setup(req); if (ctx.error || !ctx.kind) return ctx.error!; const x = await req.json(); const pool = await getPool();
    if (ctx.kind === "conversion") { if (!validConversion(x)) return NextResponse.json({ error: "Select both units and enter a conversion ratio greater than zero." }, { status: 400 });
      const result = await pool.request().input("master", sql.NVarChar(sql.MAX), x.master.trim()).input("sub", sql.NVarChar(sql.MAX), x.sub.trim()).input("ratio", sql.Float, x.ratio).input("enabled", sql.Bit, x.enabled).query(`INSERT INTO dbo.Tbl_UnitConversion (MasterUnitID, SubUnitID, Units, Enable) SELECT @master, @sub, @ratio, @enabled WHERE EXISTS (SELECT 1 FROM dbo.Tbl_Unit WHERE UnitID=@master) AND EXISTS (SELECT 1 FROM dbo.Tbl_UnitSub WHERE SubUnitID=@sub)`);
      if (!result.rowsAffected[0]) return NextResponse.json({ error: "Selected unit does not exist. Refresh and try again." }, { status: 400 });
    } else { if (!validUnit(x)) return NextResponse.json({ error: "Unit code, description and status are required." }, { status: 400 }); const d = definitions[ctx.kind]; await pool.request().input("code", sql.NVarChar(sql.MAX), x.code.trim()).input("name", sql.NVarChar(sql.MAX), x.name.trim()).input("enabled", sql.Bit, x.enabled).query(`INSERT INTO ${d.table} (${d.code}, ${d.name}, ${d.enabled}) VALUES (@code, @name, @enabled)`); }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) { return fail(e); }
}
export async function PUT(req: NextRequest) {
  try { const ctx = await setup(req); if (ctx.error || !ctx.kind) return ctx.error!; const x = await req.json(); const pool = await getPool(); let count = 0;
    if (ctx.kind === "conversion") { if (!validConversion(x)) return NextResponse.json({ error: "Select both units and enter a conversion ratio greater than zero." }, { status: 400 }); const r = await pool.request().input("master", sql.NVarChar(sql.MAX), x.master.trim()).input("sub", sql.NVarChar(sql.MAX), x.sub.trim()).input("ratio", sql.Float, x.ratio).input("enabled", sql.Bit, x.enabled).query("UPDATE dbo.Tbl_UnitConversion SET Units=@ratio, Enable=@enabled WHERE MasterUnitID=@master AND SubUnitID=@sub"); count = r.rowsAffected[0];
    } else { if (!validUnit(x)) return NextResponse.json({ error: "Unit code, description and status are required." }, { status: 400 }); const d = definitions[ctx.kind]; const r = await pool.request().input("code", sql.NVarChar(sql.MAX), x.code.trim()).input("name", sql.NVarChar(sql.MAX), x.name.trim()).input("enabled", sql.Bit, x.enabled).query(`UPDATE ${d.table} SET ${d.name}=@name, ${d.enabled}=@enabled WHERE ${d.code}=@code`); count = r.rowsAffected[0]; }
    if (!count) return NextResponse.json({ error: "Record not found. Refresh and try again." }, { status: 404 }); return NextResponse.json({ success: true });
  } catch (e) { return fail(e); }
}
export async function DELETE(req: NextRequest) {
  try { const ctx = await setup(req); if (ctx.error || !ctx.kind) return ctx.error!; const x = await req.json(); const pool = await getPool(); let count = 0;
    if (ctx.kind === "conversion") { if (typeof x.master !== "string" || !x.master.trim() || typeof x.sub !== "string" || !x.sub.trim() || x.master.length > 4000 || x.sub.length > 4000) return NextResponse.json({ error: "Both unit IDs are required." }, { status: 400 }); const r = await pool.request().input("master", sql.NVarChar(sql.MAX), x.master.trim()).input("sub", sql.NVarChar(sql.MAX), x.sub.trim()).query("DELETE FROM dbo.Tbl_UnitConversion WHERE MasterUnitID=@master AND SubUnitID=@sub"); count = r.rowsAffected[0];
    } else { if (typeof x.code !== "string" || !x.code.trim() || x.code.length > 4000) return NextResponse.json({ error: "Unit ID is required." }, { status: 400 }); const d = definitions[ctx.kind]; const key = ctx.kind === "master" ? "MasterUnitID" : "SubUnitID";
      // Protect conversion references even if this database has no foreign key.
      const r = await pool.request().input("code", sql.NVarChar(sql.MAX), x.code.trim()).query(`DELETE FROM ${d.table} WHERE ${d.code}=@code AND NOT EXISTS (SELECT 1 FROM dbo.Tbl_UnitConversion WITH (UPDLOCK,HOLDLOCK) WHERE ${key}=@code) ${ctx.kind === "master" ? "AND NOT EXISTS (SELECT 1 FROM dbo.Tbl_RowItems WITH (UPDLOCK,HOLDLOCK) WHERE UnitID=@code)" : ""}`); count = r.rowsAffected[0]; }
    if (!count) return NextResponse.json({ error: "Record not found or this unit is used in a conversion or item." }, { status: 409 }); return NextResponse.json({ success: true });
  } catch (e) { return fail(e); }
}
