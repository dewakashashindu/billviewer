// ============================================================
// LOCATION: app/api/auth/logout/route.ts
// ALUTH FILE — mekamama create karanna
// POST — session cookie eka clear karanawa
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { revokeWebSession } from "@/lib/webSession";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";

export async function POST(req: NextRequest) {
  const token=req.cookies.get(SESSION_COOKIE)?.value;
  const session=token?await verifySessionValue(token).catch(()=>null):null;
  try { if(token) await revokeWebSession(token); }
  catch(error) { console.error("Session revocation failed:",error); return NextResponse.json({success:false,error:"Logout failed. Please try again."},{status:503}); }
  if(session) await logActivity({actor:session,category:'SESSION',action:'LOGOUT',details:'User signed out; session revoked.'});
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
