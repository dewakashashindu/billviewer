// ============================================================
// LOCATION: app/api/customer/register/route.ts
// POST /api/customer/register
//
// Called by the guest form ("Who is this order for?") once the
// guest has typed the phone number + name and taps Continue.
//
// Body:
//   { phone, name, locCode?, tableNo?, t? }
//
// Out:
//   { ok: true, data: { cusCode, cusName, created } }
//   { ok: true, data: { cusCode: "", created: false, source: "mock" } }   (no DB)
//
// What happens:
//   1. phone → dbo.Tbl_CustomerMaster lookup
//        found  → return the existing CusCode (no new row)
//        absent → create the customer
//                   CusCode = Tbl_TxnNumbers (LocCode, TxnType 'CC')
//                             Prefix + TxnNo zero-padded 6  → A000005
//   2. the CusCode goes back to the browser ONLY so the order
//      confirm call can echo it — it is never shown to the guest.
//
// The customer is created HERE (decision: "name + phone type කරලා
// continue කරන වෙලාවේ"), and confirmOrder has the same logic as a
// safety net in case this call failed.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { checkTableAccess } from "@/lib/orderToken";
import {
  defaultLocCode,
  normalisePhone,
  resolveOrCreateCustomer,
} from "@/lib/customerService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const phone = normalisePhone(String(body.phone ?? ""));
    const name = String(body.name ?? "").trim().slice(0, 200);
    const locCode = String(body.locCode ?? "").trim().slice(0, 10) || defaultLocCode();
    const tableNo = String(body.tableNo ?? "").trim();
    const token = String(body.t ?? "").trim();

    if (phone.length < 9) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid phone number." },
        { status: 400 }
      );
    }
    if (name.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Please enter the customer name." },
        { status: 400 }
      );
    }

    /* a table QR link always carries a token — verify it when present */
    if (tableNo && token) {
      const access = checkTableAccess(tableNo, token);
      if (!access.ok) {
        return NextResponse.json(
          { ok: false, error: access.error },
          { status: access.status }
        );
      }
    }

    /* write endpoint → tighter than the read-only lookup (40/min) */
    const limit = rateLimit(`customer-register:${clientIp(request.headers)}`, 12, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    /* dev / no DB — nothing to create */
    if (!isDbConfigured()) {
      return NextResponse.json({
        ok: true,
        data: { cusCode: "", cusName: name, created: false, source: "mock" },
      });
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const customer = await resolveOrCreateCustomer(tx, { locCode, phone, name });
      await tx.commit();

      console.log(
        `👤 ${customer.created ? "created" : "matched"} customer ${customer.cusCode} (loc ${locCode})`
      );

      return NextResponse.json({
        ok: true,
        data: {
          cusCode: customer.cusCode,
          cusName: customer.cusName,
          created: customer.created,
        },
      });
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        /* already rolled back */
      }
      throw err;
    }
  } catch (error) {
    console.error("Customer register error:", error);
    return NextResponse.json(
      { ok: false, error: "Could not save your details. Please try again." },
      { status: 500 }
    );
  }
}
