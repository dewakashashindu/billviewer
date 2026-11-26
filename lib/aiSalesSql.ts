// Guarded execution path for AI-generated sales + inventory SQL.
//
// This is deliberately fail-closed and is only used when the route has
// verified (against SQL Server itself) that the AI_DB login is read-only
// on the approved views. The validator below is defence-in-depth on top of
// that database-enforced boundary — it is NOT a substitute for it.
//
// Rules enforced here:
//  - exactly one statement, starting with SELECT or WITH
//  - no write/DDL/admin/dynamic-SQL constructs, variables or temp tables
//  - FROM/JOIN may reference only the approved views (or CTEs)
//  - every referenced dated view must be filtered on its date column
//    (snapshot views such as the item master are exempt; TOP still applies)
//  - no UNION/INTERSECT/EXCEPT (keeps row-limit enforcement simple)
//  - an outer TOP (<= 200) is required; TOP (50) is injected when missing
export const AI_SQL_VIEWS=['VW_SalesSummery','Vw_SalesDetail','Vw_Sales_PaymentCategories','Vw_VoidBeforeSettlement','Vw_RowItemMaster','Vw_StockMovement','Vw_GRNDetails','Vw_PODetails','Vw_SRNDetails','Vw_DamageDetails','Vw_Reconcilliation','Vw_Recipies','Vw_RecipiesSemiFinishedprod','Vw_TransferNoteDetail','Vw_IssueNoteDetail','Vw_UnitConversion'] as const;
// Date column that must appear in the query when the view is referenced.
// Views not listed here are snapshots (item master, recipes, conversions)
// and need no date filter; the outer TOP still bounds the result.
const viewDates:Record<string,string[]>={vw_salessummery:['txndate'],vw_salesdetail:['txndate'],vw_sales_paymentcategories:['txndate'],vw_voidbeforesettlement:['txndate'],vw_stockmovement:['txndate'],vw_grndetails:['grndate'],vw_podetails:['podate'],vw_srndetails:['srndate'],vw_damagedetails:['txndate'],vw_reconcilliation:['recdate'],vw_transfernotedetail:['tradate'],vw_issuenotedetail:['indate']};
const allowed=new Set(AI_SQL_VIEWS.map(v=>v.toLowerCase()));
const banned=new Set(['insert','update','delete','merge','drop','alter','create','truncate','exec','execute','grant','revoke','deny','into','openrowset','opendatasource','bulk','dbcc','shutdown','backup','restore','waitfor','declare','cursor','use','set','print','raiserror','throw','begin','commit','rollback','transaction','save','kill','updlock','tablock','tablockx','union','intersect','except']);
type Tok={kind:'word'|'ident'|'string'|'number'|'punct';lower:string;start:number;end:number;depth:number};
function tokenize(sql:string):Tok[]|null{
 const toks:Tok[]=[];let depth=0;let i=0;
 const push=(kind:Tok['kind'],lower:string,start:number,end:number)=>{const t:Tok={kind,lower,start,end,depth};if(lower===')')t.depth=--depth;else if(lower==='(')depth++;toks.push(t)};
 while(i<sql.length){
  const c=sql[i];
  if(/\s/.test(c)){i++;continue}
  if(c==='-'&&sql[i+1]==='-')return null;
  if(c==='/'&&sql[i+1]==='*')return null;
  if(c==="'"){let j=i+1;while(j<sql.length){if(sql[j]==="'"){if(sql[j+1]==="'"){j+=2;continue}break}j++}if(j>=sql.length)return null;push('string','',i,j+1);i=j+1;continue}
  if(c==='['){let j=i+1;while(j<sql.length&&sql[j]!==']')j++;if(j>=sql.length)return null;push('ident',sql.slice(i+1,j).toLowerCase(),i,j+1);i=j+1;continue}
  if(c==='"'){let j=i+1;while(j<sql.length&&sql[j]!=='"')j++;if(j>=sql.length)return null;push('ident',sql.slice(i+1,j).toLowerCase(),i,j+1);i=j+1;continue}
  if(/[A-Za-z_]/.test(c)){let j=i;while(j<sql.length&&/[A-Za-z0-9_]/.test(sql[j]))j++;push('word',sql.slice(i,j).toLowerCase(),i,j);i=j;continue}
  if(/[0-9]/.test(c)){let j=i;while(j<sql.length&&/[0-9.]/.test(sql[j]))j++;push('number',sql.slice(i,j),i,j);i=j;continue}
  push('punct',c,i,i+1);i++;
 }
 return toks;
}
export function validateAiSql(input:unknown):string|null{
 if(typeof input!=='string')return null;
 let text=input.trim();
 if(text.startsWith('```'))text=text.replace(/^```[a-zA-Z]*\s*/,'').replace(/```\s*$/,'').trim();
 if(text.length<10||text.length>4000)return null;
 const toks=tokenize(text);if(!toks||!toks.length)return null;
 // One statement only; a single trailing semicolon is stripped.
 const semis=toks.filter(t=>t.lower===';');
 if(semis.length>1||(semis.length===1&&semis[0]!==toks[toks.length-1]))return null;
 const body=semis.length?text.slice(0,semis[0].start).trimEnd():text;
 const bt=semis.length?toks.slice(0,-1):toks;
 if(!bt.length)return null;
 if(bt[0].lower!=='select'&&bt[0].lower!=='with')return null;
 for(const t of bt){
  if(t.kind==='word'&&(banned.has(t.lower)||t.lower.startsWith('xp_')||t.lower.startsWith('sp_')))return null;
  if(t.lower==='@'||t.lower==='#')return null;
 }
 // CTE names defined before the main (last depth-0) SELECT.
 const selectIdxs=bt.map((t,i)=>({t,i})).filter(x=>x.t.kind==='word'&&x.t.lower==='select'&&x.t.depth===0);
 if(!selectIdxs.length)return null;
 const mainIdx=selectIdxs[selectIdxs.length-1].i;
 const ctes=new Set<string>();
 if(bt[0].lower==='with'){
  for(let i=1;i<mainIdx;i++){
   const t=bt[i];if(t.kind!=='word'&&t.kind!=='ident')continue;
   if(bt[i+1]?.lower==='as'&&bt[i+2]?.lower==='(')ctes.add(t.lower);
   else if(bt[i+1]?.lower==='('){let d=0,j=i+1;for(;j<bt.length;j++){if(bt[j].lower==='(')d++;else if(bt[j].lower===')'){d--;if(!d)break}}if(bt[j+1]?.lower==='as'&&bt[j+2]?.lower==='(')ctes.add(t.lower)}
  }
 }
 // Every FROM/JOIN target must be an approved view or a CTE.
 let viewRefs=0;const refs:string[]=[];
 for(let i=0;i<bt.length;i++){
  if(bt[i].kind!=='word'||(bt[i].lower!=='from'&&bt[i].lower!=='join'))continue;
  const n=bt[i+1];if(!n||n.lower==='(')continue;
  if(n.kind!=='word'&&n.kind!=='ident')return null;
  const parts=[n.lower];let j=i+1;
  while(bt[j+1]?.lower==='.'&&(bt[j+2]?.kind==='word'||bt[j+2]?.kind==='ident')){parts.push(bt[j+2].lower);j+=2}
  const name=parts[parts.length-1];
  if(ctes.has(name))continue;
  if(!allowed.has(name))return null;
  viewRefs++;refs.push(name);
 }
 // Each referenced dated view must actually be filtered on its date column.
 for(const name of refs){const dates=viewDates[name];if(dates&&!dates.some(d=>bt.some(t=>t.kind==='word'&&t.lower===d)))return null;}
 if(!viewRefs)return null;
 // Outer TOP: validate when present, inject TOP (50) when missing.
 let j=mainIdx+1;
 if(bt[j]?.lower==='distinct'||bt[j]?.lower==='all')j++;
 if(bt[j]?.lower==='top'){
  let n:number|null=null;const a=bt[j+1];
  if(a?.lower==='('&&bt[j+2]?.kind==='number'&&bt[j+3]?.lower===')')n=Number(bt[j+2].lower);
  else if(a?.kind==='number')n=Number(a.lower);
  if(n===null||!Number.isInteger(n)||n<1||n>200)return null;
  const after=bt[j+1]?.lower==='('?bt[j+4]:bt[j+2];
  if(after?.lower==='percent')return null;
  return body;
 }
 const insertAt=bt[j-1].end;
 return body.slice(0,insertAt)+' TOP (50)'+body.slice(insertAt);
}
export function aiSqlSystemPrompt(today:string){
 return `You write ONE read-only Microsoft SQL Server SELECT query for a restaurant sales or inventory question. Return only a JSON object: {"sql":"..."} or {"unsupported":true} when the question is not about data in the views below (for example expiry dates, batch numbers, supplier payment balances, price changes or forecasts — those are not recorded). Today is ${today} (Asia/Colombo).
VIEWS (use only these, always schema-qualify as dbo.<name>):
- dbo.VW_SalesSummery: bill-level. Columns: LocCode, LocDes, BillNo, Txndate, TxnTime, Gross, DisPre, DisVal, GrossAfterDis, SerChg, OtherSerChg, VAT, OtherVAT, TDL, PackChg, DelChg, NetTotal, SalesWOTAX, NOPax, BillType, OrderMode, CasherID, UserName, StewID, Steward, TableNo, DoNotShowInSales.
- dbo.Vw_SalesDetail: item-level (one row per sold item; do NOT sum bill totals like NetTotal here). Columns: LocCode, LocDes, BillNo, SubItmId, MenuItmDes, Qty, SalesPrice, TotalItmPrice, CostPrice, Txndate, TxnTime, BillType, OrderMode, CasherID, UserName, StewID, Steward, Category, NOPax, DoNotShowInSales, BIRTHNO.
- dbo.Vw_Sales_PaymentCategories: one row per payment transaction. Columns: LocCode, LocDes, PayCode, PayDes, ActAmt, TenderedAmt, CasherID, UserName, Txndate. (No DoNotShowInSales/BillType columns.)
- dbo.Vw_VoidBeforeSettlement: voided items before settlement. Columns: LOCCODE, TxnDate, TxnTime, ItemDes, Qty, SalesPrice, VOIDTYPE, CASHER, CASHERNAME, StewId, OrderMode, BillNo.
INVENTORY VIEWS (use only these, always schema-qualify as dbo.<name>):
- dbo.Vw_RowItemMaster: current recorded stock per item-location (snapshot, no date). Columns: LocCode, LocDes, RowItemCode, RowItmDes, UnitDes, RowCost, ROL, ROQ, MinQty, MaxQty, StkBal, CatDes, SupName, Enable. StkBal is the RECORDED balance in the master unit; it can be zero or negative when postings are missing.
- dbo.Vw_StockMovement: stock ledger. Columns: LocCode, LocDes, RowItemCode, RowItmDes, TxnType (GRN/DM/SR/RC), TxnDate, PreQty, TxnQty, LastQty, UserName, Remarks, AddDeduct (+/-/).
- dbo.Vw_GRNDetails: goods received lines. Columns: LocCode, LocDes, GRNNO, GRNDate, SupID, SupName, ItemCode, RowItmDes, UnitDes, GRNQty, FreeQty, CostPrice, ItemValue, Confirmed, NetTotal (header total repeated on every line — never SUM it; use ItemValue).
- dbo.Vw_PODetails: purchase order lines. Columns: LocCode, LocDes, PONO, PODate, SupID, SupName, ItemCode, RowItmDes, UnitDes, POQty, GRNedQTY, CostPrice, ItemValue, Confirmed.
- dbo.Vw_SRNDetails: supplier return lines. Columns: LocCode, LocDes, SRNNo, SRNDate, SupID, SupName, ItemCode, RowItmDes, SRNQty, ItemValue, Confirmed.
- dbo.Vw_DamageDetails: damage/wastage lines. Columns: LocCode, LocDes, DamNo, TxnDate, ItemCode, RowItmDes, DmgQty, CostPrice, ItemValue, UserName, Confirmed.
- dbo.Vw_Reconcilliation: stock-count lines. Columns: LocCode, LocDes, RecNo, RecDate, ItemCode, RowItmDes, SysQty, RecQty, CostPrice, Confirmed.
- dbo.Vw_Recipies: recipe lines per menu item. Columns: LocCode, LocDes, MenuItmID, MenuItmDes, RowItemCode, RowItmDes, Qty (in the sub-unit), UnitID, MasterUnitID, Units (sub-units per master unit; master qty = Qty/Units), SalesPrice, CostPrice, RowCost.
- dbo.Vw_RecipiesSemiFinishedprod: semi-finished recipe lines. Columns: LocCode, MenuItmID, MenuItmDes, RowItemCode, RowItmDes, SubUnitID, Qty, MasterUnitID, Units.
- dbo.Vw_TransferNoteDetail: transfer lines. Columns: FromLocCode, LocDes, ToLoc, ToLocDes, TranNo, TraDate, ItemCode, RowItmDes, TRQTy (requested), TranQty (transferred), ItemValue, Confirmed.
- dbo.Vw_IssueNoteDetail: issue lines. Columns: FromLocCode, LocDes, ToLoc, ToLocDes, INNO, INDate, ItemCode, RowItmDes, UnitDes, IRQty (requested), INQty (issued), CostPrice, ItemValue, Confirmed.
- dbo.Vw_UnitConversion: Columns: MasterUnitID, UnitDes, SubUnitID, SubUnitDes, Units (sub-units per one master unit), Enable.
RULES:
- Single SELECT statement (CTEs allowed). No other statement types. Never reference tables, only these views.
- Combining several measures into one comparison or ranking IS supported: compute each measure in CTEs or joins on the shared key (SupID, ItemCode or LocCode) and ORDER BY the result. If one requested aspect has no matching column in any view (for example damage cannot be attributed to a supplier), still answer the remaining aspects — return unsupported ONLY when no part of the question maps to the listed views.
- For VW_SalesSummery and Vw_SalesDetail always add: ISNULL(LTRIM(RTRIM(DoNotShowInSales)),'0')<>'1' AND ISNULL(LTRIM(RTRIM(BillType)),'')<>'CM'.
- Always restrict by the date column of each dated view you use (Txndate, GRNDate, PODate, SRNDate, TxnDate, RecDate, TraDate, INDate) to the period in the question; default to today for sales and the current month for inventory history. Use style-23 date literals like '2026-11-01'. For an inclusive end date use < DATEADD(day,1,'YYYY-MM-DD').
- Document views (GRN, PO, SRN, Damage, Reconcilliation, Transfer, Issue): Confirmed is a 'Y'/'N' character — count confirmed documents only with UPPER(RTRIM(Confirmed))='Y'. Never compare it to a number.
- RTRIM location and item codes in output and joins. A main location code (e.g. '01') also has sub-locations ('01_1','01_2','01_3'): when the user names a main location, match LocCode='01' OR LocCode LIKE '01[_]%' (for transfers/issues the sending side is FromLocCode).
- Stock and cost figures are recorded data: present StkBal/RowCost as recorded values, never as guaranteed physical stock. Recipe quantities convert with Qty/Units.
- Use TOP (at most 200) on the outer SELECT and meaningful column aliases in plain English.
- Aggregate sensibly; group by the breakdown the user asked for. Order results helpfully (usually highest first).
- Do not invent columns, views or values. Filter values must come from the user's question.
- Keep the query as small as the question allows.
- Put raw SQL in the sql field only; no markdown fences or commentary. If a previousSql and problem are provided, return a corrected query that fixes that problem.`;
}
