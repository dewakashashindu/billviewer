import 'server-only';
import crypto from 'node:crypto';
import sql from 'mssql';
import {getPool} from '@/lib/db';

const hash=(value:string)=>crypto.createHash('sha256').update(value,'utf8').digest('hex');
export const resetTokenHash=(token:string)=>hash(token);
/** Atomic fixed window, database UTC time; a blocked request does not extend the window. */
export async function authLimit(key:string, limit:number, windowSeconds:number){
 const tx=new sql.Transaction(await getPool());
 await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
  const r=await new sql.Request(tx).input('key',sql.Char(64),hash(key)).input('limit',sql.Int,limit).input('seconds',sql.Int,windowSeconds).query(`
   DECLARE @now datetime=GETUTCDATE(), @count int, @start datetime;
   SELECT @count=HitCount,@start=WindowStart FROM dbo.Tbl_WebAuthRateLimit WITH (UPDLOCK,HOLDLOCK) WHERE RateKey=@key;
   IF @count IS NULL BEGIN INSERT dbo.Tbl_WebAuthRateLimit (RateKey,HitCount,WindowStart) VALUES (@key,1,@now); SELECT CAST(1 AS bit) allowed,0 retryAfter; END
   ELSE IF DATEADD(second,@seconds,@start)<=@now BEGIN UPDATE dbo.Tbl_WebAuthRateLimit SET HitCount=1,WindowStart=@now WHERE RateKey=@key; SELECT CAST(1 AS bit) allowed,0 retryAfter; END
   ELSE IF @count>=@limit SELECT CAST(0 AS bit) allowed,DATEDIFF(second,@now,DATEADD(second,@seconds,@start))+1 retryAfter;
   ELSE BEGIN UPDATE dbo.Tbl_WebAuthRateLimit SET HitCount=HitCount+1 WHERE RateKey=@key; SELECT CAST(1 AS bit) allowed,0 retryAfter; END`);
  await tx.commit();return {allowed:!!r.recordset[0].allowed,retryAfterSeconds:Number(r.recordset[0].retryAfter)};
 }catch(e){try{await tx.rollback()}catch{}throw e}
}
export async function createResetToken(token:string,userId:string){
 await (await getPool()).request().input('hash',sql.Char(64),hash(token)).input('user',sql.Char(10),userId).query(`INSERT dbo.Tbl_WebResetToken(TokenHash,UserID,ExpireAt,Used) VALUES(@hash,@user,DATEADD(minute,10,GETUTCDATE()),0)`);
}
