// Web activity log (Tbl_WebActivityLog): who did what inside the app.
// Written through ONE helper so the format is consistent. Logging must
// never break the underlying action, so every failure is swallowed with
// a server-side warning. Retention: rows older than 3 months are deleted
// automatically (once per process start, inside ensure).
import sql from 'mssql';
import {getPool} from '@/lib/db';

let tableReady:Promise<void>|null=null;
let lastRetentionRun=0;
const RETENTION_INTERVAL_MS=24*60*60*1000; // re-check once a day, not only at start
/** Delete rows older than 3 months. Runs at most once a day per process,
    so a long-running server cleans up even without a restart. */
async function runRetentionIfDue(pool:sql.ConnectionPool):Promise<void>{
 const now=Date.now();
 if(now-lastRetentionRun<RETENTION_INTERVAL_MS)return;
 lastRetentionRun=now;
 try{await pool.request().input('cutoff',sql.VarChar(10),retentionCutoff()).query('DELETE FROM dbo.Tbl_WebActivityLog WHERE ActivityAt < @cutoff')}
 catch(e){lastRetentionRun=0;console.warn('Activity retention cleanup failed:',e instanceof Error?e.name:'unknown')}
}
const colomboNow=()=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date());
 const get=(t:string)=>parts.find(x=>x.type===t)?.value??'00';
 return {text:`${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`,date:`${get('year')}-${get('month')}-${get('day')}`};
};
const retentionCutoff=()=>{
 const {date}=colomboNow();const d=new Date(date+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-3);
 return d.toISOString().slice(0,10);
};

export function ensureActivityTable():Promise<void>{
 if(!tableReady){
  tableReady=(async()=>{
   const pool=await getPool();
   await pool.request().input('cutoff',sql.VarChar(10),retentionCutoff()).query(`
IF OBJECT_ID(N'dbo.Tbl_WebActivityLog',N'U') IS NULL
CREATE TABLE dbo.Tbl_WebActivityLog(
 Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 ActivityAt DATETIME2(0) NOT NULL,
 UserId NVARCHAR(50) NOT NULL CONSTRAINT DF_WebActivity_UserId DEFAULT(''),
 LoginName NVARCHAR(100) NOT NULL CONSTRAINT DF_WebActivity_LoginName DEFAULT(''),
 UserName NVARCHAR(200) NOT NULL CONSTRAINT DF_WebActivity_UserName DEFAULT(''),
 LocationCode NVARCHAR(20) NOT NULL CONSTRAINT DF_WebActivity_Loc DEFAULT(''),
 Category NVARCHAR(30) NOT NULL CONSTRAINT DF_WebActivity_Category DEFAULT(''),
 Action NVARCHAR(50) NOT NULL CONSTRAINT DF_WebActivity_Action DEFAULT(''),
 TargetType NVARCHAR(50) NOT NULL CONSTRAINT DF_WebActivity_TargetType DEFAULT(''),
 TargetId NVARCHAR(100) NOT NULL CONSTRAINT DF_WebActivity_TargetId DEFAULT(''),
 TargetName NVARCHAR(200) NOT NULL CONSTRAINT DF_WebActivity_TargetName DEFAULT(''),
 Details NVARCHAR(1000) NOT NULL CONSTRAINT DF_WebActivity_Details DEFAULT(''),
 BeforeValue NVARCHAR(1000) NOT NULL CONSTRAINT DF_WebActivity_Before DEFAULT(''),
 AfterValue NVARCHAR(1000) NOT NULL CONSTRAINT DF_WebActivity_After DEFAULT(''),
 IpAddress NVARCHAR(45) NOT NULL CONSTRAINT DF_WebActivity_Ip DEFAULT(''),
 SessionRef NVARCHAR(64) NOT NULL CONSTRAINT DF_WebActivity_SessionRef DEFAULT('')
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_WebActivity_At' AND object_id=OBJECT_ID(N'dbo.Tbl_WebActivityLog'))
 CREATE INDEX IX_WebActivity_At ON dbo.Tbl_WebActivityLog(ActivityAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_WebActivity_User' AND object_id=OBJECT_ID(N'dbo.Tbl_WebActivityLog'))
 CREATE INDEX IX_WebActivity_User ON dbo.Tbl_WebActivityLog(LoginName,ActivityAt DESC);
DELETE FROM dbo.Tbl_WebActivityLog WHERE ActivityAt < @cutoff;`);
  })().catch(e=>{tableReady=null;throw e});
 }
 return tableReady;
}

export type ActivityActor={userId?:string;loginName?:string;userName?:string};
export type ActivityEntry={
 actor:ActivityActor;category:string;action:string;
 targetType?:string;targetId?:string;targetName?:string;
 details?:string;beforeValue?:string;afterValue?:string;
 locationCode?:string;ipAddress?:string;sessionRef?:string;
};
const clip=(v:unknown,n:number)=>String(v??'').slice(0,n);

export async function logActivity(entry:ActivityEntry):Promise<void>{
 try{
  await ensureActivityTable();
  const pool=await getPool();
  void runRetentionIfDue(pool);
  const req=pool.request();
  req.input('at',sql.VarChar(19),colomboNow().text);
  req.input('uid',sql.NVarChar(50),clip(entry.actor.userId,50));
  req.input('ln',sql.NVarChar(100),clip(entry.actor.loginName,100));
  req.input('un',sql.NVarChar(200),clip(entry.actor.userName,200));
  req.input('loc',sql.NVarChar(20),clip(entry.locationCode,20));
  req.input('cat',sql.NVarChar(30),clip(entry.category,30));
  req.input('act',sql.NVarChar(50),clip(entry.action,50));
  req.input('tt',sql.NVarChar(50),clip(entry.targetType,50));
  req.input('tid',sql.NVarChar(100),clip(entry.targetId,100));
  req.input('tn',sql.NVarChar(200),clip(entry.targetName,200));
  req.input('det',sql.NVarChar(1000),clip(entry.details,1000));
  req.input('bef',sql.NVarChar(1000),clip(entry.beforeValue,1000));
  req.input('aft',sql.NVarChar(1000),clip(entry.afterValue,1000));
  req.input('ip',sql.NVarChar(45),clip(entry.ipAddress,45));
  req.input('sr',sql.NVarChar(64),clip(entry.sessionRef,64));
  await req.query(`INSERT INTO dbo.Tbl_WebActivityLog
   (ActivityAt,UserId,LoginName,UserName,LocationCode,Category,Action,TargetType,TargetId,TargetName,Details,BeforeValue,AfterValue,IpAddress,SessionRef)
   VALUES (@at,@uid,@ln,@un,@loc,@cat,@act,@tt,@tid,@tn,@det,@bef,@aft,@ip,@sr)`);
 }catch(e){console.warn('Activity log failed:',e instanceof Error?e.name:'unknown')}
}

/** Convenience for routes that hold only the session cookie value. */
export async function logActivityForToken(token:string|undefined,entry:Omit<ActivityEntry,'actor'>):Promise<void>{
 try{
  if(!token)return;
  const {verifySessionValue,SESSION_COOKIE}=await import('@/lib/auth');
  void SESSION_COOKIE;
  const session=await verifySessionValue(token);
  if(session)await logActivity({...entry,actor:session});
 }catch{/* logging must never break the action */}
}
