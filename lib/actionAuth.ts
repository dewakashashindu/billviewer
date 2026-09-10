// ============================================================
// LOCATION: lib/actionAuth.ts
// Server Action auth guard.
//
// ⚠️ app/(main)/layout.tsx එකේ redirect එකෙන් protect වෙන්නේ
//    PAGE RENDER එක විතරයි. Server Action එකක් කෙලින්ම POST කරලා
//    (`Next-Action: <id>` header එකත් එක්ක — action ID එක client
//    bundle එකේම තියෙනවා, ඒක secret එකක් නෙමෙයි) call කරන්න
//    පුළුවන්. ඒ නිසා data එන හැම action එකක්ම මෙතනින්
//    session එක verify කරන්න ඕන.
//
// Usage:
//   export async function someAction(...) {
//     try {
//       await requireSession();      // ← මුල් line එක
//       ...
//     } catch (e) { return actionError(e); }
//   }
//
// Client side එකෙන් `res.error === UNAUTHORIZED_ERROR` නම්
// /login එකට redirect කරන්න.
// ============================================================
import { cookies } from "next/headers";
import {
  verifySessionValue,
  SESSION_COOKIE,
  UNAUTHORIZED_ERROR,
  type SessionUser,
} from "./auth";

/** Action result shape (config/reports.config.ts එකේ fetchAction type එකට ගැලපෙනවා) */
export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class UnauthorizedError extends Error {
  constructor() {
    super(UNAUTHORIZED_ERROR);
    this.name = "UnauthorizedError";
  }
}

/** Signed session cookie එකෙන් user කෙනෙක් — නැත්නම් UnauthorizedError throw කරනවා */
export async function requireSession(): Promise<SessionUser> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionValue(token) : null;
  if (!session) throw new UnauthorizedError();
  return session;
}

/** catch block එකෙන් — UnauthorizedError එකක් නම් 401 error එකක්, නැත්නම් generic DB error එකක් */
export function actionError(e: unknown, fallback = "Database Data Fetching Failed."): ActionResult {
  if (e instanceof UnauthorizedError || (e as Error)?.message === UNAUTHORIZED_ERROR) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }
  return { success: false, error: fallback };
}
