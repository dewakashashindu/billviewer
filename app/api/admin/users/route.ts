import {NextRequest,NextResponse} from 'next/server';
import sql from 'mssql';
import {getPool,isDbConfigured} from '@/lib/db';
import {logActivity} from '@/lib/activityLog';
import {verifySessionValue,hashPassword,SESSION_COOKIE} from '@/lib/auth';
import {requireWebPermission} from '@/lib/webAuthorization';

const clean=(v:unknown)=>typeof v==='string'?v.trim():'';
async function authorize(req:NextRequest,action:'VIEW'|'SAVE'){
  const token=req.cookies.get(SESSION_COOKIE)?.value, session=token?await verifySessionValue(token):null;
  if(!session)return {error:NextResponse.json({error:'Not logged in.'},{status:401})};
  if(!isDbConfigured())return {error:NextResponse.json({error:'Database is not configured.'},{status:503})};
  try{await requireWebPermission(session,`users:${action}`);}catch{return {error:NextResponse.json({error:'Permission denied.'},{status:403})};}
  return {session};
}
function fail(e:unknown){console.error('User management error:',e);const n=(e as {number?:number}).number;return NextResponse.json({error:n===2627||n===2601?'Duplicate user ID or login name.':n===547?'Referenced record or invalid group/location.':'Unable to save or load user. Verify table schema, defaults and database permissions.'},{status:n===2627||n===2601||n===547?409:500});}
export async function GET(req:NextRequest){try{
  const auth=await authorize(req,'VIEW');if(auth.error)return auth.error;
  const pool=await getPool();const loc=clean(req.nextUrl.searchParams.get('loc')),id=clean(req.nextUrl.searchParams.get('id'));
  if(loc||id){if(!loc||!id||loc.length>10||id.length>10)return NextResponse.json({error:'Invalid user.'},{status:400});
    const r=await pool.request().input('loc',sql.VarChar(10),loc).input('id',sql.VarChar(10),id).query(`SELECT LTRIM(RTRIM(LOCCODE)) AS locCode,LTRIM(RTRIM(UserId)) AS userId,LTRIM(RTRIM(NIC)) AS nic,LTRIM(RTRIM(GroupId)) AS groupId,UserName AS userName,Rmks AS remarks,Add1 AS add1,Add2 AS add2,Add3 AS add3,Add4 AS add4,ContNo AS contact,Email AS email,CONVERT(varchar(10),DOB,23) AS dob,CONVERT(varchar(10),DOJ,23) AS doj,CONVERT(varchar(10),DOL,23) AS dol,Enable AS enabled,LoginNameWeb AS loginNameWeb,CASE WHEN PasswordWeb LIKE 'scrypt$%$%' THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS hasPassword,CONVERT(varbinary(max),Picture) AS picture FROM dbo.Tbl_UserDetails WHERE LTRIM(RTRIM(LOCCODE))=@loc AND LTRIM(RTRIM(UserId))=@id`);
    if(r.recordset.length!==1)return NextResponse.json({error:'User not found or not unique.'},{status:404});const u=r.recordset[0],buf=u.picture as Buffer|null;
    if(buf&&buf.length>4*1024*1024)return NextResponse.json({error:'Existing picture exceeds the 4 MB preview limit.'},{status:413});
    const access=await pool.request().input('id',sql.Char(10),id).query('SELECT RTRIM(LocationID) AS code, IsDefault FROM dbo.Tbl_UserLocationAccess WHERE UserID=@id');
    return NextResponse.json({data:{...u,picture:buf?buf.toString('base64'):null,workingLocations:access.recordset.map(x=>clean(x.code)),defaultLocation:access.recordset.filter(x=>x.IsDefault).length===1?clean(access.recordset.find(x=>x.IsDefault).code):''}},{headers:{'Cache-Control':'no-store'}});
  }
  const [users,locations,groups]=await Promise.all([
    pool.request().query(`SELECT LTRIM(RTRIM(LOCCODE)) AS locCode,LTRIM(RTRIM(UserId)) AS userId,LTRIM(RTRIM(UserName)) AS userName,LTRIM(RTRIM(ISNULL(LoginNameWeb,''))) AS loginNameWeb,CASE WHEN PasswordWeb LIKE 'scrypt$%$%' THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS hasPassword,Enable AS enabled FROM dbo.Tbl_UserDetails ORDER BY UserName,UserId,LOCCODE`),
    pool.request().query(`SELECT LTRIM(RTRIM(LocCode)) AS code,LTRIM(RTRIM(LocDes)) AS name,Enable AS enabled FROM dbo.Tbl_LocationMaster WHERE ISNULL(SubLoc,0)=0 ORDER BY LocDes,LocCode`),
    pool.request().query(`SELECT LTRIM(RTRIM(GroupId)) AS id,LTRIM(RTRIM(GroupDes)) AS name FROM dbo.Tbl_UserGroups ORDER BY GroupDes,GroupId`)]);
  return NextResponse.json({data:users.recordset,locations:locations.recordset,groups:groups.recordset},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e)}}
function imageOf(raw:unknown):Buffer|undefined{if(raw===undefined||raw===null||raw==='')return undefined;if(typeof raw!=='string'||raw.length>5600000||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))throw Error('Invalid image.');const b=Buffer.from(raw,'base64');if(!b.length||b.length>4*1024*1024)throw Error('Image must be smaller than 4 MB.');const ok=(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)||(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||b.subarray(0,6).toString()==='GIF87a'||b.subarray(0,6).toString()==='GIF89a'||b.subarray(0,4).equals(Buffer.from([0,0,1,0]));if(!ok)throw Error('Use a PNG, JPEG, GIF or ICO image.');return b;}
async function save(req:NextRequest,creating:boolean){let tx:sql.Transaction|undefined;try{
  const auth=await authorize(req,'SAVE');if(auth.error)return auth.error;const b=await req.json();
  const loc=clean(b.locCode),id=clean(b.userId),group=clean(b.groupId),name=clean(b.userName),login=clean(b.loginNameWeb),password=typeof b.password==='string'?b.password:'';
  if(!loc||loc.length>10||!id||id.length>10||!group||group.length>10||!name||name.length>200||login.length>50||password.length>256||(password&&password.length<8)||(password&&!login))return NextResponse.json({error:'Enter a valid location, user ID, group and user name; web passwords require a username and at least 8 characters.'},{status:400});
  const work=b.workingLocations, defaultLocation=clean(b.defaultLocation);
  if(!Array.isArray(work)||work.length<1||work.length>200||work.some((v:unknown)=>typeof v!=='string'||!clean(v)||clean(v).length>10)||new Set(work.map((v:string)=>clean(v).toUpperCase())).size!==work.length||!defaultLocation||!work.some((v:string)=>clean(v).toUpperCase()===defaultLocation.toUpperCase()))return NextResponse.json({error:'Select working locations and exactly one default from the selected locations.'},{status:400});
  const fields:[string,number][]=[['nic',20],['remarks',250],['add1',200],['add2',200],['add3',200],['add4',200],['contact',100],['email',100]];for(const [key,max] of fields)if(clean(b[key]).length>max)return NextResponse.json({error:`${key} is too long.`},{status:400});
  const dates=['dob','doj','dol'].map(k=>clean(b[k])||'1900-01-01');if(dates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d))return NextResponse.json({error:'Invalid date.'},{status:400});
  let picture:Buffer|undefined;try{picture=imageOf(b.picture)}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
  tx=new sql.Transaction(await getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const req1=new sql.Request(tx).input('loc',sql.VarChar(10),loc).input('id',sql.VarChar(10),id).input('login',sql.VarChar(50),login);
  const current=await req1.query(`SELECT LTRIM(RTRIM(LocCode)) AS loc,LTRIM(RTRIM(UserId)) AS id,LTRIM(RTRIM(ISNULL(LoginNameWeb,''))) AS login,PasswordWeb FROM dbo.Tbl_UserDetails WITH (TABLOCKX,HOLDLOCK) WHERE LTRIM(RTRIM(UserId))=@id OR (@login<>'' AND LOWER(LTRIM(RTRIM(ISNULL(LoginNameWeb,''))))=LOWER(@login))`);
  const self=current.recordset.filter(x=>String(x.loc).toUpperCase()===loc.toUpperCase()&&String(x.id).toUpperCase()===id.toUpperCase());
  if((creating&&self.length)||(!creating&&self.length!==1)){await tx.rollback();tx=undefined;return NextResponse.json({error:creating?'This location and user ID already exist.':'User not found or not unique.'},{status:409});}
  if(current.recordset.some(x=>!(String(x.loc).toUpperCase()===loc.toUpperCase()&&String(x.id).toUpperCase()===id.toUpperCase()))){await tx.rollback();tx=undefined;return NextResponse.json({error:'User ID or web username is already in use.'},{status:409});}
  const valid=await new sql.Request(tx).input('loc',sql.VarChar(10),loc).input('grp',sql.VarChar(10),group).query(`SELECT (SELECT COUNT(*) FROM dbo.Tbl_LocationMaster WITH (HOLDLOCK) WHERE LTRIM(RTRIM(LocCode))=@loc AND ISNULL(SubLoc,0)=0 AND Enable=1) AS locs,(SELECT COUNT(*) FROM dbo.Tbl_UserGroups WITH (HOLDLOCK) WHERE LTRIM(RTRIM(GroupId))=@grp) AS groups`);
  if(valid.recordset[0].locs!==1||valid.recordset[0].groups!==1){await tx.rollback();tx=undefined;return NextResponse.json({error:'Select an existing unique location and user group.'},{status:400});}
  const r=new sql.Request(tx).input('loc',sql.VarChar(10),loc).input('id',sql.VarChar(10),id).input('group',sql.VarChar(10),group).input('name',sql.VarChar(200),name).input('login',sql.VarChar(50),login||' ').input('enable',sql.Bit,Boolean(b.enabled)).input('creator',sql.VarChar(10),String(auth.session!.userId||' ').slice(0,10));
  for(const [key,max] of fields)r.input(key,sql.VarChar(max),clean(b[key])||' ');
  ['dob','doj','dol'].forEach((key,i)=>r.input(key,sql.DateTime,new Date(dates[i]+'T00:00:00Z')));
  if(password)r.input('pw',sql.VarChar(255),hashPassword(password));if(picture)r.input('picture',sql.VarBinary(sql.MAX),picture);
  if(creating){await r.query(`INSERT INTO dbo.Tbl_UserDetails (LOCCODE,UserId,NIC,LogName,PSW,GroupId,UserName,Rmks,Add1,Add2,Add3,Add4,ContNo,Email,DOB,DOJ,DOL,CreateUser,Picture,Enable,ByPassGroupTable,Password,LoginName,Uploaded,PasswordWeb,LoginNameWeb) VALUES (@loc,@id,@nic,' ',' ',@group,@name,@remarks,@add1,@add2,@add3,@add4,@contact,@email,@dob,@doj,@dol,@creator,${picture?'@picture':'NULL'},@enable,0,' ',' ',0,${password?'@pw':"' '"},@login)`);}
  else {await r.query(`UPDATE dbo.Tbl_UserDetails SET NIC=@nic,GroupId=@group,UserName=@name,Rmks=@remarks,Add1=@add1,Add2=@add2,Add3=@add3,Add4=@add4,ContNo=@contact,Email=@email,DOB=@dob,DOJ=@doj,DOL=@dol,Enable=@enable,LoginNameWeb=@login ${password?',PasswordWeb=@pw':''} ${picture?',Picture=@picture':''} WHERE LTRIM(RTRIM(LOCCODE))=@loc AND LTRIM(RTRIM(UserId))=@id`);}
  if (!creating && (password || !b.enabled)) await new sql.Request(tx).input('id',sql.Char(10),id).query('DELETE FROM dbo.Tbl_WebSession WHERE UserID=@id');
  // Serialize the complete replacement; clearing before inserting prevents a second
  // default even with the supplied multi-row trigger. Rollback restores old grants.
  await new sql.Request(tx).input('id',sql.Char(10),id).query('SELECT LocationID FROM dbo.Tbl_UserLocationAccess WITH (UPDLOCK,HOLDLOCK) WHERE UserID=@id');
  for(const value of work as string[]){const code=clean(value);const found=await new sql.Request(tx).input('loc',sql.Char(10),code).query('SELECT COUNT(*) AS n FROM dbo.Tbl_LocationMaster WITH (UPDLOCK,HOLDLOCK) WHERE LocCode=@loc AND Enable=1 AND ISNULL(SubLoc,0)=0');if(found.recordset[0].n!==1)throw Error('INVALID_WORKING_LOCATION')}
  await new sql.Request(tx).input('id',sql.Char(10),id).query('DELETE FROM dbo.Tbl_UserLocationAccess WHERE UserID=@id');
  for(const value of work as string[]){const code=clean(value);const inserted=await new sql.Request(tx).input('id',sql.Char(10),id).input('loc',sql.Char(10),code).input('isDefault',sql.Bit,code.toUpperCase()===defaultLocation.toUpperCase()).query(`INSERT dbo.Tbl_UserLocationAccess(UserID,LocationID,LocationDescription,IsDefault) SELECT @id,LocCode,COALESCE(NULLIF(LTRIM(RTRIM(LocDes)),''),LTRIM(RTRIM(LocCode))),@isDefault FROM dbo.Tbl_LocationMaster WITH (UPDLOCK,HOLDLOCK) WHERE LocCode=@loc AND ISNULL(SubLoc,0)=0 AND Enable=1`);if(inserted.rowsAffected[0]!==1)throw Error('INVALID_WORKING_LOCATION')}

  await tx.commit();tx=undefined;
  await logActivity({actor:auth.session!,category:'USER',action:creating?'USER_CREATED':'USER_UPDATED',targetType:'user',targetId:id,targetName:name,locationCode:loc,details:`${creating?'Created':'Updated'} user ${name} (${login||id}) at location ${loc}; enabled: ${Boolean(b.enabled)?'yes':'no'}${password&&!creating?'; password was changed':''}${!b.enabled&&!creating?'; user deactivated and sessions revoked':''}`});
  return NextResponse.json({success:true});
}catch(e){if(tx)try{await tx.rollback()}catch{}if((e as Error).message==='INVALID_WORKING_LOCATION')return NextResponse.json({error:'A working location is inactive, missing or duplicated. Please update your selection.'},{status:409});return fail(e)}}
export async function POST(req:NextRequest){return save(req,true)}
export async function PUT(req:NextRequest){return save(req,false)}
export async function DELETE(){return NextResponse.json({error:'Delete is disabled until the POS user-reference columns and web-access cleanup rules are verified.'},{status:409})}
