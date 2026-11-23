// Step-up guard for the hidden /login-activity screen.
// Rules: only user UADMIN, and even UADMIN must re-enter the account
// password on every visit. The proof is a short-lived (10 min) HMAC cookie
// bound to the current session id, so it dies with the session and cannot
// be copied to another browser/session.
import crypto from 'crypto';
import type {SessionUser} from '@/lib/auth';

export const LOGIN_ACTIVITY_COOKIE='mcf_login_activity';
export const isUAdmin=(u:Pick<SessionUser,'userId'>|null|undefined)=>!!u&&String(u.userId??'').trim().toUpperCase()==='UADMIN';

function secret():string{
 const v=process.env.SESSION_SECRET??'';
 if(!/^[0-9a-f]{64}$/i.test(v))throw new Error('SESSION_SECRET not configured');
 return v;
}
const sign=(body:string)=>crypto.createHmac('sha256',secret()).update(body).digest('base64url');
const sessionBind=(s:SessionUser)=>crypto.createHash('sha256').update(String(s.sessionId??'')).digest('hex');

export function makeLoginActivityToken(session:SessionUser):string{
 const payload={uid:'UADMIN',bind:sessionBind(session),exp:Math.floor(Date.now()/1000)+10*60};
 const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
 return `${body}.${sign(body)}`;
}

export function verifyLoginActivityToken(value:string|undefined,session:SessionUser|null):boolean{
 try{
  if(!value||!session||!isUAdmin(session))return false;
  const [body,sig]=value.split('.');
  if(!body||!sig)return false;
  const expected=sign(body);
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
  const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8')) as {uid?:string;bind?:string;exp?:number};
  return payload.uid==='UADMIN'&&payload.bind===sessionBind(session)&&typeof payload.exp==='number'&&payload.exp>Math.floor(Date.now()/1000);
 }catch{return false}
}
