import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import {getPool,isDbConfigured} from '@/lib/db';
import {isAdminSession,SESSION_COOKIE,verifySessionValue} from '@/lib/auth';
import {requireWebPermission,AccessDeniedError} from '@/lib/webAuthorization';
import {ensureLocationUnreferenced} from '@/lib/inventoryDeleteReferences';
const flags=['Enable','OutSideLoc','LocStatus','GloStockhandling','SubLoc','UploadData'] as const;
type Location={LocCode:string;LocDes:string;MainLoc:string}&Record<typeof flags[number],boolean>;
async function authorize(req:NextRequest){const token=req.cookies.get(SESSION_COOKIE)?.value;const session=token?verifySessionValue(token):null;if(!session)return NextResponse.json({error:'Not logged in.'},{status:401});if(!isDbConfigured())return NextResponse.json({error:'Database is not configured.'},{status:503});let groupId=session.groupId??'';if(!groupId){const r=await(await getPool()).request().input('uid',sql.Char(10),String(session.userId)).query("SELECT TOP 1 LTRIM(RTRIM(ISNULL(GroupId,''))) AS GroupId FROM Tbl_UserDetails WHERE LTRIM(RTRIM(UserId))=LTRIM(RTRIM(@uid))");groupId=r.recordset[0]?.GroupId??''}return isAdminSession({...session,groupId})?null:NextResponse.json({error:'Admin access required.'},{status:403})}
function valid(v:unknown):v is Location{if(!v||typeof v!=='object'||Array.isArray(v))return false;const x=v as Record<string,unknown>;return typeof x.LocCode==='string'&&!!x.LocCode.trim()&&x.LocCode.length<=10&&typeof x.LocDes==='string'&&!!x.LocDes.trim()&&x.LocDes.length<=50&&typeof x.MainLoc==='string'&&x.MainLoc.length<=10&&flags.every(k=>typeof x[k]==='boolean')&&(!x.SubLoc||!!x.MainLoc.trim())}
function params(r:sql.Request,x:Location){r.input('LocCode',sql.Char(10),x.LocCode.trim()).input('LocDes',sql.VarChar(50),x.LocDes.trim()).input('MainLoc',sql.Char(10),x.SubLoc?x.MainLoc.trim():' ');for(const flag of flags)r.input(flag,sql.Bit,x[flag]);return r}
function fail(e:unknown){console.error('Location database error:',e);const m=(e as Error).message,n=(e as {number?:number}).number;return NextResponse.json({error:m==='REFERENCE_IN_USE'?'Location is referenced by a known record and cannot be deleted. Disable it instead.':m==='LOCATION_ACCESS'?'You do not have access to this location.':m==='INVALID_PARENT'?'Choose an existing main location; a location cannot be its own parent.':m==='DUPLICATE_DESCRIPTION'?'Location description already exists.':m==='HAS_CHILDREN'?'Move or update this main location’s sub locations before making it a sub location.':m==='NOT_FOUND'?'Location not found or duplicated.':m==='EXISTS'||n===2627||n===2601?'Location code already exists.':'Unable to access locations. Check database connection, schema, migration and server logs.'},{status:['INVALID_PARENT','HAS_CHILDREN','NOT_FOUND','EXISTS','DUPLICATE_DESCRIPTION','REFERENCE_IN_USE'].includes(m)||n===2627||n===2601||n===547?409:m==='LOCATION_ACCESS'||e instanceof AccessDeniedError?403:500})}
export async function GET(req:NextRequest){try{const denied=await authorize(req);if(denied)return denied;const r=await(await getPool()).request().query('SELECT RTRIM(LocCode) AS LocCode, LocDes, Enable, OutSideLoc, LocStatus, GloStockhandling, SubLoc, UploadData, RTRIM(MainLoc) AS MainLoc FROM dbo.Tbl_LocationMaster ORDER BY LocDes, LocCode');return NextResponse.json({data:r.recordset},{headers:{'Cache-Control':'no-store'}})}catch(e){return fail(e)}}
async function save(req:NextRequest,isNew:boolean){let tx:sql.Transaction|undefined;try{const denied=await authorize(req);if(denied)return denied;const data:unknown=await req.json();if(!valid(data))return NextResponse.json({error:'Check location fields and select a main location for sub locations.'},{status:400});tx=new sql.Transaction(await getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const all=await new sql.Request(tx).query('SELECT RTRIM(LocCode) AS LocCode,LocDes,SubLoc,RTRIM(MainLoc) AS MainLoc FROM dbo.Tbl_LocationMaster WITH (TABLOCKX,HOLDLOCK)');const key=data.LocCode.trim().toUpperCase(),parent=data.MainLoc.trim().toUpperCase();const matches=all.recordset.filter((x:Location)=>x.LocCode.trim().toUpperCase()===key);if(isNew&&matches.length)throw Error('EXISTS');if(all.recordset.some((x:Location)=>x.LocCode.trim().toUpperCase()!==key&&String(x.LocDes??'').trim().toUpperCase()===data.LocDes.trim().toUpperCase()))throw Error('DUPLICATE_DESCRIPTION');if(!isNew&&matches.length!==1)throw Error('NOT_FOUND');if(data.SubLoc){if(key===parent||all.recordset.filter((x:Location)=>x.LocCode.trim().toUpperCase()===parent&&!x.SubLoc).length!==1)throw Error('INVALID_PARENT');if(all.recordset.some((x:Location)=>x.SubLoc&&x.MainLoc.trim().toUpperCase()===key))throw Error('HAS_CHILDREN')}const r=params(new sql.Request(tx),data);if(isNew)await r.query('INSERT dbo.Tbl_LocationMaster (LocCode,LocDes,Enable,OutSideLoc,LocStatus,GloStockhandling,SubLoc,UploadData,MainLoc) VALUES (@LocCode,@LocDes,@Enable,@OutSideLoc,@LocStatus,@GloStockhandling,@SubLoc,@UploadData,@MainLoc)');else await r.query('UPDATE dbo.Tbl_LocationMaster SET LocDes=@LocDes,Enable=@Enable,OutSideLoc=@OutSideLoc,LocStatus=@LocStatus,GloStockhandling=@GloStockhandling,SubLoc=@SubLoc,UploadData=@UploadData,MainLoc=@MainLoc WHERE LocCode=@LocCode');await tx.commit();tx=undefined;return NextResponse.json({success:true},{status:isNew?201:200})}catch(e){if(tx)try{await tx.rollback()}catch{}return fail(e)}}
export async function POST(req:NextRequest){return save(req,true)}
export async function PUT(req:NextRequest){return save(req,false)}

export async function DELETE(req:NextRequest){
 let tx:sql.Transaction|undefined;
 try{
   const denied=await authorize(req);if(denied)return denied;
   const token=req.cookies.get(SESSION_COOKIE)?.value;const session=token?verifySessionValue(token):null;
   if(!session)return NextResponse.json({error:'Not logged in.'},{status:401});
   const access=await requireWebPermission(session,'locations:DELETE');
   const body=await req.json(),code=typeof body.code==='string'?body.code.trim():'';
   if(!code||code.length>10)return NextResponse.json({error:'Invalid location code.'},{status:400});
   if(![...access.locations].some(x=>x.trim().toUpperCase()===code.toUpperCase()))throw Error('LOCATION_ACCESS');
   tx=new sql.Transaction(await getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
   const existing=await new sql.Request(tx).input('code',sql.Char(10),code).query('SELECT LocCode FROM dbo.Tbl_LocationMaster WITH (TABLOCKX,HOLDLOCK) WHERE LocCode=@code');
   if(existing.recordset.length!==1)throw Error('NOT_FOUND');
   await ensureLocationUnreferenced(tx,code);
   const result=await new sql.Request(tx).input('code',sql.Char(10),code).query('DELETE FROM dbo.Tbl_LocationMaster WHERE LocCode=@code');
   if(result.rowsAffected[0]!==1)throw Error('NOT_FOUND');
   await tx.commit();tx=undefined;return NextResponse.json({success:true});
 }catch(e){if(tx)try{await tx.rollback()}catch{}return fail(e)}
}
