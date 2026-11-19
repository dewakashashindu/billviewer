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
import "@/components/staff-ui-consistency.css";
import {loadWebAuthorization} from "@/lib/webAuthorization";

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

  let canViewDashboard = false;
  let reportPermissions: string[] = [];
  let webPermissions: string[] = [];
  let defaultLocation = '';
  let defaultLocationName = '';
  try {
    const access = await loadWebAuthorization(session);
    canViewDashboard = access.permissions.has('dashboard:VIEW');
    webPermissions = [...access.permissions];
    reportPermissions = [...access.permissions].filter(p => p.startsWith('report-'));
    defaultLocation = access.defaultLocation;
    // Display only the verified default location; a missing name does not grant access.
    try {
      const pool = await getPool();
      const result = await pool.request().input('code', sql.Char(10), defaultLocation)
        .query('SELECT RTRIM(LocDes) AS name FROM dbo.Tbl_LocationMaster WHERE LocCode=@code');
      if (result.recordset.length === 1) defaultLocationName = String(result.recordset[0].name ?? '').trim();
    } catch (error) { console.error('Default location name lookup failed:', error); }
  } catch (error) { console.error('Dashboard navigation authorization failed:', error); }

  const currentUser = {
    userId: session.userId,
    loginName: session.loginName,
    userName: session.userName,
    groupId,
    isAdmin: isAdminSession({ ...session, groupId }),
    defaultLocation,
    defaultLocationName,
  };
  return <AppShell currentUser={currentUser} canViewDashboard={canViewDashboard} reportPermissions={reportPermissions} webPermissions={webPermissions}>{children}</AppShell>;
}
