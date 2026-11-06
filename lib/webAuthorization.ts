import 'server-only';
import sql from 'mssql';
import {getPool} from '@/lib/db';
import {decryptAccess,requireAccessKey} from '@/lib/webAccessCrypto';
import {WEB_ACCESS_SECTIONS,WEB_ACCESS_KEYS} from '@/lib/webAccessCatalog';
import {REPORT_ACCESS_SCREENS} from '@/lib/reportAccessCatalog';
import type {SessionUser} from '@/lib/auth';

/** Server-side authorization foundation. Callers must still enforce it at every entry point. */
export class AccessDeniedError extends Error {
  constructor(){super('Access denied');this.name='AccessDeniedError'}
}
const clean=(value:unknown)=>typeof value==='string'?value.trim():'';
const nodes=WEB_ACCESS_SECTIONS.flatMap(group=>group.screens.map(screen=>({id:screen.id,actions:screen.actions as readonly string[],parent:group.title})));

export async function loadWebAuthorization(session:SessionUser){
  requireAccessKey();
  const userId=clean(session.userId);
  if(!userId || userId.length>10)throw new AccessDeniedError();
  const pool=await getPool();
  const [users,entries]=await Promise.all([
    pool.request().input('id',sql.Char(10),userId).query('SELECT RTRIM(LOCCODE) AS homeLocation, Enable AS enabled FROM dbo.Tbl_UserDetails WHERE UserId=@id'),
    pool.request().input('id',sql.Char(10),userId).query('SELECT FuncID,Auth,Module,ACCESS FROM dbo.Tbl_UserAuthorizationWeb WHERE UserID=@id')
  ]);
  if(users.recordset.length!==1 || !users.recordset[0].enabled)throw new AccessDeniedError();
  const home=clean(users.recordset[0].homeLocation);
  const permissions=new Set<string>(),locations=new Set<string>(),seen=new Set<string>();
  let legacyReports:string|null=null;
  let hasIndividualReports=false;
  for(const row of entries.recordset){
    const module=clean(row.Module);
    if(module==='APF'){decryptAccess(clean(row.FuncID));continue}
    if(module==='LOC'){const loc=decryptAccess(clean(row.FuncID));if(!loc||loc.length>10)throw new AccessDeniedError();if(row.Auth)locations.add(loc);continue}
    const id=decryptAccess(clean(row.FuncID));
    if(id==='reports'&&module==='Reports'){if(legacyReports!==null)throw new AccessDeniedError();legacyReports=decryptAccess(clean(row.ACCESS));if(!/^[01]{2}$/.test(legacyReports))throw new AccessDeniedError();continue}
    if(module==='Reports')hasIndividualReports=true;
    const node=nodes.find(n=>n.id===id&&n.parent===module);
    if(!node||seen.has(id))throw new AccessDeniedError();
    seen.add(id);
    const rawMask=decryptAccess(clean(row.ACCESS));
    const mask=id==='items' && rawMask.length===1 ? rawMask+'0' : rawMask;
    if(mask.length!==node.actions.length||!/^[01]+$/.test(mask))throw new AccessDeniedError();
    node.actions.forEach((action,i)=>{if(mask[i]==='1')permissions.add(`${id}:${action}`)});
  }
  if(legacyReports&&!hasIndividualReports){
    for(const report of REPORT_ACCESS_SCREENS){
      if(legacyReports[0]==='1')permissions.add(`${report.id}:VIEW`);
      if(legacyReports[1]==='1')permissions.add(`${report.id}:PRINT`);
    }
  }
  // No assigned locations: fall back only to a non-empty home location.
  // If neither exists, keep the set empty so location-scoped operations deny access.
  if(locations.size===0 && home)locations.add(home);
  return {permissions,locations};
}
export async function requireWebPermission(session:SessionUser,key:string){
  if(!WEB_ACCESS_KEYS.has(key))throw new AccessDeniedError();
  const access=await loadWebAuthorization(session);
  if(!access.permissions.has(key))throw new AccessDeniedError();
  return access;
}
export function requireWebLocation(access:{locations:Set<string>},location:string){
  const loc=clean(location);
  if(!loc||!access.locations.has(loc))throw new AccessDeniedError();
  return loc;
}
