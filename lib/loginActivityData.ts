// Shared data access for the hidden /login-activity screen (Logins, Activity,
// Report tabs) and the matching PDF export route. Keeping the SQL in ONE
// place guarantees the screen and the PDF always show the same filtered data.
// Row caps are safety valves, never silent: callers receive `capped: true`
// when a cap is hit and must surface it to the user.
import 'server-only';
import sql from 'mssql';
import {getPool} from '@/lib/db';
import {ensureActivityTable} from '@/lib/activityLog';
import {ensureLoginAuditTable} from '@/lib/loginAudit';

export type Row=Record<string,unknown>;
export type LoginActivityFilters={
 q?:string;          // free-text search
 user?:string;       // LoginName filter
 from?:string;       // YYYY-MM-DD (defaults applied by withTodayDefault)
 to?:string;         // YYYY-MM-DD (inclusive)
 result?:string;     // 'success' | 'failed' (logins/report only)
 category?:string;   // activity category (activity tab only)
};

export const ROW_CAP=5000;      // logins & activity rows, full range
export const REPORT_CAP=200;    // session cards in the Report tab

export const str=(v:unknown)=>v===null||v===undefined?'':String(v).trim();
const clean=(v?:string)=>(v??'').trim();
/** Colombo "today" as YYYY-MM-DD. */
export const colomboToday=()=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const get=(t:string)=>parts.find(x=>x.type===t)?.value??'01';
 return `${get('year')}-${get('month')}-${get('day')}`;
};
/** Default the date range to "today" (Asia/Colombo) when the user has not picked one. */
export function withTodayDefault<T extends LoginActivityFilters>(f:T):T&{from:string;to:string}{
 const today=colomboToday();
 return {...f,from:clean(f.from)||today,to:clean(f.to)||today};
}

function dateWhere(where:string[],req:sql.Request,col:'LoginAt'|'ActivityAt',from?:string,to?:string){
 const f=clean(from),t=clean(to);
 if(f){where.push(`${col}>=@from`);req.input('from',sql.VarChar(10),f)}
 if(t){where.push(`${col}<DATEADD(day,1,CONVERT(date,@to,23))`);req.input('to',sql.VarChar(10),t)}
}

const LOGIN_COLS='Id,LoginAt,UserId,LoginName,UserName,Success,FailReason,IpAddress,ForwardedFor,GeoCountry,GeoRegion,GeoCity,GeoLatitude,GeoLongitude,GeoTimezone,Isp,ConnectionType,IsVpnOrProxy,DeviceType,DeviceModel,Browser,BrowserVersion,OsName,OsVersion,AcceptLanguage,ClientHints,UserAgent,LocationCode,SessionRef,IsNewDevice,IsNewLocation,GeoSource';
export async function getLoginRows(f:LoginActivityFilters):Promise<{rows:Row[];capped:boolean}>{
 await ensureLoginAuditTable();
 const pool=await getPool();const req=pool.request();
 const where:string[]=['1=1'];
 dateWhere(where,req,'LoginAt',f.from,f.to);
 if(f.result==='success')where.push('Success=1');
 else if(f.result==='failed')where.push('Success=0');
 const q=clean(f.q);
 if(q){where.push("(LoginName LIKE @q OR ISNULL(UserName,'') LIKE @q OR ISNULL(IpAddress,'') LIKE @q OR ISNULL(GeoCity,'') LIKE @q OR ISNULL(DeviceModel,'') LIKE @q)");req.input('q',sql.NVarChar(200),'%'+q+'%')}
 const user=clean(f.user);
 if(user){where.push('LoginName=@userSel');req.input('userSel',sql.NVarChar(100),user)}
 const res=await req.query(`SELECT TOP ${ROW_CAP+1} ${LOGIN_COLS} FROM dbo.Tbl_UserLoginAudit WHERE ${where.join(' AND ')} ORDER BY LoginAt DESC,Id DESC`);
 const rows=res.recordset as Row[];
 return {rows:rows.slice(0,ROW_CAP),capped:rows.length>ROW_CAP};
}

export async function getLoginUserOptions():Promise<{login:string;name:string;count:number}[]>{
 const pool=await getPool();
 try{
  const res=await pool.request().query(`SELECT LoginName,MAX(ISNULL(UserName,'')) AS UserName,COUNT(*) AS Cnt FROM dbo.Tbl_UserLoginAudit GROUP BY LoginName ORDER BY COUNT(*) DESC`);
  return (res.recordset as Row[]).map(r=>({login:str(r.LoginName),name:str(r.UserName),count:Number(r.Cnt)||0}));
 }catch{return []}
}

const ACTIVITY_COLS='Id,ActivityAt,UserId,LoginName,UserName,LocationCode,Category,Action,TargetType,TargetId,TargetName,Details,BeforeValue,AfterValue,IpAddress,SessionRef';
const CATEGORY_RE=/^[A-Za-z_]{2,30}$/;
export async function getActivityRows(f:LoginActivityFilters):Promise<{rows:Row[];capped:boolean;total:number}>{
 await ensureActivityTable();
 const pool=await getPool();const req=pool.request();
 const where:string[]=['1=1'];
 dateWhere(where,req,'ActivityAt',f.from,f.to);
 const category=clean(f.category);
 if(category&&CATEGORY_RE.test(category)){where.push('Category=@cat');req.input('cat',sql.NVarChar(30),category)}
 const q=clean(f.q);
 if(q){where.push("(LoginName LIKE @q OR UserName LIKE @q OR Action LIKE @q OR TargetName LIKE @q OR TargetId LIKE @q OR Details LIKE @q)");req.input('q',sql.NVarChar(200),'%'+q+'%')}
 const user=clean(f.user);
 if(user){where.push('LoginName=@userSel');req.input('userSel',sql.NVarChar(100),user)}
 let total=0;
 try{
  const tRes=await pool.request().query('SELECT COUNT(*) AS Cnt FROM dbo.Tbl_WebActivityLog');
  total=Number((tRes.recordset as Row[])[0]?.Cnt)||0;
 }catch{/* total is cosmetic */}
 const res=await req.query(`SELECT TOP ${ROW_CAP+1} ${ACTIVITY_COLS} FROM dbo.Tbl_WebActivityLog WHERE ${where.join(' AND ')} ORDER BY ActivityAt DESC,Id DESC`);
 const rows=res.recordset as Row[];
 return {rows:rows.slice(0,ROW_CAP),capped:rows.length>ROW_CAP,total};
}

export async function getActivityUserOptions():Promise<{login:string;name:string;count:number}[]>{
 const pool=await getPool();
 try{
  const res=await pool.request().query(`SELECT LoginName,MAX(UserName) AS UserName,COUNT(*) AS Cnt FROM dbo.Tbl_WebActivityLog GROUP BY LoginName ORDER BY COUNT(*) DESC`);
  return (res.recordset as Row[]).map(r=>({login:str(r.LoginName),name:str(r.UserName),count:Number(r.Cnt)||0}));
 }catch{return []}
}

export type SessionReport={logins:Row[];activityBySession:Map<string,Row[]>;activeHashes:Set<string>;capped:boolean;activitiesError:boolean};
export async function getSessionReport(f:LoginActivityFilters):Promise<SessionReport>{
 await ensureLoginAuditTable();
 await ensureActivityTable();
 const pool=await getPool();const req=pool.request();
 const where:string[]=["Success=1","ISNULL(SessionRef,'')<>''"];
 dateWhere(where,req,'LoginAt',f.from,f.to);
 const q=clean(f.q);
 if(q){where.push("(LoginName LIKE @q OR ISNULL(UserName,'') LIKE @q OR ISNULL(IpAddress,'') LIKE @q OR ISNULL(GeoCity,'') LIKE @q OR ISNULL(DeviceModel,'') LIKE @q)");req.input('q',sql.NVarChar(200),'%'+q+'%')}
 const user=clean(f.user);
 if(user){where.push('LoginName=@userSel');req.input('userSel',sql.NVarChar(100),user)}
 const res=await req.query(`SELECT TOP ${REPORT_CAP+1} ${LOGIN_COLS} FROM dbo.Tbl_UserLoginAudit WHERE ${where.join(' AND ')} ORDER BY LoginAt DESC,Id DESC`);
 const cappedRows=res.recordset as Row[];
 const logins=cappedRows.slice(0,REPORT_CAP);
 const activityBySession=new Map<string,Row[]>();const activeHashes=new Set<string>();let activitiesError=false;
 const refs=[...new Set(logins.map(r=>str(r.SessionRef)).filter(Boolean))];
 if(refs.length){
  try{
   const aReq=pool.request();
   const aParams=refs.map((ref,i)=>{aReq.input(`sr${i}`,sql.NVarChar(64),ref);return `@sr${i}`});
   const aRes=await aReq.query(`SELECT SessionRef,Id,ActivityAt,Category,Action,TargetType,TargetId,TargetName,Details,BeforeValue,AfterValue,IpAddress FROM dbo.Tbl_WebActivityLog WHERE SessionRef IN (${aParams.join(',')}) ORDER BY ActivityAt ASC,Id ASC`);
   for(const row of aRes.recordset as Row[]){
    const key=str(row.SessionRef);const list=activityBySession.get(key)??[];list.push(row);activityBySession.set(key,list);
   }
  }catch{activitiesError=true}
  try{
   const wReq=pool.request();
   const wParams=refs.map((ref,i)=>{wReq.input(`wh${i}`,sql.Char(64),ref);return `@wh${i}`});
   const wRes=await wReq.query(`SELECT SessionHash FROM dbo.Tbl_WebSession WHERE SessionHash IN (${wParams.join(',')}) AND ExpireAt>GETUTCDATE()`);
   for(const row of wRes.recordset as Row[])activeHashes.add(str(row.SessionHash));
  }catch{/* live-session table is optional */}
 }
 return {logins,activityBySession,activeHashes,capped:cappedRows.length>REPORT_CAP,activitiesError};
}
