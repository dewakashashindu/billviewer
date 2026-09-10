// ============================================================
// LOCATION: app/api/auth/me/route.ts
// ALUTH FILE — mekamama create karanna
// GET — session eken logged-in user info (client components ata)
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue, SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? verifySessionValue(token) : null;
  if (!user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    user: {
      userId: user.userId,
      loginName: user.loginName,
      userName: user.userName,
    },
  });
}
