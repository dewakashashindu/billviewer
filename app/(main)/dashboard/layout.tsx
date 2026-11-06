import {getSessionFromRequest} from '@/lib/session';
import {requireWebPermission} from '@/lib/webAuthorization';

export const dynamic = 'force-dynamic';
export default async function DashboardAccessLayout({children}:{children:React.ReactNode}) {
  try {
    const session = await getSessionFromRequest();
    if (!session) throw new Error('No session');
    await requireWebPermission(session, 'dashboard:VIEW');
    return <>{children}</>;
  } catch (error) {
    console.error('Dashboard authorization failed:', error);
    return <main style={{padding:32}}><h1>Access denied</h1><p>You do not have permission to view the dashboard, or access is unavailable.</p></main>;
  }
}
