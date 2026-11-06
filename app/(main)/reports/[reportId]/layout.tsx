import {getSessionFromRequest} from '@/lib/session';
import {requireWebPermission} from '@/lib/webAuthorization';
export const dynamic='force-dynamic';
export default async function ReportAccessLayout({children,params}:{children:React.ReactNode;params:Promise<{reportId:string}>}){
  const {reportId}=await params;
  try {const session=await getSessionFromRequest();if(!session)throw new Error('No session');await requireWebPermission(session,`report-${reportId}:VIEW`);return <>{children}</>}
  catch(error){console.error('Performance report authorization failed:',error);return <main style={{padding:32}}><h1>Access denied</h1><p>You do not have permission to view this report, or access is unavailable.</p></main>}
}
