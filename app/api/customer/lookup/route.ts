// ============================================================
// LOCATION: app/api/customer/lookup/route.ts
// GET /api/customer/lookup?phone=0771234567
//
// Public — used by the guest form right after the phone number
// is typed, so a returning customer's name can be auto-filled.
//
//   { ok: true, data: { found: true, cusCode, cusName } }
//   { ok: true, data: { found: false } }
//
// Only Tbl_CustomerMaster rows with Enable = 1 and a matching
// RegTel are returned. Nothing else (credit, blacklist, …) is
// exposed to the browser.
//
// Rate limited per IP — this endpoint answers "does this phone
// number exist", so it must not be a free customer dump.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const digits = (v: string) => String(v ?? "").replace(/[^0-9]/g, "");

export async function GET(request: NextRequest) {
  try {
    const raw = (request.nextUrl.searchParams.get("phone") ?? "").trim();
    const phone = digits(raw);

    if (phone.length < 9 || phone.length > 15) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid phone number." },
        { status: 400 }
      );
    }

    const ipLimit = rateLimit(`customer-lookup:${clientIp(request.headers)}`, 40, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many lookups. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
      );
    }

    /* Dev / no DB — no customer master to search. */
    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true, data: { found: false, source: "mock" } });
    }

    const pool = await getPool();
    const req = pool.request();
    req.input("phone", sql.VarChar(20), phone);
    const res = await req.query(`
      SELECT TOP 1
        LTRIM(RTRIM(CusCode)) AS CusCode,
        LTRIM(RTRIM(CusName)) AS CusName
      FROM dbo.Tbl_CustomerMaster WITH (NOLOCK)
      WHERE ISNULL(Enable, 1) = 1
        AND REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(RegTel)), ' ', ''), '-', ''), '+', ''), '(', '') LIKE '%' + @phone
      ORDER BY
        CASE
          WHEN REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(RegTel)), ' ', ''), '-', ''), '+', '') = @phone THEN 0
          ELSE 1
        END,
        CusCode;
    `);

    if (!res.recordset.length) {
      return NextResponse.json({ ok: true, data: { found: false } });
    }

    const row = res.recordset[0];
    return NextResponse.json({
      ok: true,
      data: {
        found: true,
        cusCode: String(row.CusCode ?? "").trim(),
        cusName: String(row.CusName ?? "").trim(),
      },
    });
  } catch (error) {
    console.error("Customer lookup error:", error);
    return NextResponse.json(
      { ok: false, error: "Could not check the phone number." },
      { status: 500 }
    );
  }
}
