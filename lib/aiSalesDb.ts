import 'server-only';
import sql from 'mssql';
let connection:Promise<sql.ConnectionPool>|null=null;
export function aiDbConfigured(){return !!(process.env.AI_DB_SERVER&&process.env.AI_DB_DATABASE&&process.env.AI_DB_USER&&process.env.AI_DB_PASSWORD)}
export function getAiSalesPool(){
 if(!aiDbConfigured())throw Error('AI_DB_NOT_CONFIGURED');
 if(!connection){const p=new sql.ConnectionPool({server:process.env.AI_DB_SERVER!,database:process.env.AI_DB_DATABASE!,user:process.env.AI_DB_USER!,password:process.env.AI_DB_PASSWORD!,port:Number(process.env.AI_DB_PORT||1433),requestTimeout:15000,connectionTimeout:15000,options:{encrypt:process.env.AI_DB_ENCRYPT!=='false',trustServerCertificate:process.env.AI_DB_TRUST_SERVER_CERT==='true',enableArithAbort:true},pool:{max:4,min:0,idleTimeoutMillis:30000}});connection=p.connect().catch(e=>{connection=null;throw e});}
 return connection;
}

// Fail-closed check used before any AI-generated SQL may run: the AI login
// must be able to SELECT the approved sales views and must NOT hold any
// write/DDL permission on them, nor powerful fixed roles. Cached per
// process; any error means "not verified" and AI SQL stays disabled.
let readOnlyCheck:Promise<boolean>|null=null;
export function aiLoginIsReadOnly(pool:sql.ConnectionPool){
 if(!readOnlyCheck){readOnlyCheck=(async()=>{try{
  const views=['VW_SalesSummery','Vw_SalesDetail','Vw_Sales_PaymentCategories','Vw_VoidBeforeSettlement'];
  const perView=views.map((v,i)=>`HAS_PERMS_BY_NAME('dbo.${v}','OBJECT','SELECT') AS sel${i}, HAS_PERMS_BY_NAME('dbo.${v}','OBJECT','INSERT') AS ins${i}, HAS_PERMS_BY_NAME('dbo.${v}','OBJECT','UPDATE') AS upd${i}, HAS_PERMS_BY_NAME('dbo.${v}','OBJECT','DELETE') AS del${i}, HAS_PERMS_BY_NAME('dbo.${v}','OBJECT','ALTER') AS alt${i}, HAS_PERMS_BY_NAME('dbo.${v}','OBJECT','CONTROL') AS ctl${i}`).join(', ');
  const r=await pool.request().query(`SELECT CASE WHEN IS_SRVROLEMEMBER('sysadmin')=1 OR IS_MEMBER('db_owner')=1 OR IS_MEMBER('db_datawriter')=1 THEN 0 ELSE 1 END AS rolesOk, ${perView}`);
  const row=r.recordset[0] as Record<string,number>;
  if(!row||row.rolesOk!==1)return false;
  return views.every((_,i)=>row[`sel${i}`]===1&&row[`ins${i}`]===0&&row[`upd${i}`]===0&&row[`del${i}`]===0&&row[`alt${i}`]===0&&row[`ctl${i}`]===0);
 }catch{return false}})();}
 return readOnlyCheck;
}
