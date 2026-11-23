// Re-authentication for /login-activity: UADMIN only, password checked
// against the same web password used at sign-in. Fail-closed everywhere.
import {NextRequest,NextResponse} from 'next/server';
import sql from 'mssql';
import {getPool,isDbConfigured} from '@/lib/db';
import {verifyPassword} from '@/lib/auth';
import {getSessionFromRequest} from '@/lib/session';
import {authLimit} from '@/lib/sqlAuthSecurity';
import {makeLoginActivityToken,isUAdmin,LOGIN_ACTIVITY_COOKIE} from '@/lib/loginActivityGuard';

export const runtime='nodejs';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(req:NextRequest){
 try{
  const session=await getSessionFromRequest();
  if(!session)return json({error:'Please sign in again.'},401);
  if(!isUAdmin(session))return json({error:'Not found.'},404);
  const limit=await authLimit(`login-activity-reauth:${String(session.userId).toLowerCase()}`,5,900);
  if(!limit.allowed)return json({error:'Too many attempts. Please try again later.'},429);
  const body=await req.json().catch(()=>null);
  const password=String((body as {password?:unknown})?.password??'');
  if(!password||password.length>256)return json({error:'Enter your password.'},400);
  if(!isDbConfigured())return json({error:'Service unavailable.'},500);
  const pool=await getPool();
  const res=await pool.request().input('uid',sql.Char(10),session.userId)
   .query(`SELECT TOP 1 u.PasswordWeb AS Password,u.Enable FROM Tbl_UserDetails u WHERE LTRIM(RTRIM(u.UserId))=@uid`);
  const user=res.recordset[0];
  if(!user||!user.Enable||!verifyPassword(password,String(user.Password??'')))return json({error:'Incorrect password.'},401);
  const out=json({success:true});
  out.cookies.set(LOGIN_ACTIVITY_COOKIE,makeLoginActivityToken(session),{
   httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/login-activity',maxAge:10*60,
  });
  return out;
 }catch(e){console.error('Login activity re-auth failed:',e instanceof Error?e.name:'unknown');return json({error:'Unable to verify right now. Please try again.'},500)}
}
