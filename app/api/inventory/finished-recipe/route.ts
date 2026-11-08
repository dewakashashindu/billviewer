import {NextRequest,NextResponse} from 'next/server';
import sql from 'mssql';
import {createHash} from 'crypto';
import {getPool} from '@/lib/db';
import {SESSION_COOKIE,verifySessionValue} from '@/lib/auth';
import {AccessDeniedError,requireWebPermission} from '@/lib/webAuthorization';
export const runtime='nodejs';
const clean=(v:unknown)=>typeof v==='string'?v.trim():'';
async function authorize(req:NextRequest,action:string,loc=''){
 const token=req.cookies.get(SESSION_COOKIE)?.value,user=token?verifySessionValue(token):null;
 if(!user)throw Error('LOGIN');const access=await requireWebPermission(user,`items:${action}`);
 if(loc&&(!loc||loc.length>10||![...access.locations].some(x=>clean(x).toUpperCase()===loc.toUpperCase())))throw new AccessDeniedError();
 return access;
}
function fail(e:unknown){const m=(e as Error).message;if(!(e instanceof AccessDeniedError))console.error('Finished recipe:',e);const msg:Record<string,string>={LOGIN:'Please log in.',INVALID:'Select a valid location, product, ingredient, sub unit and quantity.',MASTER:'Product, ingredient or enabled unit conversion is missing, disabled or duplicated.',EXISTS:'This ingredient already exists in the recipe.',DUPLICATE:'Duplicate recipe rows exist for this location, product and ingredient. Review the data before editing or deleting.',MISSING:'The recipe line is missing or has changed.',STALE:'This recipe was changed elsewhere. Reload it before saving.',EMPTY:'Add at least one ingredient before saving.'};return NextResponse.json({error:e instanceof AccessDeniedError?'Access denied.':msg[m]||'Recipe operation failed. Check database schema and server logs.'},{status:e instanceof AccessDeniedError?403:m==='LOGIN'?401:['INVALID','MASTER'].includes(m)?400:['EXISTS','DUPLICATE','MISSING','STALE','EMPTY'].includes(m)?409:500})}
function valid(loc:string,product:string){return !!loc&&loc.length<=10&&!!product&&product.length<=10}
type SnapshotRow={item:unknown;master:unknown;sub:unknown;qty:unknown;cost:unknown};
function fingerprint(rows:SnapshotRow[]){const normalized=rows.map(r=>[clean(r.item).toUpperCase(),clean(r.master).toUpperCase(),clean(r.sub).toUpperCase(),r.qty===null?null:Number(r.qty),r.cost===null?null:Number(r.cost)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')}
export async function GET(req:NextRequest){try{
 const view=clean(req.nextUrl.searchParams.get('view')),loc=clean(req.nextUrl.searchParams.get('location')),product=clean(req.nextUrl.searchParams.get('product'));const access=await authorize(req,'VIEW',loc);const pool=await getPool();
 if(view==='options'){
  const [ls,products]=await Promise.all([pool.request().query('SELECT RTRIM(LocCode) code,LocDes name FROM dbo.Tbl_LocationMaster WHERE Enable=1 ORDER BY LocDes'),pool.request().query("SELECT RTRIM(MenuItmId) code,MenuItmDes name FROM dbo.Tbl_MenuItems WHERE Enable=1 AND LEN(RTRIM(MenuItmId))<=10 ORDER BY MenuItmDes,MenuItmId")]);
  return NextResponse.json({locations:ls.recordset.filter(x=>[...access.locations].some(l=>clean(l).toUpperCase()===clean(x.code).toUpperCase())),products:products.recordset,defaultLocation:access.defaultLocation});
 }
 if(view==='products'){
  if(!loc||loc.length>10)throw Error('INVALID');
  const r=await pool.request().input('loc',sql.Char(10),loc).query(`SELECT RTRIM(r.MenuItmID) code,COALESCE(MAX(NULLIF(LTRIM(RTRIM(m.MenuItmDes)),'')),RTRIM(r.MenuItmID)) name,COUNT(*) lineCount FROM dbo.Tbl_Recipies r LEFT JOIN dbo.Tbl_MenuItems m ON m.MenuItmID=r.MenuItmID WHERE r.LocCode=@loc GROUP BY RTRIM(r.MenuItmID) ORDER BY name,code`);
  return NextResponse.json({data:r.recordset});
 }
 if(!valid(loc,product))throw Error('INVALID');
 const [lines,items,units]=await Promise.all([
  pool.request().input('loc',sql.Char(10),loc).input('product',sql.Char(10),product).query(`SELECT RTRIM(r.RowItemCode) item,i.RowItmDes name,RTRIM(r.MasterUnitID) master,RTRIM(r.UnitID) sub,s.SubUnitDes subName,r.Qty qty,r.Price cost FROM dbo.Tbl_Recipies r LEFT JOIN dbo.Tbl_RowItems i ON i.LocCode=r.LocCode AND i.RowItemCode=r.RowItemCode LEFT JOIN dbo.Tbl_UnitSub s ON s.SubUnitID=r.UnitID WHERE r.LocCode=@loc AND r.MenuItmID=@product ORDER BY r.RowItemCode,r.UnitID`),
  pool.request().input('loc',sql.Char(10),loc).query('SELECT RTRIM(RowItemCode) code,RowItmDes name,RTRIM(UnitID) master,RowCost cost FROM dbo.Tbl_RowItems WHERE LocCode=@loc AND Enable=1 ORDER BY RowItmDes,RowItemCode'),
  pool.request().query('SELECT RTRIM(c.MasterUnitID) master,RTRIM(c.SubUnitID) sub,s.SubUnitDes name,c.Enable enabled,s.SubItemEnable subEnabled FROM dbo.Tbl_UnitConversion c JOIN dbo.Tbl_UnitSub s ON s.SubUnitID=c.SubUnitID')]);
 const counts=new Map<string,number>();for(const r of lines.recordset){const key=clean(r.item).toUpperCase();counts.set(key,(counts.get(key)||0)+1)}
 return NextResponse.json({lines:lines.recordset.map(r=>({...r,duplicate:(counts.get(clean(r.item).toUpperCase())||0)>1})),items:items.recordset,units:units.recordset,fingerprint:fingerprint(lines.recordset)});
}catch(e){return fail(e)}}
export async function POST(req:NextRequest){let tx:sql.Transaction|undefined;try{
 const b=await req.json(),loc=clean(b.location),product=clean(b.product),item=clean(b.item),sub=clean(b.sub),qty=b.qty;
 if(!valid(loc,product)||!item||item.length>15||!sub||sub.length>10||typeof qty!=='number'||!Number.isFinite(qty)||qty<=0||typeof b.edit!=='boolean')throw Error('INVALID');
 await authorize(req,'SAVE',loc);tx=new sql.Transaction(await getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 const q=()=>new sql.Request(tx!).input('loc',sql.Char(10),loc).input('product',sql.Char(10),product).input('item',sql.Char(15),item);
 const menu=await q().query('SELECT MenuItmId FROM dbo.Tbl_MenuItems WITH (UPDLOCK,HOLDLOCK) WHERE MenuItmId=@product AND Enable=1');if(menu.recordset.length!==1)throw Error('MASTER');
 const ingredient=await q().query('SELECT RTRIM(UnitID) master,RowCost,Enable FROM dbo.Tbl_RowItems WITH (UPDLOCK,HOLDLOCK) WHERE LocCode=@loc AND RowItemCode=@item');
 if(ingredient.recordset.length!==1||!ingredient.recordset[0].Enable||ingredient.recordset[0].RowCost===null||!Number.isFinite(Number(ingredient.recordset[0].RowCost))||Number(ingredient.recordset[0].RowCost)<0)throw Error('MASTER');
 const master=clean(ingredient.recordset[0].master);const unit=await new sql.Request(tx).input('master',sql.Char(10),master).input('sub',sql.Char(10),sub).query('SELECT c.Units FROM dbo.Tbl_UnitConversion c WITH (UPDLOCK,HOLDLOCK) JOIN dbo.Tbl_UnitSub s ON s.SubUnitID=c.SubUnitID WHERE c.MasterUnitID=@master AND c.SubUnitID=@sub AND c.Enable=1 AND s.SubItemEnable=1');if(unit.recordset.length!==1||!Number.isFinite(Number(unit.recordset[0].Units))||Number(unit.recordset[0].Units)<=0)throw Error('MASTER');
 const existing=await q().query('SELECT RowItemCode FROM dbo.Tbl_Recipies WITH (TABLOCKX,HOLDLOCK) WHERE LocCode=@loc AND MenuItmID=@product AND RowItemCode=@item');if(existing.recordset.length>1)throw Error('DUPLICATE');if(b.edit&&existing.recordset.length!==1)throw Error('MISSING');if(!b.edit&&existing.recordset.length)throw Error('EXISTS');
 const r=await q().input('master',sql.Char(10),master).input('sub',sql.Char(10),sub).input('qty',sql.Float,qty).input('price',sql.Float,Number(ingredient.recordset[0].RowCost)).query(b.edit?'UPDATE dbo.Tbl_Recipies SET MasterUnitID=@master,UnitID=@sub,Qty=@qty,Price=@price WHERE LocCode=@loc AND MenuItmID=@product AND RowItemCode=@item':'INSERT dbo.Tbl_Recipies(MenuItmID,RowItemCode,MasterUnitID,UnitID,Qty,LocCode,Price) VALUES(@product,@item,@master,@sub,@qty,@loc,@price)');if(r.rowsAffected[0]!==1)throw Error('MISSING');await tx.commit();tx=undefined;return NextResponse.json({success:true});
}catch(e){if(tx)try{await tx.rollback()}catch{}return fail(e)}}
export async function DELETE(req:NextRequest){let tx:sql.Transaction|undefined;try{
 const b=await req.json(),loc=clean(b.location),product=clean(b.product),item=clean(b.item);if(!valid(loc,product)||!item||item.length>15)throw Error('INVALID');await authorize(req,'DELETE',loc);
 tx=new sql.Transaction(await getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const q=()=>new sql.Request(tx!).input('loc',sql.Char(10),loc).input('product',sql.Char(10),product).input('item',sql.Char(15),item);
 const existing=await q().query('SELECT RowItemCode FROM dbo.Tbl_Recipies WITH (TABLOCKX,HOLDLOCK) WHERE LocCode=@loc AND MenuItmID=@product AND RowItemCode=@item');if(existing.recordset.length>1)throw Error('DUPLICATE');if(existing.recordset.length!==1)throw Error('MISSING');const r=await q().query('DELETE FROM dbo.Tbl_Recipies WHERE LocCode=@loc AND MenuItmID=@product AND RowItemCode=@item');if(r.rowsAffected[0]!==1)throw Error('MISSING');await tx.commit();tx=undefined;return NextResponse.json({success:true});
}catch(e){if(tx)try{await tx.rollback()}catch{}return fail(e)}}

// Save the whole recipe in one transaction. The fingerprint prevents stale
// screens overwriting changes made by another web/POS user.
export async function PUT(req:NextRequest){let tx:sql.Transaction|undefined;try{
 const b=await req.json(),loc=clean(b.location),product=clean(b.product),rows=b.lines;
 if(!valid(loc,product)||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint)||!Array.isArray(rows)||rows.length>500||rows.some((r:unknown)=>!r||typeof r!=='object'||!clean((r as any).item)||clean((r as any).item).length>15||!clean((r as any).sub)||clean((r as any).sub).length>10||typeof (r as any).qty!=='number'||!Number.isFinite((r as any).qty)||(r as any).qty<=0))throw Error('INVALID');
 if(!rows.length)throw Error('EMPTY');const keys=rows.map((r:any)=>clean(r.item).toUpperCase());if(new Set(keys).size!==keys.length)throw Error('DUPLICATE');
 const access=await authorize(req,'SAVE',loc);tx=new sql.Transaction(await getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 const q=()=>new sql.Request(tx!).input('loc',sql.Char(10),loc).input('product',sql.Char(10),product);
 const existing=await q().query('SELECT RTRIM(RowItemCode) item,RTRIM(MasterUnitID) master,RTRIM(UnitID) sub,Qty qty,Price cost FROM dbo.Tbl_Recipies WITH (TABLOCKX,HOLDLOCK) WHERE LocCode=@loc AND MenuItmID=@product');
 const current=existing.recordset as SnapshotRow[];if(fingerprint(current)!==b.fingerprint)throw Error('STALE');const currentKeys=current.map(r=>clean(r.item).toUpperCase());if(new Set(currentKeys).size!==currentKeys.length)throw Error('DUPLICATE');
 const removed=current.filter(r=>!keys.includes(clean(r.item).toUpperCase()));if(removed.length&&!access.permissions.has('items:DELETE'))throw new AccessDeniedError();
 const menu=await q().query('SELECT MenuItmId FROM dbo.Tbl_MenuItems WITH (UPDLOCK,HOLDLOCK) WHERE MenuItmId=@product AND Enable=1');if(menu.recordset.length!==1)throw Error('MASTER');
 for(const old of removed){const del=await q().input('item',sql.Char(15),clean(old.item)).query('DELETE FROM dbo.Tbl_Recipies WHERE LocCode=@loc AND MenuItmID=@product AND RowItemCode=@item');if(del.rowsAffected[0]!==1)throw Error('STALE')}
 for(const line of rows){const item=clean(line.item),sub=clean(line.sub);const old=current.find(r=>clean(r.item).toUpperCase()===item.toUpperCase());
  if(old&&clean(old.sub).toUpperCase()===sub.toUpperCase()&&Number(old.qty)===line.qty)continue;
  const ingredient=await q().input('item',sql.Char(15),item).query('SELECT RTRIM(UnitID) master,RowCost,Enable FROM dbo.Tbl_RowItems WITH (UPDLOCK,HOLDLOCK) WHERE LocCode=@loc AND RowItemCode=@item');if(ingredient.recordset.length!==1||!ingredient.recordset[0].Enable||ingredient.recordset[0].RowCost===null||!Number.isFinite(Number(ingredient.recordset[0].RowCost))||Number(ingredient.recordset[0].RowCost)<0)throw Error('MASTER');
  const master=clean(ingredient.recordset[0].master);const cv=await new sql.Request(tx).input('master',sql.Char(10),master).input('sub',sql.Char(10),sub).query('SELECT c.Units FROM dbo.Tbl_UnitConversion c WITH (UPDLOCK,HOLDLOCK) JOIN dbo.Tbl_UnitSub s ON s.SubUnitID=c.SubUnitID WHERE c.MasterUnitID=@master AND c.SubUnitID=@sub AND c.Enable=1 AND s.SubItemEnable=1');if(cv.recordset.length!==1||!Number.isFinite(Number(cv.recordset[0].Units))||Number(cv.recordset[0].Units)<=0)throw Error('MASTER');
  const r=await q().input('item',sql.Char(15),item).input('master',sql.Char(10),master).input('sub',sql.Char(10),sub).input('qty',sql.Float,line.qty).input('price',sql.Float,Number(ingredient.recordset[0].RowCost)).query(old?'UPDATE dbo.Tbl_Recipies SET MasterUnitID=@master,UnitID=@sub,Qty=@qty,Price=@price WHERE LocCode=@loc AND MenuItmID=@product AND RowItemCode=@item':'INSERT dbo.Tbl_Recipies(MenuItmID,RowItemCode,MasterUnitID,UnitID,Qty,LocCode,Price) VALUES(@product,@item,@master,@sub,@qty,@loc,@price)');if(r.rowsAffected[0]!==1)throw Error('STALE');
 }
 await tx.commit();tx=undefined;return NextResponse.json({success:true});
}catch(e){if(tx)try{await tx.rollback()}catch{}return fail(e)}}
