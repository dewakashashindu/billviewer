// ============================================================
// LOCATION: lib/session.ts
// ALUTH FILE — mekamama create karanna
// Session read helper (server components/layouts — next/headers)
// ============================================================
import { cookies } from "next/headers";
import { verifySessionValue, SESSION_COOKIE, SessionUser } from "./auth";

export async function getSessionFromRequest(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySessionValue(token) : null;
}
