// Login audit: records every sign-in attempt (success and failure) with the
// network/device context available server-side - the same kind of data
// Google-style "login activity" screens show. Capture must NEVER break or
// meaningfully slow the login itself: every failure here is swallowed.
import sql from 'mssql';
import {getPool} from '@/lib/db';
import {clientIp} from '@/lib/rateLimit';

let tableReady:Promise<void>|null=null;
export function ensureLoginAuditTable():Promise<void>{
 if(!tableReady){
  tableReady=(async()=>{
   const pool=await getPool();
   await pool.request().query(`
IF OBJECT_ID(N'dbo.Tbl_UserLoginAudit',N'U') IS NULL
CREATE TABLE dbo.Tbl_UserLoginAudit(
 Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 LoginAt DATETIME2(0) NOT NULL,
 UserId NVARCHAR(50) NOT NULL CONSTRAINT DF_LoginAudit_UserId DEFAULT(''),
 LoginName NVARCHAR(100) NOT NULL,
 UserName NVARCHAR(200) NOT NULL CONSTRAINT DF_LoginAudit_UserName DEFAULT(''),
 Success BIT NOT NULL,
 FailReason NVARCHAR(200) NOT NULL CONSTRAINT DF_LoginAudit_FailReason DEFAULT(''),
 IpAddress NVARCHAR(45) NOT NULL CONSTRAINT DF_LoginAudit_Ip DEFAULT(''),
 ForwardedFor NVARCHAR(500) NOT NULL CONSTRAINT DF_LoginAudit_Fwd DEFAULT(''),
 GeoCountry NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_GeoCountry DEFAULT(''),
 GeoRegion NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_GeoRegion DEFAULT(''),
 GeoCity NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_GeoCity DEFAULT(''),
 GeoLatitude DECIMAL(9,6) NOT NULL CONSTRAINT DF_LoginAudit_GeoLat DEFAULT(0),
 GeoLongitude DECIMAL(9,6) NOT NULL CONSTRAINT DF_LoginAudit_GeoLon DEFAULT(0),
 GeoTimezone NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_GeoTz DEFAULT(''),
 Isp NVARCHAR(200) NOT NULL CONSTRAINT DF_LoginAudit_Isp DEFAULT(''),
 ConnectionType NVARCHAR(50) NOT NULL CONSTRAINT DF_LoginAudit_ConnType DEFAULT(''),
 IsVpnOrProxy BIT NOT NULL CONSTRAINT DF_LoginAudit_Vpn DEFAULT(0),
 DeviceType NVARCHAR(30) NOT NULL CONSTRAINT DF_LoginAudit_DeviceType DEFAULT(''),
 DeviceModel NVARCHAR(150) NOT NULL CONSTRAINT DF_LoginAudit_DeviceModel DEFAULT(''),
 Browser NVARCHAR(80) NOT NULL CONSTRAINT DF_LoginAudit_Browser DEFAULT(''),
 BrowserVersion NVARCHAR(40) NOT NULL CONSTRAINT DF_LoginAudit_BrowserVer DEFAULT(''),
 OsName NVARCHAR(80) NOT NULL CONSTRAINT DF_LoginAudit_OsName DEFAULT(''),
 OsVersion NVARCHAR(40) NOT NULL CONSTRAINT DF_LoginAudit_OsVer DEFAULT(''),
 AcceptLanguage NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_Lang DEFAULT(''),
 ClientHints NVARCHAR(500) NOT NULL CONSTRAINT DF_LoginAudit_Hints DEFAULT(''),
 UserAgent NVARCHAR(1000) NOT NULL CONSTRAINT DF_LoginAudit_Ua DEFAULT(''),
 DeviceKey NVARCHAR(200) NOT NULL CONSTRAINT DF_LoginAudit_DeviceKey DEFAULT(''),
 LocationCode NVARCHAR(20) NOT NULL CONSTRAINT DF_LoginAudit_Loc DEFAULT(''),
 SessionRef NVARCHAR(64) NOT NULL CONSTRAINT DF_LoginAudit_SessionRef DEFAULT(''),
 IsNewDevice BIT NOT NULL CONSTRAINT DF_LoginAudit_NewDevice DEFAULT(0),
 IsNewLocation BIT NOT NULL CONSTRAINT DF_LoginAudit_NewLocation DEFAULT(0),
 GeoSource NVARCHAR(50) NOT NULL CONSTRAINT DF_LoginAudit_GeoSource DEFAULT('')
);
-- Remove columns that are no longer used (browser-GPS was dropped).
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','PreciseLatitude') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN PreciseLatitude;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','PreciseLongitude') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN PreciseLongitude;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','PreciseAccuracyM') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN PreciseAccuracyM;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','PreciseLabel') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN PreciseLabel;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','LocationSource') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN LocationSource;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','GeoSource') IS NULL ALTER TABLE dbo.Tbl_UserLoginAudit ADD GeoSource NVARCHAR(50) NOT NULL CONSTRAINT DF_LoginAudit_GeoSource DEFAULT('');
-- No NULLs anywhere: backfill existing rows, then lock the columns down.
UPDATE dbo.Tbl_UserLoginAudit SET UserId=ISNULL(UserId,''),UserName=ISNULL(UserName,''),FailReason=ISNULL(FailReason,''),IpAddress=ISNULL(IpAddress,''),ForwardedFor=ISNULL(ForwardedFor,''),GeoCountry=ISNULL(GeoCountry,''),GeoRegion=ISNULL(GeoRegion,''),GeoCity=ISNULL(GeoCity,''),GeoLatitude=ISNULL(GeoLatitude,0),GeoLongitude=ISNULL(GeoLongitude,0),GeoTimezone=ISNULL(GeoTimezone,''),Isp=ISNULL(Isp,''),ConnectionType=ISNULL(ConnectionType,''),IsVpnOrProxy=ISNULL(IsVpnOrProxy,0),DeviceType=ISNULL(DeviceType,''),DeviceModel=ISNULL(DeviceModel,''),Browser=ISNULL(Browser,''),BrowserVersion=ISNULL(BrowserVersion,''),OsName=ISNULL(OsName,''),OsVersion=ISNULL(OsVersion,''),AcceptLanguage=ISNULL(AcceptLanguage,''),ClientHints=ISNULL(ClientHints,''),UserAgent=ISNULL(UserAgent,''),DeviceKey=ISNULL(DeviceKey,''),LocationCode=ISNULL(LocationCode,''),SessionRef=ISNULL(SessionRef,''),GeoSource=ISNULL(GeoSource,'');
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN UserId NVARCHAR(50) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN UserName NVARCHAR(200) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN FailReason NVARCHAR(200) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN IpAddress NVARCHAR(45) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN ForwardedFor NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoCountry NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoRegion NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoCity NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoLatitude DECIMAL(9,6) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoLongitude DECIMAL(9,6) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoTimezone NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN Isp NVARCHAR(200) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN ConnectionType NVARCHAR(50) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN IsVpnOrProxy BIT NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN DeviceType NVARCHAR(30) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN DeviceModel NVARCHAR(150) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN Browser NVARCHAR(80) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN BrowserVersion NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN OsName NVARCHAR(80) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN OsVersion NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN AcceptLanguage NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN ClientHints NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN UserAgent NVARCHAR(1000) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN DeviceKey NVARCHAR(200) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN LocationCode NVARCHAR(20) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN SessionRef NVARCHAR(64) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoSource NVARCHAR(50) NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_LoginAudit_LoginAt' AND object_id=OBJECT_ID(N'dbo.Tbl_UserLoginAudit'))
 CREATE INDEX IX_LoginAudit_LoginAt ON dbo.Tbl_UserLoginAudit(LoginAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_LoginAudit_LoginName' AND object_id=OBJECT_ID(N'dbo.Tbl_UserLoginAudit'))
 CREATE INDEX IX_LoginAudit_LoginName ON dbo.Tbl_UserLoginAudit(LoginName,LoginAt DESC);`);
  })().catch(e=>{tableReady=null;throw e});
 }
 return tableReady;
}

const colomboNow=()=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date());
 const get=(t:string)=>parts.find(x=>x.type===t)?.value??'00';
 return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
};

export function parseUserAgent(ua:string){
 const s=ua||'';
 let browser='Unknown',browserVersion='';
 const pick=(re:RegExp,name:string)=>{const m=re.exec(s);if(m){browser=name;browserVersion=m[1];return true}return false};
 pick(/Edg\/([\d.]+)/,'Edge')||pick(/SamsungBrowser\/([\d.]+)/,'Samsung Internet')||pick(/Firefox\/([\d.]+)/,'Firefox')||pick(/Chrome\/([\d.]+)/,'Chrome')||pick(/Version\/([\d.]+).*Safari/,'Safari');
 let osName='Unknown',osVersion='';
 const win=/Windows NT ([\d.]+)/.exec(s); const andr=/Android ([\d.]+)/.exec(s);
 const ios=/(?:iPhone|iPad|iPod).*OS ([\d_]+)/.exec(s); const mac=/Mac OS X ([\d_]+)/.exec(s);
 if(win){osName='Windows';osVersion=win[1]==='10.0'?'10/11':win[1]}
 else if(andr){osName='Android';osVersion=andr[1]}
 else if(ios){osName='iOS';osVersion=ios[1].replace(/_/g,'.')}
 else if(mac){osName='macOS';osVersion=mac[1].replace(/_/g,'.')}
 else if(/Linux/.test(s)){osName='Linux'}
 const deviceType=/iPad|Tablet/i.test(s)?'Tablet':/Mobile|Android.*Mobile|iPhone/i.test(s)?'Mobile':'Desktop';
 const deviceModel=/Android[^;]*;\s*([^;)]+)\)/.exec(s)?.[1]?.trim().slice(0,150)||(/iPhone/.test(s)?'iPhone':/iPad/.test(s)?'iPad':'');
 return {browser,browserVersion,osName,osVersion,deviceType,deviceModel};
}

// Proxies on some hosts forward the client as "ip:port" (and Node shows
// IPv4 as "::ffff:a.b.c.d"). Strip that before storing or geolocating,
// otherwise the geo lookup rejects the address and location stays empty.
export function cleanIp(raw:string):string{
 let s=(raw??'').trim();
 if(!s||s.toLowerCase()==='unknown')return 'unknown';
 const bracket=/^\[(.+)\](?::\d+)?$/.exec(s); if(bracket)s=bracket[1];
 if(s.toLowerCase().startsWith('::ffff:'))s=s.slice(7);
 const v4port=/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(s); if(v4port)return v4port[1];
 if(s.includes('.')&&s.split(':').length===2)return s.split(':')[0];
 return s;
}

const isPrivateIp=(ip:string)=>{
 if(!ip||ip==='unknown')return true;
 if(ip==='::1'||ip.startsWith('127.')||ip.startsWith('10.')||ip.startsWith('192.168.')||ip.startsWith('169.254.'))return true;
 const m=/^172\.(\d+)\./.exec(ip); if(m&&Number(m[1])>=16&&Number(m[1])<=31)return true;
 return ip.toLowerCase().startsWith('fc')||ip.toLowerCase().startsWith('fd')||ip.toLowerCase().startsWith('fe80');
};

type GeoResult={country:string;region:string;city:string;latitude:number|null;longitude:number|null;timezone:string;isp:string;connectionType:string;isProxy:boolean|null;source:string};
async function lookupGeo(ip:string):Promise<GeoResult|null>{
 const empty:GeoResult={country:'',region:'',city:'',latitude:null,longitude:null,timezone:'',isp:'',connectionType:'',isProxy:null,source:''};
 try{
  const res=await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`,{signal:AbortSignal.timeout(2000)});
  if(res.ok){const j=await res.json() as Record<string,unknown>;
   if(j&&j.success!==false){const conn=(j.connection??{}) as Record<string,unknown>;
    return {...empty,country:String(j.country??'').slice(0,100),region:String(j.region??'').slice(0,100),city:String(j.city??'').slice(0,100),latitude:typeof j.latitude==='number'?j.latitude:null,longitude:typeof j.longitude==='number'?j.longitude:null,timezone:String(((j.timezone??{}) as Record<string,unknown>).id??'').slice(0,100),isp:String(conn.isp??conn.org??'').slice(0,200),connectionType:String(j.type??'').slice(0,50),source:'ipwho.is'};}}
 }catch{/* try next provider */}
 try{
  const res=await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`,{signal:AbortSignal.timeout(2500)});
  if(res.ok){const j=await res.json() as Record<string,unknown>;
   if(j&&!j.error){return {...empty,country:String(j.country_name??'').slice(0,100),region:String(j.region??'').slice(0,100),city:String(j.city??'').slice(0,100),latitude:typeof j.latitude==='number'?j.latitude:null,longitude:typeof j.longitude==='number'?j.longitude:null,timezone:String(j.timezone??'').slice(0,100),isp:String(j.org??'').slice(0,200),source:'ipapi.co'};}}
 }catch{/* try next provider */}
 try{
  const res=await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,lat,lon,isp,timezone,mobile,proxy`,{signal:AbortSignal.timeout(2500)});
  if(res.ok){const j=await res.json() as Record<string,unknown>;
   if(j&&j.status==='success'){return {...empty,country:String(j.country??'').slice(0,100),region:String(j.regionName??'').slice(0,100),city:String(j.city??'').slice(0,100),latitude:typeof j.lat==='number'?j.lat:null,longitude:typeof j.lon==='number'?j.lon:null,timezone:String(j.timezone??'').slice(0,100),isp:String(j.isp??'').slice(0,200),connectionType:j.mobile===true?'Mobile':j.mobile===false?'Broadband':'',isProxy:typeof j.proxy==='boolean'?j.proxy:null,source:'ip-api.com'};}}
 }catch{/* no provider answered */}
 return null;
}
export type LoginAuditInfo={loginName:string;userId?:string;userName?:string;success:boolean;failReason?:string;locationCode?:string;sessionRef?:string};

export async function captureLoginAudit(headers:Headers,info:LoginAuditInfo):Promise<void>{
 try{
  await ensureLoginAuditTable();
  const pool=await getPool();
  const ip=cleanIp(clientIp(headers));
  const forwarded=(headers.get('x-forwarded-for')??'').split(',').map(x=>cleanIp(x)).filter(x=>x&&x!=='unknown').join(', ').slice(0,500);
  const ua=(headers.get('user-agent')??'').slice(0,1000);
  const parsed=parseUserAgent(ua);
  // High-entropy Client Hints (requested via Accept-CH in next.config):
  // Chrome's reduced User-Agent hides the real model ("K") and freezes the
  // Android version, so prefer the hint values when the browser sent them.
  const hintModel=(headers.get('sec-ch-ua-model')??'').replace(/^"|"$/g,'').trim();
  if(hintModel)parsed.deviceModel=hintModel.slice(0,150);
  const hintPlatformVersion=(headers.get('sec-ch-ua-platform-version')??'').replace(/^"|"$/g,'').trim();
  if(hintPlatformVersion)parsed.osVersion=hintPlatformVersion.slice(0,40);
  const deviceKey=`${parsed.browser}|${parsed.osName}|${parsed.deviceType}`.slice(0,200);
  const geo=isPrivateIp(ip)?null:await lookupGeo(ip);
  // New device / new location: compare with this account's earlier successes.
  let isNewDevice=false,isNewLocation=false;
  if(info.success){
   try{
    const prev=await pool.request().input('ln',sql.NVarChar(100),info.loginName).input('dk',sql.NVarChar(200),deviceKey).input('city',sql.NVarChar(100),geo?.city??'')
     .query(`SELECT
       (SELECT COUNT(*) FROM dbo.Tbl_UserLoginAudit WHERE LoginName=@ln AND Success=1) AS TotalPrev,
       (SELECT COUNT(*) FROM dbo.Tbl_UserLoginAudit WHERE LoginName=@ln AND Success=1 AND DeviceKey=@dk) AS SameDevice,
       (SELECT COUNT(*) FROM dbo.Tbl_UserLoginAudit WHERE LoginName=@ln AND Success=1 AND ISNULL(GeoCity,'')=@city) AS SameCity`);
    const row=prev.recordset[0];
    if(row&&Number(row.TotalPrev)>0){isNewDevice=Number(row.SameDevice)===0;isNewLocation=!!geo?.city&&Number(row.SameCity)===0}
   }catch{/* flags are best-effort */}
  }
  const req=pool.request();
  req.input('at',sql.VarChar(19),colomboNow());
  req.input('uid',sql.NVarChar(50),info.userId??'');
  req.input('ln',sql.NVarChar(100),info.loginName.slice(0,100));
  req.input('un',sql.NVarChar(200),info.userName??'');
  req.input('ok',sql.Bit,info.success?1:0);
  req.input('fr',sql.NVarChar(200),info.success?'':(info.failReason??'Failed').slice(0,200));
  req.input('ip',sql.NVarChar(45),ip.slice(0,45));
  req.input('ff',sql.NVarChar(500),forwarded);
  req.input('gc',sql.NVarChar(100),geo?.country??'');req.input('gr',sql.NVarChar(100),geo?.region??'');req.input('gcity',sql.NVarChar(100),geo?.city??'');
  req.input('gla',sql.Decimal(9,6),geo?.latitude??0);req.input('glo',sql.Decimal(9,6),geo?.longitude??0);
  req.input('gtz',sql.NVarChar(100),geo?.timezone??'');req.input('isp',sql.NVarChar(200),geo?.isp??'');
  req.input('ct',sql.NVarChar(50),geo?.connectionType??'');req.input('vpn',sql.Bit,geo?.isProxy?1:0);
  req.input('dt',sql.NVarChar(30),parsed.deviceType);req.input('dm',sql.NVarChar(150),parsed.deviceModel);
  req.input('br',sql.NVarChar(80),parsed.browser);req.input('bv',sql.NVarChar(40),parsed.browserVersion);
  req.input('os',sql.NVarChar(80),parsed.osName);req.input('ov',sql.NVarChar(40),parsed.osVersion);
  req.input('al',sql.NVarChar(100),(headers.get('accept-language')??'').slice(0,100));
  const hints=['sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform','sec-ch-ua-model'].map(h=>{const v=headers.get(h);return v?`${h}: ${v}`:null}).filter(Boolean).join('; ').slice(0,500);
  req.input('ch',sql.NVarChar(500),hints);
  req.input('ua',sql.NVarChar(1000),ua);
  req.input('dk',sql.NVarChar(200),deviceKey);
  req.input('loc',sql.NVarChar(20),info.locationCode??'');
  req.input('sr',sql.NVarChar(64),info.sessionRef??'');
  req.input('nd',sql.Bit,isNewDevice?1:0);req.input('nl',sql.Bit,isNewLocation?1:0);
  req.input('gsrc',sql.NVarChar(50),geo?.source??'');
  await req.query(`INSERT INTO dbo.Tbl_UserLoginAudit
   (LoginAt,UserId,LoginName,UserName,Success,FailReason,IpAddress,ForwardedFor,GeoCountry,GeoRegion,GeoCity,GeoLatitude,GeoLongitude,GeoTimezone,Isp,ConnectionType,IsVpnOrProxy,DeviceType,DeviceModel,Browser,BrowserVersion,OsName,OsVersion,AcceptLanguage,ClientHints,UserAgent,DeviceKey,LocationCode,SessionRef,IsNewDevice,IsNewLocation,GeoSource)
   VALUES (@at,@uid,@ln,@un,@ok,@fr,@ip,@ff,@gc,@gr,@gcity,@gla,@glo,@gtz,@isp,@ct,@vpn,@dt,@dm,@br,@bv,@os,@ov,@al,@ch,@ua,@dk,@loc,@sr,@nd,@nl,@gsrc)`);
 }catch(e){console.warn('Login audit capture failed:',e instanceof Error?e.name:'unknown')}
}
