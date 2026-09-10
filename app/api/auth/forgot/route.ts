// ============================================================
// LOCATION: app/api/auth/forgot/route.ts
// ALUTH FILE — mekamama create karanna
// POST { loginName } → OTP generate → SMS eken ContNo ta →
// stateless OTP token httpOnly cookie ekata (10 min)
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { createOtpToken, generateOtp, OTP_COOKIE } from "@/lib/auth";
import { sendSms } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const { loginName } = await req.json();
    if (!loginName) {
      return NextResponse.json(
        { success: false, error: "Login name is required" },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database not configured (DB_* env vars missing)" },
        { status: 500 }
      );
    }

    const pool = await getPool();
    const request = pool.request();
    request.input("loginName", sql.VarChar(50), String(loginName).trim());
    const res = await request.query(`
      SELECT TOP 1
        LTRIM(RTRIM(LoginName)) AS LoginName,
        LTRIM(RTRIM(ContNo))    AS ContNo
      FROM Tbl_UserDetails WITH (NOLOCK)
      WHERE LTRIM(RTRIM(LoginName)) = @loginName AND Enable = 1
    `);

    const user = res.recordset[0];
    if (!user) {
      return NextResponse.json(
        { success: false, error: "No active account found with that login name" },
        { status: 404 }
      );
    }
    if (!user.ContNo) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No mobile number on file for this account — contact your administrator",
        },
        { status: 400 }
      );
    }

    const code = generateOtp();
    const sent = await sendSms(
      String(user.ContNo),
      `MicroEChef password reset code: ${code} (valid 10 minutes)`
    );

    const out = NextResponse.json({
      success: true,
      smsSent: sent,
      maskedPhone: String(user.ContNo).replace(/^(\d{3})\d+(\d{2})$/, "$1****$2"),
    });

    if (sent) {
      out.cookies.set(OTP_COOKIE, createOtpToken(String(user.LoginName), code), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 10 * 60,
      });
    }
    return out;
  } catch (e) {
    console.error("Forgot password error:", e);
    return NextResponse.json(
      { success: false, error: "Request failed. Please try again." },
      { status: 500 }
    );
  }
}
