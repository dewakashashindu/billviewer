import 'server-only';
import crypto from 'node:crypto';
import sql from 'mssql';
import {getPool} from '@/lib/db';
import {createSessionValue, verifySignedSessionValue, type SessionUser} from '@/lib/auth';

const hashId=(id:string)=>crypto.createHash('sha256').update(id,'utf8').digest('hex');
/** Insert/replace one active session per user under SQL row/range locks. */
export async function issueWebSession(user:Omit<SessionUser,'exp'|'sessionId'>, expectedHash:string) {
 const sessionId=crypto.randomBytes(32).toString('hex');
 const token=createSessionValue({...user,sessionId});
 const tx=new sql.Transaction(await getPool());
 await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try {
  const r=await new sql.Request(tx).input('id',sql.Char(10),user.userId).query(`SELECT Enable,PasswordWeb FROM dbo.Tbl_UserDetails WITH (UPDLOCK,HOLDLOCK) WHERE UserId=@id`);
  if(r.recordset.length!==1||!r.recordset[0].Enable||String(r.recordset[0].PasswordWeb??'')!==expectedHash) throw Error('SESSION_USER_CHANGED');
  await new sql.Request(tx).input('id',sql.Char(10),user.userId).input('hash',sql.Char(64),hashId(sessionId)).query(`
   IF EXISTS (SELECT 1 FROM dbo.Tbl_WebSession WITH (UPDLOCK,HOLDLOCK) WHERE UserID=@id)
    UPDATE dbo.Tbl_WebSession SET SessionHash=@hash,ExpireAt=DATEADD(hour,24,GETUTCDATE()) WHERE UserID=@id;
   ELSE INSERT dbo.Tbl_WebSession(UserID,SessionHash,ExpireAt) VALUES(@id,@hash,DATEADD(hour,24,GETUTCDATE()));`);
  await tx.commit();return token;
 } catch(e){try{await tx.rollback()}catch{}throw e}
}
export async function checkWebSession(user:SessionUser){
 const r=await (await getPool()).request().input('id',sql.Char(10),user.userId).input('hash',sql.Char(64),hashId(user.sessionId)).query(`
  SELECT s.UserID FROM dbo.Tbl_WebSession s JOIN dbo.Tbl_UserDetails u ON u.UserId=s.UserID
  WHERE s.UserID=@id AND s.SessionHash=@hash AND s.ExpireAt>GETUTCDATE() AND u.Enable=1`);
 return r.recordset.length===1;
}
/** Only revoke this cookie's session: a stale logout must not revoke a newer login. */
export async function revokeWebSession(token:string){
 const user=verifySignedSessionValue(token);if(!user)return;
 await (await getPool()).request().input('id',sql.Char(10),user.userId).input('hash',sql.Char(64),hashId(user.sessionId)).query('DELETE FROM dbo.Tbl_WebSession WHERE UserID=@id AND SessionHash=@hash');
}
