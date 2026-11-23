// Hidden screen (not in the sidebar): /login-activity
// Shows every captured login attempt with all server-side context.
// Access is checked on the SERVER (users:VIEW) before any row is queried,
// so the data is never sent to a user without permission.
import sql from 'mssql';
import {cookies} from 'next/headers';
import {getSessionFromRequest} from '@/lib/session';
import {getPool} from '@/lib/db';
import {isUAdmin,verifyLoginActivityToken,LOGIN_ACTIVITY_COOKIE} from '@/lib/loginActivityGuard';
import LoginActivityReauth from '@/components/LoginActivityReauth';
import {ensureLoginAuditTable,cleanIp} from '@/lib/loginAudit';
import {ensureActivityTable} from '@/lib/activityLog';

export const dynamic='force-dynamic';

type Row=Record<string,unknown>;
const str=(v:unknown)=>v===null||v===undefined?'':String(v).trim();
const fmtTime=(v:unknown)=>{
 if(v instanceof Date)return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(v);
 return str(v).slice(0,19);
};
const box:React.CSSProperties={border:'1px solid #e5ddd2',borderRadius:12,padding:'12px 14px',background:'#fffdf9'};
const small:React.CSSProperties={fontSize:12,color:'#6b5d4f',lineHeight:1.5};

const CAT_LABEL:Record<string,string>={PERMISSION:'Permissions',USER:'User management',SECURITY:'Security',MASTER_DATA:'Master data',REPORT:'Reports',SESSION:'Sessions'};
const CAT_STYLE:Record<string,{bg:string;fg:string}>={PERMISSION:{bg:'#fde8e0',fg:'#8a3b12'},USER:{bg:'#e5e9fb',fg:'#31408a'},SECURITY:{bg:'#fbe7e3',fg:'#8a2f23'},MASTER_DATA:{bg:'#e3f2e4',fg:'#256b2e'},REPORT:{bg:'#fdf0d5',fg:'#7a5a12'},SESSION:{bg:'#ece7f5',fg:'#4c3575'}};
const tabBtn=(active:boolean):React.CSSProperties=>({padding:'8px 16px',borderRadius:999,fontSize:13,fontWeight:700,textDecoration:'none',border:'1px solid #d8cbb8',background:active?'#b46a28':'#fffdf9',color:active?'#fff':'#684830'});

async function ActivitySection({q,userFilter,category,from,to}:{q:string;userFilter:string;category:string;from:string;to:string}){
 let rows:Row[]=[];let loadError='';let userOptions:{login:string;name:string;count:number}[]=[];let total=0;
 try{
  await ensureActivityTable();
  const pool=await getPool();const req=pool.request();
  let where='WHERE 1=1';
  if(from){where+=' AND ActivityAt>=@from';req.input('from',sql.VarChar(10),from)}
  if(to){where+=' AND ActivityAt<DATEADD(day,1,CONVERT(date,@to,23))';req.input('to',sql.VarChar(10),to)}
  if(category&&CAT_LABEL[category]){where+=' AND Category=@cat';req.input('cat',sql.NVarChar(30),category)}
  if(userFilter){where+=' AND LoginName=@userSel';req.input('userSel',sql.NVarChar(100),userFilter)}
  if(q){where+=' AND (LoginName LIKE @q OR UserName LIKE @q OR Action LIKE @q OR TargetName LIKE @q OR TargetId LIKE @q OR Details LIKE @q)';req.input('q',sql.NVarChar(200),'%'+q+'%')}
  try{const uRes=await pool.request().query(`SELECT LoginName,MAX(UserName) AS UserName,COUNT(*) AS Cnt FROM dbo.Tbl_WebActivityLog GROUP BY LoginName ORDER BY COUNT(*) DESC`);
   userOptions=(uRes.recordset as Row[]).map(r=>({login:str(r.LoginName),name:str(r.UserName),count:Number(r.Cnt)||0}));
   const tRes=await pool.request().query('SELECT COUNT(*) AS Cnt FROM dbo.Tbl_WebActivityLog');total=Number((tRes.recordset as Row[])[0]?.Cnt)||0;
  }catch{/* lists are optional */}
  const res=await req.query(`SELECT TOP 300 Id,ActivityAt,UserId,LoginName,UserName,LocationCode,Category,Action,TargetType,TargetId,TargetName,Details,BeforeValue,AfterValue,IpAddress,SessionRef FROM dbo.Tbl_WebActivityLog ${where} ORDER BY ActivityAt DESC,Id DESC`);
  rows=res.recordset as Row[];
 }catch(e){console.error('Activity log load failed:',e instanceof Error?e.message:e);loadError='Activity data could not be loaded.'}

 return <div>
  <form method="get" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
   <input type="hidden" name="tab" value="activity"/>
   <input name="q" defaultValue={q} placeholder="Search action, target, details…" style={{flex:'1 1 220px',padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8'}}/>
   <select name="user" defaultValue={userFilter} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8',maxWidth:240}}>
    <option value="">All users</option>
    {userOptions.map(u=><option key={u.login} value={u.login}>{u.name?`${u.name} (${u.login})`:u.login} · {u.count}</option>)}
   </select>
   <select name="category" defaultValue={category} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8'}}>
    <option value="">All categories</option>
    {Object.entries(CAT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
   </select>
   <input type="date" name="from" defaultValue={from} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8'}}/>
   <input type="date" name="to" defaultValue={to} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8'}}/>
   <button type="submit" style={{padding:'9px 18px',borderRadius:9,border:0,background:'#b46a28',color:'#fff',fontWeight:600,cursor:'pointer'}}>Filter</button>
  </form>
  <p style={{...small,margin:'0 0 12px'}}>{total} records stored. Records older than 3 months are deleted automatically. Passwords are never recorded.</p>
  {loadError?<div style={{...box,color:'#8a2f23'}}>{loadError}</div>:rows.length===0?<div style={box}>No activity records match. Records are created when users change data, are denied access, view or export reports, or manage users and permissions.</div>:
  <div style={{display:'flex',flexDirection:'column',gap:10}}>
   {rows.map((r,idx)=>{
    const cat=str(r.Category);const cs=CAT_STYLE[cat]??{bg:'#eee7db',fg:'#5c4c3a'};
    const dayKey=fmtTime(r.ActivityAt).slice(0,11);
    const prevDay=idx>0?fmtTime(rows[idx-1].ActivityAt).slice(0,11):'';
    return <div key={str(r.Id)}>
     {dayKey!==prevDay&&<div style={{fontSize:12,fontWeight:700,color:'#8a6a45',letterSpacing:'.05em',textTransform:'uppercase',margin:idx===0?'0 0 2px':'10px 0 2px'}}>{dayKey}</div>}
     <article style={box}>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
       <span style={{fontSize:11,fontWeight:700,padding:'4px 9px',borderRadius:999,background:cs.bg,color:cs.fg}}>{CAT_LABEL[cat]??cat}</span>
       <strong style={{fontSize:13.5}}>{str(r.Action).replace(/_/g,' ')}</strong>
       <span style={small}>by {str(r.UserName)||str(r.LoginName)} ({str(r.LoginName)}){str(r.LocationCode)?` · Branch ${str(r.LocationCode)}`:''} · {fmtTime(r.ActivityAt)}</span>
      </div>
      {(str(r.TargetName)||str(r.TargetId))&&<div style={{...small,marginTop:6}}><b>Target:</b> {str(r.TargetName)||str(r.TargetId)}{str(r.TargetName)&&str(r.TargetId)?` (${str(r.TargetId)})`:''}{str(r.TargetType)?` · ${str(r.TargetType)}`:''}</div>}
      {str(r.Details)&&<div style={{...small,marginTop:4,overflowWrap:'anywhere'}}>{str(r.Details)}</div>}
      {(str(r.BeforeValue)||str(r.AfterValue))&&<div style={{...small,marginTop:4}}><b>Before:</b> {str(r.BeforeValue)||'—'}<br/><b>After:</b> {str(r.AfterValue)||'—'}</div>}
      <div style={{...small,marginTop:4}}>{str(r.IpAddress)?`IP: ${str(r.IpAddress)}`:''}{str(r.SessionRef)?` · Session: ${str(r.SessionRef).slice(0,12)}…`:''}</div>
     </article>
    </div>;
   })}
  </div>}
 </div>;
}

export default async function LoginActivityPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const sp=await searchParams;
 const one=(k:string)=>{const v=sp[k];return typeof v==='string'?v.trim():''};
 const q=one('q'),result=one('result'),from=one('from'),to=one('to'),userFilter=one('user');
 const session=await getSessionFromRequest();
 if(!session)return <main style={{padding:24}}><h1>Login Activity</h1><p>Please sign in again.</p></main>;
 // Restricted screen: UADMIN only (everyone else gets a plain not-found),
 // and UADMIN must re-authenticate on every visit (10-minute window).
 if(!isUAdmin(session))return <main style={{padding:24}}><h1 style={{fontSize:20}}>Page not found</h1><p>The page you are looking for does not exist.</p></main>;
 const reauth=(await cookies()).get(LOGIN_ACTIVITY_COOKIE)?.value;
 if(!verifyLoginActivityToken(reauth,session))return <main style={{padding:24}}><LoginActivityReauth/></main>;
 const tab=one('tab')==='activity'?'activity':'logins';
 const category=one('category');
 if(tab==='activity')return <main style={{padding:'22px 20px 40px',maxWidth:1150,margin:'0 auto',fontFamily:'inherit'}}>
  <h1 style={{margin:'0 0 4px',fontSize:24}}>Login Activity</h1>
  <div style={{display:'flex',gap:8,margin:'10px 0 18px'}}>
   <a href="/login-activity?tab=logins" style={tabBtn(false)}>Logins</a>
   <a href="/login-activity?tab=activity" style={tabBtn(true)}>Activity</a>
  </div>
  <ActivitySection q={q} userFilter={userFilter} category={category} from={from} to={to}/>
 </main>;

 let rows:Row[]=[];let loadError='';let userOptions:{login:string;name:string;count:number}[]=[];
 try{
  await ensureLoginAuditTable();
  const pool=await getPool();
  const req=pool.request();
  let where='WHERE 1=1';
  if(from){where+=' AND LoginAt>=@from';req.input('from',sql.VarChar(10),from)}
  if(to){where+=' AND LoginAt<DATEADD(day,1,CONVERT(date,@to,23))';req.input('to',sql.VarChar(10),to)}
  if(result==='success'){where+=' AND Success=1'}
  if(result==='failed'){where+=' AND Success=0'}
  if(q){where+=' AND (LoginName LIKE @q OR ISNULL(UserName,\'\') LIKE @q OR ISNULL(IpAddress,\'\') LIKE @q OR ISNULL(GeoCity,\'\') LIKE @q OR ISNULL(DeviceModel,\'\') LIKE @q)';req.input('q',sql.NVarChar(200),'%'+q+'%')}
  try{const uRes=await pool.request().query(`SELECT LoginName,MAX(ISNULL(UserName,'')) AS UserName,COUNT(*) AS Cnt FROM dbo.Tbl_UserLoginAudit GROUP BY LoginName ORDER BY COUNT(*) DESC`);
   userOptions=(uRes.recordset as Row[]).map(r=>({login:str(r.LoginName),name:str(r.UserName),count:Number(r.Cnt)||0}));}catch{/* user list is optional */}
  if(userFilter){where+=' AND LoginName=@userSel';req.input('userSel',sql.NVarChar(100),userFilter)}
  const res=await req.query(`SELECT TOP 300 Id,LoginAt,UserId,LoginName,UserName,Success,FailReason,IpAddress,ForwardedFor,GeoCountry,GeoRegion,GeoCity,GeoLatitude,GeoLongitude,GeoTimezone,Isp,ConnectionType,IsVpnOrProxy,DeviceType,DeviceModel,Browser,BrowserVersion,OsName,OsVersion,AcceptLanguage,ClientHints,UserAgent,LocationCode,SessionRef,IsNewDevice,IsNewLocation,GeoSource FROM dbo.Tbl_UserLoginAudit ${where} ORDER BY LoginAt DESC,Id DESC`);
  rows=res.recordset as Row[];
 }catch(e){console.error('Login activity load failed:',e instanceof Error?e.message:e);loadError='Login audit data could not be loaded. If this is the first use, the audit table will be created automatically on the next login attempt.'}

 const shown=rows.length,okCount=rows.filter(r=>r.Success).length,failCount=shown-okCount;
 const uniqueUsers=new Set(rows.map(r=>str(r.LoginName).toLowerCase())).size;
 const newDevices=rows.filter(r=>r.IsNewDevice).length;

 return <main style={{padding:'22px 20px 40px',maxWidth:1150,margin:'0 auto',fontFamily:'inherit'}}>
  <h1 style={{margin:'0 0 4px',fontSize:24}}>Login Activity</h1>
  <div style={{display:'flex',gap:8,margin:'10px 0 18px'}}>
   <a href="/login-activity?tab=logins" style={tabBtn(true)}>Logins</a>
   <a href="/login-activity?tab=activity" style={tabBtn(false)}>Activity</a>
  </div>

  <form method="get" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
   <input name="q" defaultValue={q} placeholder="Search user, IP, city, device…" style={{flex:'1 1 220px',padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8'}}/>
   <select name="user" defaultValue={userFilter} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8',maxWidth:240}}>
    <option value="">All users</option>
    {userOptions.map(u=><option key={u.login} value={u.login}>{u.name?`${u.name} (${u.login})`:u.login} · {u.count}</option>)}
   </select>
   <select name="result" defaultValue={result} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8'}}>
    <option value="">All results</option><option value="success">Successful</option><option value="failed">Failed</option>
   </select>
   <input type="date" name="from" defaultValue={from} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8'}}/>
   <input type="date" name="to" defaultValue={to} style={{padding:'9px 12px',borderRadius:9,border:'1px solid #d8cbb8'}}/>
   <button type="submit" style={{padding:'9px 18px',borderRadius:9,border:0,background:'#b46a28',color:'#fff',fontWeight:600,cursor:'pointer'}}>Filter</button>
  </form>

  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
   {[['Shown',shown],['Successful',okCount],['Failed',failCount],['Users',uniqueUsers],['New devices',newDevices]].map(([label,v])=>(
    <div key={label} style={{...box,padding:'10px 16px'}}><div style={{fontSize:11,color:'#8a7a68',textTransform:'uppercase',letterSpacing:'.06em'}}>{label}</div><div style={{fontSize:20,fontWeight:700}}>{v}</div></div>
   ))}
  </div>

  {userFilter&&rows.length>0&&<p style={{...small,margin:'0 0 12px'}}>Showing logins for <b>{userFilter}</b> — latest first. Last activity: {fmtTime(rows[0].LoginAt)}.</p>}
  {loadError?<div style={{...box,color:'#8a2f23'}}>{loadError}</div>:rows.length===0?<div style={box}>No login records match. Records are created automatically at sign-in.</div>:
  <div style={{display:'flex',flexDirection:'column',gap:10}}>
   {rows.map((r,idx)=>{
    const ok=!!r.Success;
    const loc=[str(r.GeoCity),str(r.GeoRegion),str(r.GeoCountry)].filter(Boolean).join(', ');
    const ipStr=cleanIp(str(r.IpAddress));
    const ipPrivate=!ipStr||ipStr==='unknown'||ipStr.startsWith('192.168.')||ipStr.startsWith('10.')||ipStr.startsWith('127.')||/^172\.(1[6-9]|2\d|3[01])\./.test(ipStr)||ipStr.startsWith('::1')||ipStr.toLowerCase().startsWith('fe80');
    const via=str(r.ForwardedFor).split(',').map(x=>x.trim()).filter((x,i,a)=>x&&x!==ipStr&&a.indexOf(x)===i).join(', ');
    const devIcon=str(r.DeviceType)==='Mobile'?'📱':str(r.DeviceType)==='Tablet'?'📲':'🖥️';
    const dayKey=fmtTime(r.LoginAt).slice(0,11);
    const prevDay=idx>0?fmtTime(rows[idx-1].LoginAt).slice(0,11):'';
    return <div key={str(r.Id)}>
     {dayKey!==prevDay&&<div style={{fontSize:12,fontWeight:700,color:'#8a6a45',letterSpacing:'.05em',textTransform:'uppercase',margin:idx===0?'0 0 2px':'10px 0 2px'}}>{dayKey}</div>}
     <article style={box}>
     <div style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div style={{fontSize:22}} aria-hidden="true">{devIcon}</div>
      <div style={{flex:'1 1 260px',minWidth:230}}>
       <strong>{str(r.UserName)||str(r.LoginName)}</strong> <span style={small}>({str(r.LoginName)}{str(r.UserId)?` · ID ${str(r.UserId)}`:''})</span>
       <div style={small}>{loc||(ipPrivate?'Local / private network':'Location unavailable')}{str(r.LocationCode)?` · Branch ${str(r.LocationCode)}`:''}</div>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
       <span style={{fontSize:11,fontWeight:700,padding:'4px 9px',borderRadius:999,background:ok?'#e3f2e4':'#fbe7e3',color:ok?'#256b2e':'#8a2f23'}}>{ok?'SUCCESS':'FAILED'}</span>
       {!!r.IsNewDevice&&<span style={{fontSize:11,fontWeight:700,padding:'4px 9px',borderRadius:999,background:'#fdf0d5',color:'#7a5a12'}}>NEW DEVICE</span>}
       {!!r.IsNewLocation&&<span style={{fontSize:11,fontWeight:700,padding:'4px 9px',borderRadius:999,background:'#e5e9fb',color:'#31408a'}}>NEW LOCATION</span>}
      </div>
     </div>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:'6px 18px',marginTop:10,...small}}>
      <span><b>Time:</b> {fmtTime(r.LoginAt)}</span>
      <span><b>IP:</b> {ipStr||'-'}{via?` (via ${via})`:''}</span>
      <span><b>Approx. location:</b> {loc||'-'}{Number(r.GeoLatitude)!==0?` (${str(r.GeoLatitude)}, ${str(r.GeoLongitude)})`:''}{str(r.GeoSource)?` · via ${str(r.GeoSource)}`:''}</span>
      <span><b>ISP:</b> {str(r.Isp)||'-'}{str(r.ConnectionType)?` · ${str(r.ConnectionType)}`:''}{str(r.GeoTimezone)?` · ${str(r.GeoTimezone)}`:''}</span>
      <span><b>Device:</b> {str(r.DeviceType)}{str(r.DeviceModel)?` · ${str(r.DeviceModel)}`:''}</span>
      <span><b>Browser:</b> {str(r.Browser)} {str(r.BrowserVersion)}</span>
      <span><b>OS:</b> {str(r.OsName)} {str(r.OsVersion)}</span>
      <span><b>Language:</b> {str(r.AcceptLanguage)||'-'}</span>
      {!ok&&<span><b>Reason:</b> {str(r.FailReason)||'-'}</span>}
      {str(r.SessionRef)?<span><b>Session:</b> {str(r.SessionRef).slice(0,12)}…</span>:null}
     </div>
     {str(r.UserAgent)&&<details style={{marginTop:8}}><summary style={{...small,cursor:'pointer'}}>Technical details</summary>
      <div style={{...small,overflowWrap:'anywhere',marginTop:4}}>User-Agent: {str(r.UserAgent)}{str(r.ClientHints)?<><br/>Client hints: {str(r.ClientHints)}</>:null}</div>
     </details>}
     </article>
    </div>;
   })}
  </div>}
 </main>;
}
