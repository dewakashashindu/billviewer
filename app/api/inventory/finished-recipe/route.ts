import {NextRequest,NextResponse} from 'next/server';
import sql from 'mssql';
import {getPool} from '@/lib/db';
import {SESSION_COOKIE,verifySessionValue} from '@/lib/auth';
import {AccessDeniedError,requireWebPermission} from '@/lib/webAuthorization';
export const runtime='nodejs';
const clean=(v:unknown)=>typeof v==='string'?v.trim():'';
export async function GET(req:NextRequest){
 try {
  const token=req.cookies.get(SESSION_COOKIE)?.value, user=token?await verifySessionValue(token):null;
  if(!user)return NextResponse.json({error:'Please log in.'},{status:401});
  const access=await requireWebPermission(user,'items:VIEW');
  const item=clean(req.nextUrl.searchParams.get('item'));
  if(!item||item.length>15)return NextResponse.json({error:'Select a valid row item.'},{status:400});
  const pool=await getPool();
  const result=await pool.request().input('item',sql.Char(15),item).query(`
    SELECT RTRIM(r.RowItemCode) item, RTRIM(r.MenuItmID) recipe,
      (SELECT TOP 1 m.MenuItmDes FROM dbo.Tbl_MenuItems m WHERE m.MenuItmID=r.MenuItmID ORDER BY m.MenuItmDes) recipeName,
      RTRIM(r.MasterUnitID) master, RTRIM(r.UnitID) unit, r.Qty qty, RTRIM(r.LocCode) location,
      (SELECT TOP 1 u.UnitDes FROM dbo.Tbl_Unit u WHERE u.UnitID=r.MasterUnitID ORDER BY u.UnitDes) masterName,
      (SELECT TOP 1 s.SubUnitDes FROM dbo.Tbl_UnitSub s WHERE s.SubUnitID=r.UnitID ORDER BY s.SubUnitDes) unitName,
      (SELECT TOP 1 l.LocDes FROM dbo.Tbl_LocationMaster l WHERE l.LocCode=r.LocCode ORDER BY l.LocDes) locationName
    FROM dbo.Tbl_Recipies r WHERE r.RowItemCode=@item
    ORDER BY r.LocCode,r.MenuItmID,r.MasterUnitID,r.UnitID`);
  const allowed=new Set([...access.locations].map(x=>clean(x).toUpperCase()));
  const lines=result.recordset.filter(r=>allowed.has(clean(r.location).toUpperCase()));
  return NextResponse.json({lines},{headers:{'Cache-Control':'no-store'}});
 } catch(e) {
  if(!(e instanceof AccessDeniedError))console.error('Finished recipe lookup:',e);
  return NextResponse.json({error:e instanceof AccessDeniedError?'Access denied.':'Unable to load recipe usage.'},{status:e instanceof AccessDeniedError?403:500});
 }
}
