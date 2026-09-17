// ============================================================
// LOCATION: lib/actionAuth.ts
// Server Action auth guard.
//
//
// Usage:
//   export async function someAction(...) {
//     try {
//       ...
//     } catch (e) { return actionError(e); }
//   }
//
// ============================================================
import { cookies } from "next/headers";
import {
  verifySessionValue,
  SESSION_COOKIE,
  UNAUTHORIZED_ERROR,
  type SessionUser,
} from "./auth";

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

export async function requireSession(): Promise<SessionUser> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionValue(token) : null;
  if (!session) throw new UnauthorizedError();
  return session;
}

export function actionError(e: unknown, fallback = "Database Data Fetching Failed."): ActionResult {
  if (e instanceof UnauthorizedError || (e as Error)?.message === UNAUTHORIZED_ERROR) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }
  return { success: false, error: fallback };
}
