// Report usage beacon (called by ReportToolbar): records that a report was
// viewed / downloaded as PDF / shared. The client only reports what it did;
// the actor is taken from the server-side session, never from the request.
import {NextRequest,NextResponse} from 'next/server';
import {SESSION_COOKIE,verifySessionValue} from '@/lib/auth';
import {logActivity} from '@/lib/activityLog';
import {clientIp} from '@/lib/rateLimit';
import crypto from 'node:crypto';

const ACTIONS:Record<string,string>={VIEW:'REPORT_VIEWED',EXPORT:'REPORT_EXPORTED',PRINT:'REPORT_PRINTED',SHARE:'REPORT_SHARED'};
const clip=(v:unknown,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';

export async function POST(req:NextRequest){
 const token=req.cookies.get(SESSION_COOKIE)?.value;
 const session=token?await verifySessionValue(token):null;
 if(!session)return NextResponse.json({error:'Not logged in.'},{status:401});
 const body=await req.json().catch(()=>null);
 const kind=clip(body?.action,10).toUpperCase();
 const action=ACTIONS[kind];
 if(!action)return NextResponse.json({error:'Invalid action.'},{status:400});
 const title=clip(body?.title,200)||'Report';
 const from=clip(body?.from,10),to=clip(body?.to,10);
 await logActivity({actor:session,category:'REPORT',action,targetType:'report',targetId:title,targetName:title,
  details:`${title}${from&&to?` (${from} to ${to})`:''} — ${kind.toLowerCase()}`,ipAddress:clientIp(req.headers),
  sessionRef:session.sessionId?crypto.createHash('sha256').update(session.sessionId).digest('hex').slice(0,12):''});
 return NextResponse.json({success:true});
}
