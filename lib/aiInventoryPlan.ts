// Constrained inventory plans: the model never supplies SQL, identifiers or
// expressions. Every template below is a fixed, reviewed query over an
// approved inventory view; only dates and filter values are bound as SQL
// parameters. Location filters use the ROLLUP rule chosen by the owner:
// a main location code (e.g. 01) also matches its sub-locations (01_1, ...).
// Stock figures are only as good as the recorded balances/costs, so snapshot
// templates always travel with coverage facts computed in the route.
export type InventoryPlan={domain:'inventory';template:string;location?:string;item?:string;supplier?:string;dimension?:string;from?:string;to?:string;limit:number;order:'asc'|'desc';semi?:boolean};
type Row=Record<string,unknown>;
type Template={title:string;kind:'snapshot'|'history';format:'currency'|'number'|'quantity'|'percent';dims?:string[];build:(p:InventoryPlan)=>string;latest?:string;basisNote?:string;display:(r:Row)=>string};

const num=(v:unknown)=>v===null||v===undefined?null:Number(v);
const fmtN=(v:unknown)=>{const n=num(v);return n===null||!Number.isFinite(n)?'—':n.toLocaleString(undefined,{maximumFractionDigits:2})};
const fmtM=(v:unknown)=>{const n=num(v);return n===null||!Number.isFinite(n)?'—':`LKR ${n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`};
const s=(v:unknown)=>String(v??'').trim();
const locPred=(codeCol='RTRIM(v.LocCode)',desCol='RTRIM(v.LocDes)')=>`(${codeCol}=@loc OR ${codeCol} LIKE @locPat ESCAPE '\\' OR ${desCol}=@loc)`;
const loc=(p:InventoryPlan,codeCol?:string,desCol?:string)=>p.location?` AND ${locPred(codeCol,desCol)}`:'';
const itemOn=(p:InventoryPlan,col:string)=>p.item?` AND ${col} LIKE @item ESCAPE '\\'`:'';
const range=(col:string)=>`${col}>=@from AND ${col}<DATEADD(day,1,CONVERT(date,@to,23))`;
const ITEM_LABEL=`COALESCE(NULLIF(RTRIM(v.RowItmDes),''),RTRIM(v.RowItemCode))`;
const GRN_LABEL=`COALESCE(NULLIF(RTRIM(v.RowItmDes),''),RTRIM(v.ItemCode))`;
const LOC_LABEL=`COALESCE(NULLIF(RTRIM(v.LocDes),''),RTRIM(v.LocCode))`;
const n0=(v:unknown)=>{const n=num(v);return n===null||!Number.isFinite(n)?0:n};
/** ROL family entered in millilitres on a LITER item (e.g. ROL 16,000 for
 * olive oil) makes reorder figures ~1000x too large. Flag it; never convert. */
export function isSuspectRol(unit:unknown,rol:unknown,roq?:unknown,minQty?:unknown,maxQty?:unknown):boolean {
 return s(unit).toUpperCase()==='LITER'&&Math.max(n0(rol),n0(roq),n0(minQty),n0(maxQty))>=1000;
}
const rolWarn=(r:Row)=>isSuspectRol(r.unit,r.rol,r.roq,r.minQty,r.maxQty)?' · ⚠ ROL entered in ml instead of LITER — verify item master':'';


const salesFilter=(p:InventoryPlan)=>`${range('s.Txndate')} AND COALESCE(RTRIM(s.BillType),'')<>'CM' AND COALESCE(RTRIM(CONVERT(varchar(10),s.DoNotShowInSales)),'0')<>'1'${loc(p,'RTRIM(s.LocCode)','RTRIM(s.LocDes)')}`;
/** Shared usage CTEs. Recipe usage (sold qty x recipe qty, converted to the
 * master unit via Units) expands ONE level of semi-finished recipes: a direct
 * ingredient that has its own semi-finished recipe is replaced by that
 * recipe's raw ingredients. Issue-note usage and damage are computed as
 * SEPARATE measures and are never added to recipe usage. */
const usageCtes=(p:InventoryPlan)=>`WITH sales AS (
  SELECT RTRIM(s.LocCode) AS LocCode, RTRIM(s.SubItmId) AS MenuID, SUM(COALESCE(s.Qty,0)) AS SoldQty
  FROM dbo.Vw_SalesDetail s WHERE ${salesFilter(p)} GROUP BY RTRIM(s.LocCode), RTRIM(s.SubItmId)
), stats AS (
  SELECT CASE WHEN MIN(CONVERT(date,s.Txndate)) IS NULL THEN DATEDIFF(day,CONVERT(date,@from,23),CONVERT(date,@to,23))+1 ELSE DATEDIFF(day,MIN(CONVERT(date,s.Txndate)),CONVERT(date,@to,23))+1 END AS days
  FROM dbo.Vw_SalesDetail s WHERE ${salesFilter(p)}
), expanded AS (
  SELECT RTRIM(r.LocCode) AS LocCode, RTRIM(r.MenuItmID) AS MenuID, RTRIM(r.RowItemCode) AS ItemCode,
    COALESCE(NULLIF(RTRIM(r.RowItmDes),''),RTRIM(r.RowItemCode)) AS ItemName,
    (COALESCE(r.Qty,0)/NULLIF(r.Units,0)) AS MasterQty, 0 AS IsSemi
  FROM dbo.Vw_Recipies r${p.semi===false?'':`
  WHERE NOT EXISTS (SELECT 1 FROM dbo.Vw_RecipiesSemiFinishedprod sf0 WHERE RTRIM(sf0.LocCode)=RTRIM(r.LocCode) AND RTRIM(sf0.MenuItmID)=RTRIM(r.RowItemCode))
  UNION ALL
  SELECT RTRIM(r.LocCode), RTRIM(r.MenuItmID), RTRIM(sf.RowItemCode),
    COALESCE(NULLIF(RTRIM(sf.RowItmDes),''),RTRIM(sf.RowItemCode)),
    (COALESCE(r.Qty,0)/NULLIF(r.Units,0))*(COALESCE(sf.Qty,0)/NULLIF(sf.Units,0)), 1
  FROM dbo.Vw_Recipies r
  JOIN dbo.Vw_RecipiesSemiFinishedprod sf ON RTRIM(sf.LocCode)=RTRIM(r.LocCode) AND RTRIM(sf.MenuItmID)=RTRIM(r.RowItemCode)`}
), recipeUsage AS (
  SELECT e.LocCode, e.ItemCode, MAX(e.ItemName) AS ItemName,
    SUM(s.SoldQty*COALESCE(e.MasterQty,0)) AS RecipeUsage,
    SUM(CASE WHEN e.IsSemi=1 THEN s.SoldQty*COALESCE(e.MasterQty,0) ELSE 0 END) AS SemiUsage
  FROM sales s JOIN expanded e ON e.LocCode=s.LocCode AND e.MenuID=s.MenuID
  GROUP BY e.LocCode, e.ItemCode
), issueUsage AS (
  SELECT RTRIM(i.FromLocCode) AS LocCode, RTRIM(i.ItemCode) AS ItemCode,
    MAX(COALESCE(NULLIF(RTRIM(i.RowItmDes),''),RTRIM(i.ItemCode))) AS ItemName,
    SUM(COALESCE(i.INQty,0)) AS IssueUsage, COUNT(DISTINCT RTRIM(i.INNO)) AS IssueDocs, MAX(RTRIM(i.UnitDes)) AS UnitDes
  FROM dbo.Vw_IssueNoteDetail i
  WHERE UPPER(RTRIM(i.Confirmed))='Y' AND ${range('i.INDate')}${loc(p,'RTRIM(i.FromLocCode)','RTRIM(i.LocDes)')}${itemOn(p,'i.RowItmDes')}
  GROUP BY RTRIM(i.FromLocCode), RTRIM(i.ItemCode)
), damageUsage AS (
  SELECT RTRIM(d.LocCode) AS LocCode, RTRIM(d.ItemCode) AS ItemCode,
    MAX(COALESCE(NULLIF(RTRIM(d.RowItmDes),''),RTRIM(d.ItemCode))) AS ItemName, SUM(COALESCE(d.DmgQty,0)) AS DamageQty
  FROM dbo.Vw_DamageDetails d
  WHERE UPPER(RTRIM(d.Confirmed))='Y' AND ${range('d.TxnDate')}${loc(p,'RTRIM(d.LocCode)','RTRIM(d.LocDes)')}${itemOn(p,'d.RowItmDes')}
  GROUP BY RTRIM(d.LocCode), RTRIM(d.ItemCode)
)`;

export const inventoryTemplates:Record<string,Template>={
 stock_position:{title:'Current stock position',kind:'snapshot',format:'quantity',
  build:p=>`SELECT TOP (${p.limit}) (RTRIM(v.LocCode)+' · '+${ITEM_LABEL}) AS label, COALESCE(v.StkBal,0) AS value, RTRIM(v.UnitDes) AS unit, COALESCE(v.ROL,0) AS rol, COALESCE(v.ROQ,0) AS roq, COALESCE(v.MinQty,0) AS minQty, COALESCE(v.MaxQty,0) AS maxQty, COALESCE(v.RowCost,0) AS cost FROM dbo.Vw_RowItemMaster v WHERE v.Enable=1${loc(p)}${itemOn(p,'v.RowItmDes')} ORDER BY value ${p.order==='asc'?'ASC':'DESC'}`,
  display:r=>`${fmtN(r.value)} ${s(r.unit)}${num(r.rol)?` · ROL ${fmtN(r.rol)}`:''}${num(r.cost)?` · cost ${fmtM(r.cost)}`:' · no unit cost recorded'}${rolWarn(r)}`},
 below_rol:{title:'Items below reorder level',kind:'snapshot',format:'quantity',
  build:p=>`SELECT TOP (${p.limit}) (RTRIM(v.LocCode)+' · '+${ITEM_LABEL}) AS label, (COALESCE(v.ROL,0)-COALESCE(v.StkBal,0)) AS value, COALESCE(v.StkBal,0) AS stk, COALESCE(v.ROL,0) AS rol, CASE WHEN COALESCE(v.ROQ,0)>0 THEN COALESCE(v.ROL,0)+COALESCE(v.ROQ,0)-COALESCE(v.StkBal,0) ELSE COALESCE(v.ROL,0)-COALESCE(v.StkBal,0) END AS suggested, COALESCE(v.MinQty,0) AS minQty, COALESCE(v.MaxQty,0) AS maxQty, RTRIM(v.UnitDes) AS unit, COALESCE(NULLIF(RTRIM(v.SupName),''),'') AS supplier, COALESCE(v.RowCost,0) AS cost FROM dbo.Vw_RowItemMaster v WHERE v.Enable=1 AND COALESCE(v.ROL,0)>0 AND COALESCE(v.StkBal,0)<=COALESCE(v.ROL,0)${loc(p)}${itemOn(p,'v.RowItmDes')} ORDER BY value DESC`,
  display:r=>isSuspectRol(r.unit,r.rol,r.roq,r.minQty,r.maxQty)?`stock ${fmtN(r.stk)} · recorded ROL ${fmtN(r.rol)} ${s(r.unit)} · ⚠ ROL entered in ml instead of LITER — suggested order withheld, verify item master`:`stock ${fmtN(r.stk)} · ROL ${fmtN(r.rol)} · shortfall ${fmtN(r.value)} ${s(r.unit)} · suggested order ${fmtN(r.suggested)}${s(r.supplier)?` · ${s(r.supplier)}`:''}${num(r.cost)?` · est. ${fmtM((num(r.suggested)??0)*(num(r.cost)??0))}`:' · no unit cost recorded'}`},
 stock_exceptions:{title:'Zero and negative recorded stock',kind:'snapshot',format:'quantity',
  build:p=>`SELECT TOP (${p.limit}) (RTRIM(v.LocCode)+' · '+${ITEM_LABEL}) AS label, COALESCE(v.StkBal,0) AS value, RTRIM(v.UnitDes) AS unit, COALESCE(v.ROL,0) AS rol FROM dbo.Vw_RowItemMaster v WHERE v.Enable=1 AND (COALESCE(v.StkBal,0)<0 OR (COALESCE(v.StkBal,0)=0 AND COALESCE(v.ROL,0)>0))${loc(p)}${itemOn(p,'v.RowItmDes')} ORDER BY value ASC`,
  display:r=>`${fmtN(r.value)} ${s(r.unit)}${num(r.rol)?` · ROL ${fmtN(r.rol)} (recorded stock is ${num(r.value)!==null&&num(r.value)!<0?'negative':'zero'})`:' (recorded stock is negative)'}`},
 stock_value:{title:'Recorded stock value',kind:'snapshot',format:'currency',dims:['location','category'],
  build:p=>{const dim=p.dimension==='category'?`COALESCE(NULLIF(RTRIM(v.CatDes),''),'(no main category)')`:LOC_LABEL;return `SELECT TOP (${p.limit}) ${dim} AS label, SUM(COALESCE(v.StkBal,0)*COALESCE(v.RowCost,0)) AS value, COUNT_BIG(*) AS items, SUM(CASE WHEN COALESCE(v.RowCost,0)>0 THEN 1 ELSE 0 END) AS costed, SUM(CASE WHEN COALESCE(v.StkBal,0)<>0 THEN 1 ELSE 0 END) AS stocked FROM dbo.Vw_RowItemMaster v WHERE v.Enable=1${loc(p)} GROUP BY ${dim} ORDER BY value ${p.order==='asc'?'ASC':'DESC'}`},
  display:r=>`${fmtM(r.value)} recorded value · ${fmtN(r.items)} items · unit cost recorded for ${fmtN(r.costed)} · non-zero balance for ${fmtN(r.stocked)}`},
 stock_health:{title:'Stock data health by location',kind:'snapshot',format:'number',
  build:p=>`SELECT TOP (${p.limit}) (RTRIM(v.LocCode)+' · '+${LOC_LABEL}) AS label, SUM(CASE WHEN COALESCE(v.StkBal,0)<0 THEN 1 ELSE 0 END) AS value, SUM(CASE WHEN COALESCE(v.StkBal,0)>0 THEN 1 ELSE 0 END) AS positive, SUM(CASE WHEN COALESCE(v.StkBal,0)=0 THEN 1 ELSE 0 END) AS zero, COUNT_BIG(*) AS items, SUM(CASE WHEN COALESCE(v.ROL,0)>0 THEN 1 ELSE 0 END) AS rolset, SUM(CASE WHEN COALESCE(v.RowCost,0)>0 THEN 1 ELSE 0 END) AS costed FROM dbo.Vw_RowItemMaster v WHERE v.Enable=1${loc(p)} GROUP BY RTRIM(v.LocCode), ${LOC_LABEL} ORDER BY value DESC`,
  display:r=>`${fmtN(r.value)} negative · ${fmtN(r.positive)} positive · ${fmtN(r.zero)} zero of ${fmtN(r.items)} items · ROL set for ${fmtN(r.rolset)} · unit cost set for ${fmtN(r.costed)}`},
 purchases_supplier:{title:'Purchases by supplier (GRN)',kind:'history',format:'currency',
  build:p=>`SELECT TOP (${p.limit}) COALESCE(NULLIF(RTRIM(v.SupName),''),RTRIM(v.SupID)) AS label, SUM(COALESCE(v.ItemValue,0)) AS value, SUM(COALESCE(v.GRNQty,0)) AS qty, COUNT(DISTINCT RTRIM(v.GRNNO)) AS docs FROM dbo.Vw_GRNDetails v WHERE UPPER(RTRIM(v.Confirmed))='Y' AND ${range('v.GRNDate')}${loc(p)}${p.supplier?` AND v.SupName LIKE @supplier ESCAPE '\\'`:''} GROUP BY COALESCE(NULLIF(RTRIM(v.SupName),''),RTRIM(v.SupID)) ORDER BY value ${p.order==='asc'?'ASC':'DESC'}`,
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,GRNDate)),23) AS latest FROM dbo.Vw_GRNDetails WHERE UPPER(RTRIM(Confirmed))='Y'`,
  display:r=>`${fmtM(r.value)} · ${fmtN(r.qty)} qty received (excl. free qty) · ${fmtN(r.docs)} GRNs`},
 purchase_price:{title:'Average purchase price',kind:'history',format:'currency',
  build:p=>`SELECT TOP (${p.limit}) ${GRN_LABEL} AS label, SUM(CASE WHEN ${range('v.GRNDate')} THEN COALESCE(v.ItemValue,0) ELSE 0 END)/NULLIF(SUM(CASE WHEN ${range('v.GRNDate')} THEN COALESCE(v.GRNQty,0) ELSE 0 END),0) AS value, SUM(CASE WHEN ${range('v.GRNDate')} THEN COALESCE(v.GRNQty,0) ELSE 0 END) AS qty, SUM(CASE WHEN v.GRNDate>=@prevFrom AND v.GRNDate<DATEADD(day,1,CONVERT(date,@to,23)) AND NOT (${range('v.GRNDate')}) THEN COALESCE(v.ItemValue,0) ELSE 0 END)/NULLIF(SUM(CASE WHEN v.GRNDate>=@prevFrom AND v.GRNDate<DATEADD(day,1,CONVERT(date,@to,23)) AND NOT (${range('v.GRNDate')}) THEN COALESCE(v.GRNQty,0) ELSE 0 END),0) AS prevavg, SUM(CASE WHEN ${range('v.GRNDate')} THEN COALESCE(v.ItemValue,0) ELSE 0 END) AS spend FROM dbo.Vw_GRNDetails v WHERE UPPER(RTRIM(v.Confirmed))='Y' AND v.GRNDate>=@prevFrom${loc(p)}${itemOn(p,'v.RowItmDes')} GROUP BY ${GRN_LABEL} HAVING SUM(CASE WHEN ${range('v.GRNDate')} THEN COALESCE(v.GRNQty,0) ELSE 0 END)>0 ORDER BY spend DESC`,
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,GRNDate)),23) AS latest FROM dbo.Vw_GRNDetails WHERE UPPER(RTRIM(Confirmed))='Y'`,
  display:r=>{const cur=num(r.value),prev=num(r.prevavg);const ch=cur!==null&&prev!==null&&prev!==0?((cur-prev)/Math.abs(prev))*100:null;return `avg ${fmtM(r.value)} per unit · qty ${fmtN(r.qty)}${prev!==null?` · previous period avg ${fmtM(prev)}${ch!==null?` (${ch>=0?'+':''}${ch.toFixed(1)}%)`:''}`:' · no previous-period purchases'}`}},
 open_po:{title:'Open purchase orders (not fully received)',kind:'history',format:'quantity',
  build:p=>`SELECT TOP (${p.limit}) (RTRIM(v.PONO)+' · '+COALESCE(NULLIF(RTRIM(v.RowItmDes),''),RTRIM(v.ItemCode))) AS label, (COALESCE(v.POQty,0)-COALESCE(v.GRNedQTY,0)) AS value, COALESCE(v.POQty,0) AS ordered, COALESCE(v.GRNedQTY,0) AS received, COALESCE(NULLIF(RTRIM(v.SupName),''),'') AS supplier, CONVERT(varchar(10),v.PODate,23) AS podate, DATEDIFF(day,CONVERT(date,v.PODate),CONVERT(date,@today)) AS age, RTRIM(v.UnitDes) AS unit, ${LOC_LABEL} AS locname FROM dbo.Vw_PODetails v WHERE UPPER(RTRIM(v.Confirmed))='Y' AND COALESCE(v.POQty,0)>COALESCE(v.GRNedQTY,0)${loc(p)}${itemOn(p,'v.RowItmDes')} ORDER BY age DESC, value DESC`,
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,PODate)),23) AS latest FROM dbo.Vw_PODetails WHERE UPPER(RTRIM(Confirmed))='Y'`,
  display:r=>`open ${fmtN(r.value)} of ${fmtN(r.ordered)} ${s(r.unit)} (received ${fmtN(r.received)}) · ${s(r.supplier)} · PO date ${s(r.podate)} · ${fmtN(r.age)} days old · ${s(r.locname)}`},
 supplier_returns:{title:'Supplier returns (SRN)',kind:'history',format:'currency',
  build:p=>`SELECT TOP (${p.limit}) COALESCE(NULLIF(RTRIM(v.SupName),''),RTRIM(v.SupID)) AS label, SUM(COALESCE(v.ItemValue,0)) AS value, SUM(COALESCE(v.SRNQty,0)) AS qty, COUNT(DISTINCT RTRIM(v.SRNNo)) AS docs, MAX(g.purchased) AS purchased FROM dbo.Vw_SRNDetails v LEFT JOIN (SELECT RTRIM(SupID) AS sid, SUM(COALESCE(ItemValue,0)) AS purchased FROM dbo.Vw_GRNDetails WHERE UPPER(RTRIM(Confirmed))='Y' AND ${range('GRNDate')} GROUP BY RTRIM(SupID)) g ON g.sid=RTRIM(v.SupID) WHERE UPPER(RTRIM(v.Confirmed))='Y' AND ${range('v.SRNDate')}${loc(p)} GROUP BY COALESCE(NULLIF(RTRIM(v.SupName),''),RTRIM(v.SupID)) ORDER BY value DESC`,
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,SRNDate)),23) AS latest FROM dbo.Vw_SRNDetails WHERE UPPER(RTRIM(Confirmed))='Y'`,
  display:r=>{const pv=num(r.purchased);const rate=pv!==null&&pv>0&&num(r.value)!==null?((num(r.value) as number)/pv)*100:null;return `${fmtM(r.value)} returned · qty ${fmtN(r.qty)} · ${fmtN(r.docs)} SRNs${rate!==null?` · ${rate.toFixed(1)}% of purchase value`:''}`}},
 damage_analysis:{title:'Damage / wastage',kind:'history',format:'currency',dims:['item','location','user'],
  build:p=>{const dim=p.dimension==='location'?LOC_LABEL:p.dimension==='user'?`COALESCE(NULLIF(RTRIM(v.UserName),''),RTRIM(v.UserId))`:`COALESCE(NULLIF(RTRIM(v.RowItmDes),''),RTRIM(v.ItemCode))`;return `SELECT TOP (${p.limit}) ${dim} AS label, SUM(COALESCE(v.ItemValue,0)) AS value, SUM(COALESCE(v.DmgQty,0)) AS qty, COUNT(DISTINCT RTRIM(v.DamNo)) AS docs FROM dbo.Vw_DamageDetails v WHERE UPPER(RTRIM(v.Confirmed))='Y' AND ${range('v.TxnDate')}${loc(p)}${itemOn(p,'v.RowItmDes')} GROUP BY ${dim} ORDER BY value DESC`},
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,TxnDate)),23) AS latest FROM dbo.Vw_DamageDetails WHERE UPPER(RTRIM(Confirmed))='Y'`,
  display:r=>`${fmtM(r.value)} damage value · qty ${fmtN(r.qty)} · ${fmtN(r.docs)} damage notes`},
 item_movement:{title:'Item movement history',kind:'history',format:'quantity',
  build:p=>`SELECT TOP (${p.limit}) (CONVERT(varchar(10),v.TxnDate,23)+' · '+RTRIM(v.TxnType)+' · '+${LOC_LABEL}) AS label, CASE RTRIM(v.AddDeduct) WHEN '+' THEN COALESCE(v.TxnQty,0) WHEN '-' THEN -COALESCE(v.TxnQty,0) ELSE COALESCE(v.LastQty,0)-COALESCE(v.PreQty,0) END AS value, COALESCE(v.PreQty,0) AS pre, COALESCE(v.LastQty,0) AS last, RTRIM(v.UserName) AS [user], COALESCE(NULLIF(RTRIM(v.RowItmDes),''),RTRIM(v.RowItemCode)) AS itemname, COALESCE(NULLIF(RTRIM(v.Remarks),''),'') AS remarks FROM dbo.Vw_StockMovement v WHERE ${range('v.TxnDate')}${loc(p)}${itemOn(p,'v.RowItmDes')} ORDER BY v.TxnDate DESC, v.TxndateTime DESC`,
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,TxnDate)),23) AS latest FROM dbo.Vw_StockMovement`,
  display:r=>`${num(r.value)!==null&&(num(r.value) as number)>=0?'+':''}${fmtN(r.value)} · balance ${fmtN(r.pre)} → ${fmtN(r.last)} · ${s(r.itemname)}${s(r.user)?` · by ${s(r.user)}`:''}${s(r.remarks)?` · ${s(r.remarks)}`:''}`},
 recon_variance:{title:'Stock count variance (reconciliation)',kind:'history',format:'currency',dims:['item','location'],
  build:p=>{const dim=p.dimension==='location'?LOC_LABEL:`COALESCE(NULLIF(RTRIM(v.RowItmDes),''),RTRIM(v.ItemCode))`;return `SELECT TOP (${p.limit}) ${dim} AS label, SUM((COALESCE(v.RecQty,0)-COALESCE(v.SysQty,0))*COALESCE(v.CostPrice,0)) AS value, SUM(COALESCE(v.RecQty,0)-COALESCE(v.SysQty,0)) AS qtyvar, SUM(COALESCE(v.SysQty,0)) AS sysq, SUM(COALESCE(v.RecQty,0)) AS recq, COUNT_BIG(*) AS lines FROM dbo.Vw_Reconcilliation v WHERE UPPER(RTRIM(v.Confirmed))='Y' AND ${range('v.RecDate')}${loc(p)}${itemOn(p,'v.RowItmDes')} GROUP BY ${dim} ORDER BY ABS(SUM((COALESCE(v.RecQty,0)-COALESCE(v.SysQty,0))*COALESCE(v.CostPrice,0))) DESC`},
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,RecDate)),23) AS latest FROM dbo.Vw_Reconcilliation WHERE UPPER(RTRIM(Confirmed))='Y'`,
  display:r=>`variance ${fmtM(r.value)} · qty variance ${fmtN(r.qtyvar)} (system ${fmtN(r.sysq)} vs counted ${fmtN(r.recq)}) · ${fmtN(r.lines)} count lines`},
 recipe_cost:{title:'Recipe cost and food-cost %',kind:'snapshot',format:'percent',
  build:p=>`SELECT TOP (${p.limit}) COALESCE(NULLIF(RTRIM(v.MenuItmDes),''),RTRIM(v.MenuItmID)) AS label, 100.0*SUM((COALESCE(v.Qty,0)/NULLIF(v.Units,0))*COALESCE(v.RowCost,0))/NULLIF(MAX(COALESCE(v.SalesPrice,0)),0) AS value, SUM((COALESCE(v.Qty,0)/NULLIF(v.Units,0))*COALESCE(v.RowCost,0)) AS computed, MAX(COALESCE(v.CostPrice,0)) AS recorded, MAX(COALESCE(v.SalesPrice,0)) AS price, COUNT_BIG(*) AS ingredients, SUM(CASE WHEN COALESCE(v.RowCost,0)>0 THEN 1 ELSE 0 END) AS costed FROM dbo.Vw_Recipies v WHERE 1=1${loc(p)}${itemOn(p,'v.MenuItmDes')} GROUP BY COALESCE(NULLIF(RTRIM(v.MenuItmDes),''),RTRIM(v.MenuItmID)) ORDER BY value DESC`,
  display:r=>`computed ingredient cost ${fmtM(r.computed)} · POS-recorded dish cost ${fmtM(r.recorded)} · selling price ${fmtM(r.price)} · food-cost ${r.value===null||r.value===undefined?'—':Number(r.value).toFixed(1)+'%'} · ingredient unit cost recorded for ${fmtN(r.costed)} of ${fmtN(r.ingredients)} ingredients`},
 transfer_summary:{title:'Stock transfers',kind:'history',format:'currency',dims:['route','item'],
  build:p=>{const dim=p.dimension==='item'?`COALESCE(NULLIF(RTRIM(v.RowItmDes),''),RTRIM(v.ItemCode))`:`(${LOC_LABEL}+' -> '+COALESCE(NULLIF(RTRIM(v.ToLocDes),''),RTRIM(v.ToLoc)))`;return `SELECT TOP (${p.limit}) ${dim} AS label, SUM(COALESCE(v.ItemValue,0)) AS value, SUM(COALESCE(v.TranQty,0)) AS qty, COUNT(DISTINCT RTRIM(v.TranNo)) AS docs FROM dbo.Vw_TransferNoteDetail v WHERE UPPER(RTRIM(v.Confirmed))='Y' AND ${range('v.TraDate')}${p.location?` AND ${locPred('RTRIM(v.FromLocCode)',"RTRIM(v.LocDes)")}`:''}${itemOn(p,'v.RowItmDes')} GROUP BY ${dim} ORDER BY value DESC`},
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,TraDate)),23) AS latest FROM dbo.Vw_TransferNoteDetail WHERE UPPER(RTRIM(Confirmed))='Y'`,
  display:r=>`${fmtM(r.value)} · qty ${fmtN(r.qty)} · ${fmtN(r.docs)} transfer notes`},
 issue_analysis:{title:'Stock issues',kind:'history',format:'currency',dims:['item','toLocation','route'],
  build:p=>{const dim=p.dimension==='toLocation'?`COALESCE(NULLIF(RTRIM(v.ToLocDes),''),RTRIM(v.ToLoc))`:p.dimension==='route'?`(${LOC_LABEL}+' -> '+COALESCE(NULLIF(RTRIM(v.ToLocDes),''),RTRIM(v.ToLoc)))`:`COALESCE(NULLIF(RTRIM(v.RowItmDes),''),RTRIM(v.ItemCode))`;return `SELECT TOP (${p.limit}) ${dim} AS label, SUM(COALESCE(v.ItemValue,0)) AS value, SUM(COALESCE(v.INQty,0)) AS qty, SUM(COALESCE(v.IRQty,0)) AS requested, COUNT(DISTINCT RTRIM(v.INNO)) AS docs FROM dbo.Vw_IssueNoteDetail v WHERE UPPER(RTRIM(v.Confirmed))='Y' AND ${range('v.INDate')}${p.location?` AND ${locPred('RTRIM(v.FromLocCode)',"RTRIM(v.LocDes)")}`:''}${itemOn(p,'v.RowItmDes')} GROUP BY ${dim} ORDER BY value DESC`},
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,INDate)),23) AS latest FROM dbo.Vw_IssueNoteDetail WHERE UPPER(RTRIM(Confirmed))='Y'`,
  display:r=>`${fmtM(r.value)} issued · qty ${fmtN(r.qty)} of ${fmtN(r.requested)} requested · ${fmtN(r.docs)} issue notes`},

 usage_analysis:{title:'Item usage (recipe-based, issues separate)',kind:'history',format:'quantity',
  basisNote:'recipe usage = sold qty x recipe qty (direct recipes plus one level of semi-finished recipes), converted to the master unit; issue-note usage is a separate measure and is never added to recipe usage; damage is excluded',
  build:p=>`${usageCtes(p)}, keys AS (
    SELECT LocCode, ItemCode, ItemName FROM recipeUsage
    UNION SELECT LocCode, ItemCode, ItemName FROM issueUsage
    UNION SELECT LocCode, ItemCode, ItemName FROM damageUsage
  )
  SELECT TOP (${p.limit}) (k.LocCode+' · '+COALESCE(NULLIF(RTRIM(m.RowItmDes),''),k.ItemName)) AS label,
    COALESCE(r.RecipeUsage,0) AS value, COALESCE(r.SemiUsage,0) AS semi, COALESCE(i.IssueUsage,0) AS issueQty,
    COALESCE(i.IssueDocs,0) AS issueDocs, COALESCE(d.DamageQty,0) AS damageQty, stats.days AS days,
    COALESCE(NULLIF(RTRIM(m.UnitDes),''),COALESCE(i.UnitDes,'')) AS unit
  FROM keys k
  LEFT JOIN recipeUsage r ON r.LocCode=k.LocCode AND r.ItemCode=k.ItemCode
  LEFT JOIN issueUsage i ON i.LocCode=k.LocCode AND i.ItemCode=k.ItemCode
  LEFT JOIN damageUsage d ON d.LocCode=k.LocCode AND d.ItemCode=k.ItemCode
  LEFT JOIN dbo.Vw_RowItemMaster m ON RTRIM(m.LocCode)=k.LocCode AND RTRIM(m.RowItemCode)=k.ItemCode AND m.Enable=1
  CROSS JOIN stats${p.item?` WHERE k.ItemName LIKE @item ESCAPE '\\'`:''}
  ORDER BY value ${p.order==='asc'?'ASC':'DESC'}`,
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,Txndate)),23) AS latest FROM dbo.Vw_SalesDetail`,
  display:r=>{const days=n0(r.days)||1;const avg=n0(r.value)/days;return `${fmtN(r.value)} ${s(r.unit)} used via recipes in the period (avg ${fmtN(avg)}/day${n0(r.semi)?` · incl. ${fmtN(r.semi)} via semi-finished recipes`:''}) · issue notes: ${n0(r.issueDocs)?`${fmtN(r.issueQty)} ${s(r.unit)} in ${fmtN(r.issueDocs)} confirmed notes (separate measure, not added)`:'no confirmed issue notes in the period'} · damage ${fmtN(r.damageQty)} ${s(r.unit)} recorded separately and excluded`}},
 stock_forecast:{title:'Stock cover and reorder alerts',kind:'history',format:'quantity',
  basisNote:'days of cover = recorded stock / average daily usage over the period (recipe-based usage preferred, issue-note usage only when there is no recipe usage; the two are never blended); suggested order tops stock up to MaxQty (ROL+ROQ when MaxQty is not set), less stock already on open POs; suggestions are withheld when recorded stock is negative or the ROL figures look like millilitre entries',
  build:p=>`${usageCtes(p)}, stock AS (
    SELECT RTRIM(m.LocCode) AS LocCode, RTRIM(m.RowItemCode) AS ItemCode,
      COALESCE(NULLIF(RTRIM(m.RowItmDes),''),RTRIM(m.RowItemCode)) AS ItemName, RTRIM(m.UnitDes) AS unit,
      COALESCE(m.StkBal,0) AS stk, COALESCE(m.ROL,0) AS rol, COALESCE(m.ROQ,0) AS roq,
      COALESCE(m.MinQty,0) AS minQty, COALESCE(m.MaxQty,0) AS maxQty
    FROM dbo.Vw_RowItemMaster m WHERE m.Enable=1${loc(p,'RTRIM(m.LocCode)','RTRIM(m.LocDes)')}${itemOn(p,'m.RowItmDes')}
  ), openpo AS (
    SELECT RTRIM(v.LocCode) AS LocCode, RTRIM(v.ItemCode) AS ItemCode,
      SUM(CASE WHEN COALESCE(v.POQty,0)>COALESCE(v.GRNedQTY,0) THEN COALESCE(v.POQty,0)-COALESCE(v.GRNedQTY,0) ELSE 0 END) AS OpenQty
    FROM dbo.Vw_PODetails v WHERE UPPER(RTRIM(v.Confirmed))='Y' GROUP BY RTRIM(v.LocCode), RTRIM(v.ItemCode)
  )
  SELECT TOP (${p.limit}) (st.LocCode+' · '+st.ItemName) AS label,
    CASE WHEN COALESCE(r.RecipeUsage,0)>0 THEN CASE WHEN st.stk<=0 THEN 0 ELSE st.stk/(r.RecipeUsage/NULLIF(stats.days,0)) END
         WHEN COALESCE(i.IssueUsage,0)>0 THEN CASE WHEN st.stk<=0 THEN 0 ELSE st.stk/(i.IssueUsage/NULLIF(stats.days,0)) END END AS value,
    st.stk AS stk, COALESCE(r.RecipeUsage,0) AS recipeUsage, COALESCE(r.SemiUsage,0) AS semiUsage,
    COALESCE(i.IssueUsage,0) AS issueUsage, COALESCE(i.IssueDocs,0) AS issueDocs, COALESCE(d.DamageQty,0) AS damageQty,
    CASE WHEN COALESCE(r.RecipeUsage,0)>0 THEN 'recipe' ELSE 'issue notes' END AS basis,
    stats.days AS days, st.rol AS rol, st.roq AS roq, st.minQty AS minQty, st.maxQty AS maxQty,
    COALESCE(o.OpenQty,0) AS openQty, st.unit AS unit
  FROM stock st
  LEFT JOIN recipeUsage r ON r.LocCode=st.LocCode AND r.ItemCode=st.ItemCode
  LEFT JOIN issueUsage i ON i.LocCode=st.LocCode AND i.ItemCode=st.ItemCode
  LEFT JOIN damageUsage d ON d.LocCode=st.LocCode AND d.ItemCode=st.ItemCode
  LEFT JOIN openpo o ON o.LocCode=st.LocCode AND o.ItemCode=st.ItemCode
  CROSS JOIN stats
  WHERE COALESCE(r.RecipeUsage,0)+COALESCE(i.IssueUsage,0)>0
  ORDER BY value ASC`,
  latest:`SELECT CONVERT(varchar(10),MAX(CONVERT(date,Txndate)),23) AS latest FROM dbo.Vw_SalesDetail`,
  display:r=>{const days=n0(r.days)||1;const recipe=s(r.basis)==='recipe';const used=recipe?n0(r.recipeUsage):n0(r.issueUsage);const avg=used/days;const cover=num(r.value);const stk=n0(r.stk);
    const head=`recorded stock ${fmtN(stk)} ${s(r.unit)} · ${recipe?'recipe':'issue-note'} usage ${fmtN(used)} ${s(r.unit)} in ${fmtN(days)} days (avg ${fmtN(avg)}/day) · recorded cover ${cover===null?'—':fmtN(cover)+' days'}${cover!==null&&cover<=7?' · ⚠ within 7 days':''}`;
    if(stk<0)return `${head} · recorded balance is negative — verify with a stock count before ordering; suggested order withheld`;
    if(isSuspectRol(r.unit,r.rol,r.roq,r.minQty,r.maxQty))return `${head} · suggested order withheld${rolWarn(r)}`;
    const target=n0(r.maxQty)>0?n0(r.maxQty):n0(r.rol)+n0(r.roq);
    if(target<=0)return `${head} · no MaxQty/ROL+ROQ recorded, so no suggested order quantity`;
    const net=Math.max(0,Math.max(0,target-stk)-n0(r.openQty));
    return `${head} · suggested order ${fmtN(net)} ${s(r.unit)} (target ${fmtN(target)}${n0(r.openQty)?` · less ${fmtN(r.openQty)} already on open POs`:''}) · damage ${fmtN(r.damageQty)} ${s(r.unit)} excluded from usage`}},
};

function validDate(s:unknown):s is string {if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s}
const cleanText=(v:unknown,max:number)=>{if(typeof v!=='string')return undefined;const t=v.trim();if(!t||t.length>max||/[\u0000-\u001f]/.test(t))return undefined;return t};
const shift=(iso:string,n:number)=>new Date(Date.parse(iso)+n*86400000).toISOString().slice(0,10);

export function validateInventoryPlan(x:unknown,today:string):InventoryPlan|null {
 if(!x||typeof x!=='object')return null;const p=x as Record<string,unknown>;
 if(p.domain!=='inventory'||typeof p.template!=='string'||!Object.hasOwn(inventoryTemplates,p.template))return null;
 const t=inventoryTemplates[p.template];
 const plan:InventoryPlan={domain:'inventory',template:p.template,limit:10,order:'desc'};
 const badText=(v:unknown,max:number)=>v!==undefined&&v!==null&&(typeof v!=='string'||(v as string).trim().length>max||/[\u0000-\u001f]/.test(v as string));
 if(badText(p.location,30)||badText(p.item,80)||badText(p.supplier,80))return null;
 const location=cleanText(p.location,30);if(location)plan.location=location;
 const item=cleanText(p.item,80);if(item)plan.item=item;
 const supplier=cleanText(p.supplier,80);if(supplier)plan.supplier=supplier;
 if(t.dims){plan.dimension=typeof p.dimension==='string'&&t.dims.includes(p.dimension)?p.dimension:t.dims[0]}
 if(p.limit!==undefined){if(!Number.isInteger(p.limit)||Number(p.limit)<1||Number(p.limit)>20)return null;plan.limit=Number(p.limit)}
 if(p.order!==undefined){if(p.order!=='asc'&&p.order!=='desc')return null;plan.order=p.order}
 if(p.template==='item_movement'&&!plan.item)return null;
 if(t.kind==='history'){
  if(p.from!==undefined||p.to!==undefined){
   if(!validDate(p.from)||!validDate(p.to)||p.from>p.to||p.to>today||(Date.parse(p.to)-Date.parse(p.from))/86400000>366)return null;
   plan.from=p.from;plan.to=p.to;
  }else if(p.template==='usage_analysis'||p.template==='stock_forecast'){plan.from=shift(today,-29);plan.to=today}
  else{plan.from=today.slice(0,8)+'01';plan.to=today}
 }else if(p.from!==undefined||p.to!==undefined){
  if(!validDate(p.from)||!validDate(p.to)||p.from>p.to)return null;plan.from=p.from;plan.to=p.to;
 }
 return plan;
}
export function compileInventoryPlan(p:InventoryPlan){return inventoryTemplates[p.template].build(p)}
export function inventoryLatestSql(p:InventoryPlan){return inventoryTemplates[p.template].latest}
export function inventoryParams(p:InventoryPlan,today:string):Record<string,string>{
 const out:Record<string,string>={};
 if(p.from)out.from=p.from; if(p.to)out.to=p.to; out.today=today;
 if(p.from&&p.to){const days=Math.round((Date.parse(p.to)-Date.parse(p.from))/86400000)+1;out.prevTo=shift(p.from,-1);out.prevFrom=shift(p.from,-days)}
 if(p.location){out.loc=p.location;out.locPat=`${p.location}\\_%`}
 if(p.item)out.item='%'+p.item.replace(/\\/g,'\\\\').replace(/%/g,'\\%').replace(/_/g,'\\_').replace(/\[/g,'\\[')+'%';
 if(p.supplier)out.supplier='%'+p.supplier.replace(/\\/g,'\\\\').replace(/%/g,'\\%').replace(/_/g,'\\_').replace(/\[/g,'\\[')+'%';
 return out;
}
/** Coverage of the recorded-stock source, scoped like the plan. */
export function compileInventoryCoverage(p:InventoryPlan){
 return `SELECT COUNT_BIG(*) AS total, SUM(CASE WHEN COALESCE(StkBal,0)>0 THEN 1 ELSE 0 END) AS positive, SUM(CASE WHEN COALESCE(StkBal,0)<0 THEN 1 ELSE 0 END) AS negative, SUM(CASE WHEN COALESCE(StkBal,0)=0 THEN 1 ELSE 0 END) AS zero, SUM(CASE WHEN COALESCE(ROL,0)>0 THEN 1 ELSE 0 END) AS rolset, SUM(CASE WHEN COALESCE(RowCost,0)>0 THEN 1 ELSE 0 END) AS costed FROM dbo.Vw_RowItemMaster v WHERE v.Enable=1${p.location?` AND ${locPred()}`:''}`;
}

export type InventoryUsageCoverage={soldQty:number;matchedQty:number;soldItems:number;matchedItems:number;missingUnitLines:number;firstDate:string|null;basisDays:number;issueDocs:number;issueQty:number;damageQty:number};
/** Sales/recipe coverage for the usage + forecast templates, same scope. */
export function compileInventoryUsageCoverage(p:InventoryPlan){
 return `WITH rawSales AS (
  SELECT RTRIM(s.LocCode) AS LocCode, RTRIM(s.SubItmId) AS MenuID, COALESCE(s.Qty,0) AS Qty, CONVERT(date,s.Txndate) AS D
  FROM dbo.Vw_SalesDetail s WHERE ${salesFilter(p)}
 ), sold AS (
  SELECT LocCode, MenuID, SUM(Qty) AS SoldQty FROM rawSales GROUP BY LocCode, MenuID
 )
 SELECT
  COALESCE((SELECT SUM(SoldQty) FROM sold),0) AS soldQty,
  COALESCE((SELECT SUM(sd.SoldQty) FROM sold sd WHERE EXISTS (SELECT 1 FROM dbo.Vw_Recipies r WHERE RTRIM(r.LocCode)=sd.LocCode AND RTRIM(r.MenuItmID)=sd.MenuID)),0) AS matchedQty,
  (SELECT COUNT(*) FROM sold) AS soldItems,
  (SELECT COUNT(*) FROM sold sd WHERE EXISTS (SELECT 1 FROM dbo.Vw_Recipies r WHERE RTRIM(r.LocCode)=sd.LocCode AND RTRIM(r.MenuItmID)=sd.MenuID)) AS matchedItems,
  (SELECT COUNT(*) FROM dbo.Vw_Recipies r JOIN sold sd ON RTRIM(r.LocCode)=sd.LocCode AND RTRIM(r.MenuItmID)=sd.MenuID WHERE COALESCE(r.Units,0)=0)${p.semi===false?'':`
   + (SELECT COUNT(*) FROM dbo.Vw_Recipies r JOIN dbo.Vw_RecipiesSemiFinishedprod sf ON RTRIM(sf.LocCode)=RTRIM(r.LocCode) AND RTRIM(sf.MenuItmID)=RTRIM(r.RowItemCode) JOIN sold sd ON RTRIM(r.LocCode)=sd.LocCode AND RTRIM(r.MenuItmID)=sd.MenuID WHERE COALESCE(sf.Units,0)=0)`} AS missingUnitLines,
  CONVERT(varchar(10),(SELECT MIN(D) FROM rawSales),23) AS firstDate,
  CASE WHEN (SELECT MIN(D) FROM rawSales) IS NULL THEN DATEDIFF(day,CONVERT(date,@from,23),CONVERT(date,@to,23))+1 ELSE DATEDIFF(day,(SELECT MIN(D) FROM rawSales),CONVERT(date,@to,23))+1 END AS basisDays,
  (SELECT COUNT(DISTINCT RTRIM(i.INNO)) FROM dbo.Vw_IssueNoteDetail i WHERE UPPER(RTRIM(i.Confirmed))='Y' AND ${range('i.INDate')}${loc(p,'RTRIM(i.FromLocCode)','RTRIM(i.LocDes)')}) AS issueDocs,
  (SELECT COALESCE(SUM(COALESCE(i.INQty,0)),0) FROM dbo.Vw_IssueNoteDetail i WHERE UPPER(RTRIM(i.Confirmed))='Y' AND ${range('i.INDate')}${loc(p,'RTRIM(i.FromLocCode)','RTRIM(i.LocDes)')}) AS issueQty,
  (SELECT COALESCE(SUM(COALESCE(d.DmgQty,0)),0) FROM dbo.Vw_DamageDetails d WHERE UPPER(RTRIM(d.Confirmed))='Y' AND ${range('d.TxnDate')}${loc(p,'RTRIM(d.LocCode)','RTRIM(d.LocDes)')}) AS damageQty`;
}
export function inventoryUsageWarnings(c:InventoryUsageCoverage|null,p:InventoryPlan):string[]{
 if(!c)return [];
 const w:string[]=[];
 const pct=(a:number,b:number)=>b>0?`${Math.round((a/b)*1000)/10}%`:'0%';
 if(c.soldQty<=0)w.push('No sales were recorded in this period, so no recipe-based usage rate can be calculated.');
 else if(c.matchedQty<c.soldQty)w.push(`Recipes cover ${pct(c.matchedQty,c.soldQty)} of the sold quantity in this period (${c.matchedItems} of ${c.soldItems} sold menu items) — usage covers only items with recorded recipes.`);
 if(c.missingUnitLines>0)w.push(`${c.missingUnitLines} recipe lines have no unit conversion (Units), so those quantities could not be converted to the master unit and are excluded.`);
 if(c.firstDate&&p.from&&c.firstDate>p.from)w.push(`Sales data in this period starts on ${c.firstDate}; the usage rate is based on ${c.basisDays} day(s), not the full requested period.`);
 else if(c.basisDays>0&&c.basisDays<7)w.push(`Only ${c.basisDays} day(s) of sales data are available in this period — treat the daily usage rate as a rough indication only.`);
 if(c.issueDocs===0)w.push('No confirmed issue notes were recorded in this period, so issue-note usage is unavailable (not zero usage).');
 return w;
}

export type InventoryCoverage={total:number;positive:number;negative:number;zero:number;rolset:number;costed:number};
export function inventoryWarnings(c:InventoryCoverage|null):string[]{
 if(!c||!c.total)return [];
 const w:string[]=[];
 const pct=(n:number)=>`${Math.round((n/c.total)*1000)/10}%`;
 if(c.negative>0)w.push(`${c.negative} of ${c.total} item-location rows show NEGATIVE recorded stock — balances need verification/reconciliation before they can be treated as physical stock.`);
 if(c.zero>0)w.push(`${c.zero} of ${c.total} rows show zero recorded stock.`);
 if(c.costed<c.total)w.push(`Unit cost (RowCost) is recorded for only ${c.costed} of ${c.total} rows (${pct(c.costed)}) — cost and value figures cover only those items.`);
 if(c.rolset<c.total)w.push(`Reorder level (ROL) is set for ${c.rolset} of ${c.total} rows (${pct(c.rolset)}) — reorder lists cover only those items.`);
 return w;
}
