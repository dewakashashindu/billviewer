import {NextRequest,NextResponse} from 'next/server';
import {SESSION_COOKIE,verifySessionValue} from '@/lib/auth';
import {loadWebAuthorization} from '@/lib/webAuthorization';
import {loadInventoryProfile} from '@/lib/inventoryProfile';
export async function GET(req:NextRequest){
 try{
  const token=req.cookies.get(SESSION_COOKIE)?.value,user=token?await verifySessionValue(token):null;
  if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});
  const access=await loadWebAuthorization(user);
  const inventory=['locations','categories','items','units','modes','suppliers','po','grn','srn','damage','trq','tn','tr','irq','inn','recon'];
  if(!inventory.some(k=>access.permissions.has(`${k}:VIEW`)||access.permissions.has(`${k}:PRINT`)))return NextResponse.json({error:'Access denied.'},{status:403});
  return NextResponse.json(await loadInventoryProfile(),{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Inventory profile lookup failed:',e);return NextResponse.json({error:'Unable to load print profile. Check the inventory profile configuration.'},{status:500})}
}
