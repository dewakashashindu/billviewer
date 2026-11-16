import 'server-only';
import {getPool} from '@/lib/db';
export async function loadInventoryProfile(){
 const rows=(await (await getPool()).request().query('SELECT TOP 2 Add1, Add2, Add3, Add4, Tel FROM dbo.Tbl_InvProfile')).recordset;
 if(rows.length!==1)throw Error('INVENTORY_PROFILE_NOT_UNIQUE');
 const r=rows[0],clean=(x:unknown)=>typeof x==='string'?x.trim():'';
 return {address:[r.Add1,r.Add2,r.Add3,r.Add4].map(clean).filter(Boolean),tel:clean(r.Tel)};
}
