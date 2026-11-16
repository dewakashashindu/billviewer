import crypto from 'node:crypto';

/** QR tokens are persistent until the dedicated secret is rotated. */
function key():Buffer {
 const secret=process.env.ORDER_TOKEN_SECRET??'';
 if(!/^[0-9a-f]{64}$/i.test(secret))throw Error('ORDER_TOKEN_SECRET must contain 32 random bytes in hex');
 return Buffer.from(secret,'hex');
}
export type TableQrPayload={table:string;location:string;group:string};
function valid(p:TableQrPayload){return !!p.table&&p.table.length<=50&&!!p.location&&p.location.length<=10&&p.group.length<=50}
export function signTableToken(table:string,location:string,group=''):string {
 const p={table:table.trim(),location:location.trim(),group:group.trim()};if(!valid(p))throw Error('Invalid QR table/location');
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(p),'utf8'),cipher.final()]);
 return 'v2.'+Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function readTableToken(token:string):TableQrPayload|null {
 if(!token.startsWith('v2.')||token.length>2048)return null;
 const k=key();
 try{const data=Buffer.from(token.slice(3),'base64url');if(data.length<29)return null;
  const decipher=crypto.createDecipheriv('aes-256-gcm',k,data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));
  const o=JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8'));
  if(!o||typeof o.table!=='string'||typeof o.location!=='string'||typeof o.group!=='string'||!valid(o))return null;
  return o;
 }catch{return null}
}
/** No anonymous development bypass: token is required for every ordering request. */
export function checkTableAccess(table:string,token:string,location=''):
 {ok:true;location:string;group:string}|{ok:false;error:string;status:number} {
 const p=token?readTableToken(token):null;
 if(!p||p.table.trim().toUpperCase()!==table.trim().toUpperCase()||
   (location.trim()&&p.location.trim().toUpperCase()!==location.trim().toUpperCase()))
  return {ok:false,error:'Invalid table or location. Please scan the table QR again.',status:403};
 return {ok:true,location:p.location,group:p.group};
}
