import {getSessionFromRequest} from '@/lib/session';
import {requireWebPermission,AccessDeniedError} from '@/lib/webAuthorization';

export const dynamic = 'force-dynamic';
export default async function DashboardAccessLayout({children}:{children:React.ReactNode}) {
  try {
    const session = await getSessionFromRequest();
    if (!session) throw new Error('No session');
    await requireWebPermission(session, 'dashboard:VIEW');
    return <>{children}</>;
  } catch (error) {
    if (!(error instanceof AccessDeniedError)) console.error('Dashboard authorization unavailable:', error);
    return <main style={{padding:32}}><h1>Access denied</h1><p>Dashboard access is not assigned to this user, or authorization is temporarily unavailable. Please contact your administrator.</p></main>;
  }
}
