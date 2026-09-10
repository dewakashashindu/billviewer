// ============================================================
// LOCATION: app/api/auth/logout/route.ts
// ALUTH FILE — mekamama create karanna
// POST — session cookie eka clear karanawa
// ============================================================
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const out = NextResponse.json({ success: true });
  out.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return out;
}
