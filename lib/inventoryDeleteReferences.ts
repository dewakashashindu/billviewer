import 'server-only';
import sql from 'mssql';

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
  ['Tbl_BillHeader',['LocCode']], ['Tbl_BillDetails',['LocCode']], ['Tbl_BillPayTxn',['LocCode']],
  ['Tbl_TxnMovement',['LocCode']], ['Tbl_TxnSerial',['LocCode']], ['Tbl_RecipiesSemiFinishedprod',['LocCode']], ['Tbl_POHeader',['LocCode']], ['Tbl_PODetails',['LocCode']],
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
// These reference masters can be global in some POS schemas. Check any
// location columns they actually expose rather than inventing a column name.
const referenceMasters=['Tbl_MenuItems','Tbl_Maincategory','Tbl_Subcategory1','Tbl_Subcategory2','Tbl_Subcategory3','Tbl_Subcategory4','Tbl_Subcategory5','Tbl_SupplierDetails','Tbl_Unit','Tbl_UnitSub','Tbl_UnitConversion','Tbl_OrderModes','Tbl_PaymentModes','Tbl_PaymentGroup'] as const;
export async function ensureLocationUnreferenced(tx:sql.Transaction,code:string){
  await check(tx,'Tbl_LocationMaster',['MainLoc'],code);
  for(const [table,columns] of locationRefs)await check(tx,table,columns,code);
  for(const table of referenceMasters){
    const meta=await new sql.Request(tx).input('table',sql.NVarChar(128),table).query(`SELECT c.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id WHERE s.name='dbo' AND t.name=@table`);
    if(!meta.recordset.length)throw Error('REFERENCE_SCHEMA');
    const columns=meta.recordset.map((r:{name:string})=>r.name).filter((name:string)=>['LOCCODE','FROMLOCCODE','TOLOC'].includes(name.toUpperCase()));
    if(columns.length)await check(tx,table,columns,code);
  }
}

