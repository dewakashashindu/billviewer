import {NextRequest,NextResponse} from 'next/server';
import sql from 'mssql';
import {getPool,isDbConfigured} from '@/lib/db';
import {SESSION_COOKIE,verifySessionValue} from '@/lib/auth';
import {requireWebPermission,requireWebLocation,AccessDeniedError} from '@/lib/webAuthorization';
export const runtime='nodejs';
const textColumns=['LocCode','TableNo','StewId','ItemCode','ItemDes','KOTBOT','OrderMode','MgrId','CusType','CusId','CusName','NOPax','VOIDREMARKS','CASHERID','KOTBOTNO'] as const;
const numColumns=['SerialNo','RefNo','Qty','SalesPrice','PrintedQty','ItmCost','TRACENO','BIRTHNO'] as const;
const asText=(s:unknown)=>typeof s==='string'?s.trim():'';
async function authorize(req:NextRequest,action:'VIEW'|'APPROVE'){
 const token=req.cookies.get(SESSION_COOKIE)?.value,session=token?await verifySessionValue(token):null;if(!session)return null;
 const access=await requireWebPermission(session,'void-approval:VIEW');
 if(action==='APPROVE'&&!access.permissions.has('void-approval:APPROVE'))throw new AccessDeniedError();
 return access;
}
function fail(e:unknown){if(e instanceof AccessDeniedError)return NextResponse.json({error:'Access denied.'},{status:403});console.error('Void approval error:',e);return NextResponse.json({error:'Unable to complete the request. Please try again or contact support.'},{status:500})}
export async function GET(req:NextRequest){try{
 if(!isDbConfigured())return NextResponse.json({error:'Service unavailable.'},{status:503});const access=await authorize(req,'VIEW');if(!access)return NextResponse.json({error:'Please log in.'},{status:401});
 const loc=asText(req.nextUrl.searchParams.get('location'));const pool=await getPool();
 const escaped=[...access.locations].map(x=>'<i>'+x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</i>').join('');const scope='<l>'+escaped+'</l>';
 const list=await pool.request().input('scope',sql.NVarChar(sql.MAX),scope).query(`SELECT RTRIM(LocCode) AS code, RTRIM(LocDes) AS name FROM dbo.Tbl_LocationMaster WHERE RTRIM(LocCode) IN (SELECT n.v.value('(./text())[1]', 'nvarchar(10)') FROM (SELECT CAST(@scope AS xml) AS x) a CROSS APPLY a.x.nodes('/l/i') n(v)) ORDER BY LocDes,LocCode`);
 const locations=list.recordset.map(r=>({code:asText(r.code),name:asText(r.name)||asText(r.code)}));
 if(!loc)return NextResponse.json({locations,defaultLocation:access.defaultLocation,rows:[],truncated:false},{headers:{'Cache-Control':'no-store'}});
 requireWebLocation(access,loc);
 const result=await pool.request().input('loc',sql.Char(10),loc).query(`SELECT
  ${textColumns.map(c=>`LTRIM(RTRIM([${c}])) AS [${c}]`).join(',')},
  ${numColumns.map(c=>`[${c}]`).join(',')}, CONVERT(varchar(50),[ITEMNO]) AS ITEMNO,
  CONVERT(varchar(23),[TxnDate],121) AS TxnDate,CONVERT(varchar(23),[TxnTime],121) AS TxnTime,[VoidApproved],
  (SELECT CASE WHEN COUNT(*)=1 THEN MAX(NULLIF(LTRIM(RTRIM(u.UserName)),'')) END FROM dbo.Tbl_UserDetails u WHERE u.UserId=h.StewId) AS StewardName,
  (SELECT CASE WHEN COUNT(*)=1 THEN MAX(NULLIF(LTRIM(RTRIM(u.UserName)),'')) END FROM dbo.Tbl_UserDetails u WHERE u.UserId=h.CASHERID) AS CashierName
  FROM dbo.Tbl_HoldUps h WHERE LocCode=@loc AND TableNo='ff' 
  ORDER BY TxnDate DESC, TxnTime DESC, SerialNo DESC, ITEMNO DESC`);
 const rows=result.recordset.map(r=>({...r,StewardName:asText(r.StewardName)||asText(r.StewId),CashierName:asText(r.CashierName)||asText(r.CASHERID),VoidApproved:Boolean(r.VoidApproved)}));
 return NextResponse.json({locations,defaultLocation:access.defaultLocation,rows,truncated:false},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e)}}
export async function POST(req:NextRequest){let tx:sql.Transaction|undefined;try{
 if(!isDbConfigured())return NextResponse.json({error:'Service unavailable.'},{status:503});const access=await authorize(req,'APPROVE');if(!access)return NextResponse.json({error:'Please log in.'},{status:401});
 const row=await req.json();if(!row||typeof row!=='object'||Array.isArray(row))return NextResponse.json({error:'Invalid request.'},{status:400});
 // The displayed values plus transaction identifiers form a snapshot, not a primary key.
 // A lock and exact-count check are mandatory: ambiguous/stale rows are never updated.
 for(const c of textColumns)if(row[c]!==null&&(typeof row[c]!=='string'||row[c].length>400))return NextResponse.json({error:'Invalid record.'},{status:400});
 for(const c of numColumns)if(row[c]!==null&&(typeof row[c]!=='number'||!Number.isFinite(row[c])))return NextResponse.json({error:'Invalid record.'},{status:400});
 if(typeof row.ITEMNO!=='string'||!/^-?\d{1,18}$/.test(row.ITEMNO)||!['TxnDate','TxnTime'].every(c=>row[c]===null||(typeof row[c]==='string'&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}$/.test(row[c]))))return NextResponse.json({error:'Invalid record.'},{status:400});
 const loc=asText(row.LocCode);requireWebLocation(access,loc);if(asText(row.TableNo).toLowerCase()!=='ff'||row.VoidApproved!==false)return NextResponse.json({error:'This item is not available for approval.'},{status:409});
 tx=new sql.Transaction(await getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 const request=new sql.Request(tx);
 for(const c of textColumns)request.input('t_'+c,sql.NVarChar(400),asText(row[c]));
 for(const c of numColumns)request.input('n_'+c,sql.Float,row[c]);
 request.input('itemNo',sql.VarChar(50),row.ITEMNO).input('txnDate',sql.VarChar(23),row.TxnDate).input('txnTime',sql.VarChar(23),row.TxnTime);
 const predicate=[...textColumns.map(c=>`ISNULL(LTRIM(RTRIM([${c}])), '')=@t_${c}`),...numColumns.map(c=>`([${c}]=@n_${c} OR ([${c}] IS NULL AND @n_${c} IS NULL))`),"CONVERT(varchar(50),[ITEMNO])=@itemNo","(CONVERT(varchar(23),[TxnDate],121)=@txnDate OR ([TxnDate] IS NULL AND @txnDate IS NULL))","(CONVERT(varchar(23),[TxnTime],121)=@txnTime OR ([TxnTime] IS NULL AND @txnTime IS NULL))","TableNo='ff'"].join(' AND ');
 const found=await request.query(`SELECT COUNT_BIG(*) AS matches, SUM(CASE WHEN VoidApproved=0 THEN 1 ELSE 0 END) AS pending FROM dbo.Tbl_HoldUps WITH (TABLOCKX,HOLDLOCK) WHERE ${predicate}`);
 if(Number(found.recordset[0].matches)!==1||Number(found.recordset[0].pending)!==1){await tx.rollback();tx=undefined;return NextResponse.json({error:'This row has changed, was already approved, or is not unique. Refresh and review it; no changes were made.'},{status:409})}
 const changed=await request.query(`UPDATE dbo.Tbl_HoldUps SET VoidApproved=1 WHERE ${predicate} AND VoidApproved=0`);
 if(changed.rowsAffected[0]!==1)throw Error('Expected one updated row');await tx.commit();tx=undefined;return NextResponse.json({success:true});
}catch(e){if(tx)try{await tx.rollback()}catch{}return fail(e)}}
