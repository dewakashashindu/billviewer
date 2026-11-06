import 'server-only';
import sql from 'mssql';
import {decryptAccess} from '@/lib/webAccessCrypto';

// Conservative: inventory document item codes and POS menu item codes are not
// proven equivalent. A matching code anywhere is therefore treated as in use.
// All listed checks are required; a missing table/column or query failure aborts.
const itemRefs: readonly [string,string][] = [
  ['Tbl_PODetails','ItemCode'], ['Tbl_GRNDetails','ItemCode'],
  ['Tbl_SRNDetails','ItemCode'], ['Tbl_DamageDetails','ItemCode'], ['Tbl_ReconcilDetails','ItemCode'],
  ['Tbl_TransferReqDetail','ItemCode'], ['Tbl_TransferNoteDetail','ItemCode'],
  ['Tbl_TransferReturnDetail','ItemCode'], ['Tbl_IssueReqDetail','ItemCode'], ['Tbl_IssueNoteDetail','ItemCode'],
  ['Tbl_BillDetails','SubItmId'],
];
const locationRefs: readonly [string,readonly string[]][] = [
  ['Tbl_RowItems',['LocCode']], ['Tbl_UserDetails',['LocCode']], ['Tbl_TxnNumbers',['LocCode']],
  ['Tbl_BillHeader',['LocCode']], ['Tbl_POHeader',['LocCode']], ['Tbl_PODetails',['LocCode']],
  ['Tbl_GRNHeader',['LocCode']], ['Tbl_GRNDetails',['LocCode']],
  ['Tbl_SRNHeader',['LocCode']], ['Tbl_SRNDetails',['LocCode']],
  ['Tbl_DamageHeder',['LocCode']], ['Tbl_DamageDetails',['LocCode']],
  ['Tbl_ReconcilHeder',['LocCode']], ['Tbl_ReconcilDetails',['LocCode']],
  ['Tbl_TransferReqHeder',['FromLocCode','ToLoc']], ['Tbl_TransferReqDetail',['FromLocCode','ToLoc']],
  ['Tbl_TransferNoteHeader',['FromLocCode','ToLoc']], ['Tbl_TransferNoteDetail',['FromLocCode','ToLoc']],
  ['Tbl_TransferReturnHeader',['FromLocCode','ToLoc']], ['Tbl_TransferReturnDetail',['FromLocCode','ToLoc']],
  ['Tbl_IssueReqHeder',['FromLocCode','ToLoc']], ['Tbl_IssueReqDetail',['FromLocCode','ToLoc']],
  ['Tbl_IssueNoteHeder',['FromLocCode','ToLoc']], ['Tbl_IssueNoteDetail',['FromLocCode','ToLoc']],
];
async function check(tx:sql.Transaction, table:string, columns:readonly string[], value:string){
  // table/columns are hardcoded above, never user input. Serializable range/table
  // locks are held until commit so a concurrent reference insert cannot race it.
  const where=columns.map(c=>`[${c}]=@value`).join(' OR ');
  const result=await new sql.Request(tx).input('value',sql.NVarChar(50),value)
    .query(`SELECT TOP (1) 1 AS used FROM dbo.[${table}] WITH (TABLOCKX,HOLDLOCK) WHERE ${where}`);
  if(result.recordset.length)throw Error('REFERENCE_IN_USE');
}
export async function ensureItemUnreferenced(tx:sql.Transaction,code:string){
  for(const [table,column] of itemRefs)await check(tx,table,[column],code);
}
export async function ensureLocationUnreferenced(tx:sql.Transaction,code:string){
  await check(tx,'Tbl_LocationMaster',['MainLoc'],code);
  for(const [table,columns] of locationRefs)await check(tx,table,columns,code);
  // Web location assignments are AES-encrypted, so compare decrypted IDs.
  for(const table of ['Tbl_UserAccess_StdProfile','Tbl_UserAuthorizationWeb']){
    const r=await new sql.Request(tx).query(`SELECT FuncID FROM dbo.[${table}] WITH (TABLOCKX,HOLDLOCK) WHERE Module='LOC'`);
    for(const row of r.recordset){
      const id=decryptAccess(String(row.FuncID??'').trim()).trim();
      if(id.toUpperCase()===code.toUpperCase())throw Error('REFERENCE_IN_USE');
    }
  }
}
