import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { isAdminSession, SESSION_COOKIE, verifySessionValue } from "@/lib/auth";

// The table identifier is selected only from this server-side allowlist.
const tables = ["[dbo].[Tbl_Maincategory]", "[dbo].[Tbl_Subcategory1]", "[dbo].[Tbl_Subcategory2]", "[dbo].[Tbl_Subcategory3]", "[dbo].[Tbl_Subcategory4]", "[dbo].[Tbl_Subcategory5]"] as const;

async function authorize(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionValue(token) : null;
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ error: "Database is not configured. Set the DB_* environment variables." }, { status: 503 });
  let groupId = session.groupId ?? "";
  if (!groupId) {
    const result = await (await getPool()).request().input("uid", sql.Char(10), String(session.userId)).query("SELECT TOP 1 LTRIM(RTRIM(ISNULL(GroupId, ''))) AS GroupId FROM Tbl_UserDetails WHERE LTRIM(RTRIM(UserId)) = LTRIM(RTRIM(@uid))");
    groupId = result.recordset[0]?.GroupId ?? "";
  }
  if (!isAdminSession({ ...session, groupId })) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return null;
}
function tableFor(req: NextRequest) {
  const level = req.nextUrl.searchParams.get("level");
  if (level === null || !/^[0-5]$/.test(level)) return null;
  return { level: Number(level), table: tables[Number(level)], codeColumn: "[CatCode]", nameColumn: "[CatDes]" };
}
function errorResponse(error: unknown) {
  console.error("Category database error:", error);
  const e = error as { number?: number; originalError?: { info?: { number?: number } } };
  const number = e.number ?? e.originalError?.info?.number;
  if (number === 2627 || number === 2601) return NextResponse.json({ error: "This category code already exists in this level." }, { status: 409 });
  if (number === 547) return NextResponse.json({ error: "This category is referenced by another record and cannot be deleted." }, { status: 409 });
  if (number === 8152 || number === 2628) return NextResponse.json({ error: "Code or description is too long for this table." }, { status: 400 });
  return NextResponse.json({ error: "Unable to access category data. Check the database connection and table schema." }, { status: 500 });
}
async function validate(req: NextRequest) {
  const auth = await authorize(req); if (auth) return { response: auth };
  const table = tableFor(req); if (!table) return { response: NextResponse.json({ error: "Invalid category level." }, { status: 400 }) };
  return table;
}
export async function GET(req: NextRequest) {
  try {
    const result = await validate(req); if ("response" in result) return result.response;
    const data = await (await getPool()).request().query(`SELECT RTRIM(${result.codeColumn}) AS code, ${result.nameColumn} AS name, [Enable] AS enabled FROM ${result.table} ORDER BY ${result.nameColumn}, ${result.codeColumn}`);
    return NextResponse.json({ data: data.recordset }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return errorResponse(e); }
}
export async function POST(req: NextRequest) {
  try {
    const result = await validate(req); if ("response" in result) return result.response;
    const body = await req.json();
    if (typeof body.code !== "string" || typeof body.name !== "string" || typeof body.enabled !== "boolean" || !body.code.trim() || !body.name.trim() || body.code.length > 4000 || body.name.length > 4000) return NextResponse.json({ error: "A valid category code, description and status are required." }, { status: 400 });
    const pool = await getPool();
    await pool.request().input("code", sql.NVarChar(sql.MAX), body.code.trim()).input("name", sql.NVarChar(sql.MAX), body.name.trim()).input("enabled", sql.Bit, body.enabled).query(`INSERT INTO ${result.table} (${result.codeColumn}, ${result.nameColumn}, [Enable]) VALUES (@code, @name, @enabled)`);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
export async function PUT(req: NextRequest) {
  try {
    const result = await validate(req); if ("response" in result) return result.response;
    const body = await req.json();
    if (typeof body.code !== "string" || typeof body.name !== "string" || typeof body.enabled !== "boolean" || !body.code.trim() || !body.name.trim() || body.code.length > 4000 || body.name.length > 4000) return NextResponse.json({ error: "A valid category code, description and status are required." }, { status: 400 });
    const updated = await (await getPool()).request().input("code", sql.NVarChar(sql.MAX), body.code.trim()).input("name", sql.NVarChar(sql.MAX), body.name.trim()).input("enabled", sql.Bit, body.enabled).query(`UPDATE ${result.table} SET ${result.nameColumn} = @name, [Enable] = @enabled WHERE ${result.codeColumn} = @code AND (SELECT COUNT(*) FROM ${result.table} WHERE ${result.codeColumn} = @code) = 1`);
    if (!updated.rowsAffected[0]) return NextResponse.json({ error: "Category not found or its code is duplicated. Check the table before editing or deleting." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) { return errorResponse(e); }
}
export async function DELETE(req: NextRequest) {
  try {
    const result = await validate(req); if ("response" in result) return result.response;
    const body = await req.json(); if (typeof body.code !== "string" || !body.code.trim() || body.code.length > 4000) return NextResponse.json({ error: "Category code is required." }, { status: 400 });
    const deleted = await (await getPool()).request().input("code", sql.NVarChar(sql.MAX), body.code.trim()).query(`DELETE FROM ${result.table} WHERE ${result.codeColumn} = @code AND (SELECT COUNT(*) FROM ${result.table} WHERE ${result.codeColumn} = @code) = 1 AND NOT EXISTS (SELECT 1 FROM dbo.Tbl_RowItems WITH (UPDLOCK,HOLDLOCK) WHERE [RowLevel${result.level + 1}]=@code)`);
    if (!deleted.rowsAffected[0]) return NextResponse.json({ error: "Category is missing, duplicated, or used by an item." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) { return errorResponse(e); }
}
