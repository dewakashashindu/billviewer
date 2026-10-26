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
// The search itself lives in lib/customerService.findCustomerByPhone
// so the read path and the create path (POST /api/customer/register,
// /api/order/confirm) always agree:
//   • phone column auto-detected (RegTel / CusTel / Mobile / Phone)
//   • both sides digit-normalised, compared on the last 9 digits
//     "+94 77 979 2705" · "0094779792705" · "0779792705" → same row
//   • only CusCode / CusName leave the server — nothing else
//     (credit, blacklist, address … stay in the POS)
//
// Rate limited per IP — this endpoint answers "does this phone
// number exist", so it must not be a free customer dump.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { getPool, isDbConfigured } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { findCustomerByPhone, normalisePhone } from "@/lib/customerService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const raw = (request.nextUrl.searchParams.get("phone") ?? "").trim();
    const digits = raw.replace(/[^0-9]/g, "");

    if (digits.length < 9 || digits.length > 15) {
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
    const hit = await findCustomerByPhone(pool, normalisePhone(digits));

    if (!hit) {
      return NextResponse.json({ ok: true, data: { found: false } });
    }

    return NextResponse.json({
      ok: true,
      data: {
        found: true,
        cusCode: hit.cusCode,
        cusName: hit.cusName,
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
