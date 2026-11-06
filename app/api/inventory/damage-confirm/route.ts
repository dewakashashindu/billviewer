import {NextRequest,NextResponse} from 'next/server';
import sql from 'mssql';
import {getPool} from '@/lib/db';
import {SESSION_COOKIE,verifySessionValue} from '@/lib/auth';
import {AccessDeniedError,requireWebPermission} from '@/lib/webAuthorization';
import {nextStockSerial,writeStockMovement} from '@/lib/stockPosting';
export const runtime='nodejs';
const clean=(x:unknown)=>typeof x==='string'?x.trim():'';
export async function POST(req:NextRequest){let tx:sql.Transaction|undefined;try{
 const token=req.cookies.get(SESSION_COOKIE)?.value,user=token?verifySessionValue(token):null;if(!user)return NextResponse.json({error:'Not logged in.'},{status:401});
 const access=await requireWebPermission(user,'damage:CONFIRM'),body=await req.json(),loc=clean(body.location),id=clean(body.id);
 if(!loc||loc.length>10||!id||id.length>10)return NextResponse.json({error:'Invalid location or document number.'},{status:400});
 if(![...access.locations].some(x=>clean(x).toUpperCase()===loc.toUpperCase()))throw new AccessDeniedError();
 tx=new sql.Transaction(await getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 const h=await new sql.Request(tx).input('loc',sql.Char(10),loc).input('id',sql.NVarChar(10),id).query("SELECT Confirmed,SysSerialNo FROM dbo.Tbl_DamageHeder WITH (UPDLOCK,HOLDLOCK) WHERE LocCode=@loc AND DamNo=@id");
 if(h.recordset.length!==1||clean(h.recordset[0].Confirmed).toUpperCase()!=='N')throw Error('LOCKED');
 const lines=await new sql.Request(tx).input('loc',sql.Char(10),loc).input('id',sql.NVarChar(10),id).query('SELECT RTRIM(ItemCode) AS item,DmgQty AS qty FROM dbo.Tbl_DamageDetails WITH (UPDLOCK,HOLDLOCK) WHERE LocCode=@loc AND DamNo=@id');
 if(!lines.recordset.length||lines.recordset.some(x=>!clean(x.item)||clean(x.item).length>15||x.qty===null||!Number.isFinite(Number(x.qty))||Number(x.qty)<=0)||new Set(lines.recordset.map(x=>clean(x.item).toUpperCase())).size!==lines.recordset.length)throw Error('LINES');
 const existing=Number(h.recordset[0].SysSerialNo);if(!Number.isSafeInteger(existing)||existing<0)throw Error('SERIAL');const serial=existing>0?existing:await nextStockSerial(tx,loc);
 for(const l of [...lines.recordset].sort((a,b)=>clean(a.item).localeCompare(clean(b.item)))){
  const item=clean(l.item),qty=Number(l.qty);
  const row=await new sql.Request(tx).input('loc',sql.Char(10),loc).input('item',sql.Char(15),item).query('SELECT StkBal,Enable FROM dbo.Tbl_RowItems WITH (UPDLOCK,HOLDLOCK) WHERE LocCode=@loc AND RowItemCode=@item');
  if(row.recordset.length!==1||!row.recordset[0].Enable||row.recordset[0].StkBal===null||!Number.isFinite(Number(row.recordset[0].StkBal)))throw Error('ITEM');
  const updated=await new sql.Request(tx).input('loc',sql.Char(10),loc).input('item',sql.Char(15),item).input('qty',sql.Float,qty).query('UPDATE dbo.Tbl_RowItems SET StkBal=StkBal-@qty WHERE LocCode=@loc AND RowItemCode=@item AND Enable=1 AND StkBal IS NOT NULL');
  if(updated.rowsAffected[0]!==1)throw Error('ITEM');
  const after=await new sql.Request(tx).input('loc',sql.Char(10),loc).input('item',sql.Char(15),item).query('SELECT StkBal FROM dbo.Tbl_RowItems WHERE LocCode=@loc AND RowItemCode=@item');
  if(after.recordset.length!==1||after.recordset[0].StkBal===null)throw Error('ITEM');
  await writeStockMovement(tx,{loc,item,doc:id,type:'DM',user:clean(user.userId),serial,pre:Number(row.recordset[0].StkBal),qty,last:Number(after.recordset[0].StkBal),direction:'-',remarks:`Damage Note ${id}`});
 }
 const r=await new sql.Request(tx).input('loc',sql.Char(10),loc).input('id',sql.NVarChar(10),id).input('user',sql.Char(10),clean(user.userId)).input('serial',sql.Float,serial).query("UPDATE dbo.Tbl_DamageHeder SET Confirmed='Y',ConUserID=@user,ConDatetime=GETDATE(),SysSerialNo=@serial WHERE LocCode=@loc AND DamNo=@id AND Confirmed='N'");if(r.rowsAffected[0]!==1)throw Error('LOCKED');
 await tx.commit();tx=undefined;return NextResponse.json({success:true});
}catch(e){if(tx)try{await tx.rollback()}catch{}console.error('Damage confirmation:',e);const m=(e as Error).message;const errors:Record<string,string>={LOCKED:'Damage note is missing, duplicated or already confirmed.',LINES:'Damage note has invalid or duplicate lines.',ITEM:'Item location row is missing, disabled, duplicated or has invalid stock.',SERIAL:'Location serial counter is missing or invalid.'};return NextResponse.json({error:e instanceof AccessDeniedError?'Access denied.':errors[m]||'Confirm failed. No changes committed; check database schema and server logs.'},{status:e instanceof AccessDeniedError?403:errors[m]?409:500})}}
