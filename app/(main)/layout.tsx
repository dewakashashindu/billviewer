// ============================================================
// LOCATION: app/(main)/layout.tsx
// Auth guard — /dashboard, /reports/*, /user-creation, /settings okkoma
// login nokaralu → /login ekata redirect.
// /bill, /order SAHA / PAGES ME LAYOUT EKEN PITA — PUBLIC.
// ============================================================
import { redirect } from "next/navigation";
import sql from "mssql";
import { getSessionFromRequest } from "@/lib/session";
import { isAdminSession } from "@/lib/auth";
import { getPool, isDbConfigured } from "@/lib/db";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromRequest();
  if (!session) {
    redirect("/login");
  }

  let groupId = session.groupId ?? "";
  if (!groupId && isDbConfigured()) {
    try {
      const pool = await getPool();
      const r = await pool
        .request()
        .input("uid", sql.Char(10), String(session.userId))
        .query(`
          SELECT TOP 1 LTRIM(RTRIM(ISNULL(GroupId, ''))) AS GroupId
          FROM Tbl_UserDetails WITH (NOLOCK)
          WHERE LTRIM(RTRIM(UserId)) = LTRIM(RTRIM(@uid))
        `);
      if (r.recordset[0]) groupId = String(r.recordset[0].GroupId ?? "");
    } catch {
      /* ignore */
    }
  }

  const currentUser = {
    userId: session.userId,
    loginName: session.loginName,
    userName: session.userName,
    groupId,
    isAdmin: isAdminSession({ ...session, groupId }),
  };

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
