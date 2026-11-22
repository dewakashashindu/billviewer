// Constrained semantic plan: the model never supplies SQL, identifiers or
// expressions. Every metric/dimension/filter below is a fixed, reviewed
// expression over an approved view; only dates and filter values are bound
// as SQL parameters.
export const billMetrics={
 netSales:'SUM(COALESCE(v.NetTotal,0))',grossSales:'SUM(COALESCE(v.Gross,0))',
 grossAfterDiscount:'SUM(COALESCE(v.GrossAfterDis,0))',discount:'SUM(COALESCE(v.DisVal,0))',
 discountPercent:'100.0*SUM(COALESCE(v.DisVal,0))/NULLIF(SUM(COALESCE(v.Gross,0)),0)',
 serviceCharge:'SUM(COALESCE(v.SerChg,0)+COALESCE(v.OtherSerChg,0))',
 vat:'SUM(COALESCE(v.VAT,0)+COALESCE(v.OtherVAT,0))',tdl:'SUM(COALESCE(v.TDL,0))',
 packingCharge:'SUM(COALESCE(v.PackChg,0))',deliveryCharge:'SUM(COALESCE(v.DelChg,0))',
 salesExTax:'SUM(COALESCE(v.SalesWOTAX,0))',bills:'COUNT_BIG(*)',pax:'SUM(COALESCE(v.NOPax,0))',
 averageBill:'SUM(COALESCE(v.NetTotal,0))/NULLIF(COUNT_BIG(*),0)',
 spendPerPax:'SUM(COALESCE(v.NetTotal,0))/NULLIF(SUM(COALESCE(v.NOPax,0)),0)',
} as const;
export const itemMetrics={
 itemQuantity:'SUM(COALESCE(v.Qty,0))',itemRevenue:'SUM(COALESCE(v.TotalItmPrice,0))',
 itemAveragePrice:'SUM(COALESCE(v.TotalItmPrice,0))/NULLIF(SUM(COALESCE(v.Qty,0)),0)',
 distinctItems:'COUNT_BIG(DISTINCT NULLIF(RTRIM(v.SubItmId),\'\'))',
 itemBillCount:'COUNT_BIG(DISTINCT NULLIF(RTRIM(v.BIRTHNO),\'\'))',
} as const;
export const voidMetrics={
 voidCount:'COUNT_BIG(*)',voidQuantity:'SUM(COALESCE(v.Qty,0))',
 voidValue:'SUM(COALESCE(v.Qty,0)*COALESCE(v.SalesPrice,0))',
} as const;
export const paymentMetrics={
 paymentAmount:'SUM(COALESCE(v.ActAmt,0))',paymentCount:'COUNT_BIG(*)',averagePayment:'SUM(COALESCE(v.ActAmt,0))/NULLIF(COUNT_BIG(*),0)',
} as const;
export const metrics={...billMetrics,...itemMetrics,...voidMetrics,...paymentMetrics} as const;
type Metric=keyof typeof metrics;
type Source='bill'|'item'|'void'|'payment';
const sourceOf=(m:Metric):Source=>Object.hasOwn(billMetrics,m)?'bill':Object.hasOwn(itemMetrics,m)?'item':Object.hasOwn(voidMetrics,m)?'void':'payment';
const locLabel="COALESCE(NULLIF(RTRIM(v.LocDes),''),RTRIM(v.LocCode))";
const cashierLabel="COALESCE(NULLIF(RTRIM(v.UserName),''),RTRIM(v.CasherID))";
const stewardLabel="COALESCE(NULLIF(RTRIM(v.Steward),''),RTRIM(v.StewID))";
const commonDims=(date:string,time:string)=>({none:'',day:`CONVERT(date,v.${date})`,month:`CONVERT(char(7),v.${date},23)`,weekday:`(DATEDIFF(day,0,CONVERT(date,v.${date}))%7)`,hour:`DATEPART(hour,v.${time})`,location:locLabel,billType:'RTRIM(v.BillType)',orderMode:'RTRIM(v.OrderMode)',cashier:cashierLabel,steward:stewardLabel});
export const dimensionSets:Record<Source,Record<string,string>>={
 bill:commonDims('Txndate','TxnTime'),
 item:{...commonDims('Txndate','TxnTime'),item:"COALESCE(NULLIF(RTRIM(v.MenuItmDes),''),RTRIM(v.SubItmId))",category:'RTRIM(v.Category)'},
 void:{none:'',day:'CONVERT(date,v.TxnDate)',month:'CONVERT(char(7),v.TxnDate,23)',weekday:'(DATEDIFF(day,0,CONVERT(date,v.TxnDate))%7)',hour:'DATEPART(hour,v.TxnTime)',location:'RTRIM(v.LOCCODE)',cashier:"COALESCE(NULLIF(RTRIM(v.CASHERNAME),''),RTRIM(v.CASHER))",steward:'RTRIM(v.StewId)',item:'RTRIM(v.ItemDes)',voidType:'RTRIM(v.VOIDTYPE)'},
 payment:{none:'',day:'CONVERT(date,v.Txndate)',month:'CONVERT(char(7),v.Txndate,23)',weekday:'(DATEDIFF(day,0,CONVERT(date,v.Txndate))%7)',location:locLabel,payment:'RTRIM(v.PayDes)',cashier:cashierLabel},
};
// Filter fields per source. Values are ONLY ever bound as @fv parameters.
const filterFields:Record<Source,Record<string,{expr:string;contains:boolean}>>={
 bill:{location:{expr:'RTRIM(v.LocCode)',contains:false},billType:{expr:'RTRIM(v.BillType)',contains:false},orderMode:{expr:'RTRIM(v.OrderMode)',contains:false},cashier:{expr:'RTRIM(v.CasherID)',contains:false},steward:{expr:'RTRIM(v.StewID)',contains:false}},
 item:{location:{expr:'RTRIM(v.LocCode)',contains:false},billType:{expr:'RTRIM(v.BillType)',contains:false},orderMode:{expr:'RTRIM(v.OrderMode)',contains:false},cashier:{expr:'RTRIM(v.CasherID)',contains:false},steward:{expr:'RTRIM(v.StewID)',contains:false},item:{expr:"COALESCE(NULLIF(RTRIM(v.MenuItmDes),''),RTRIM(v.SubItmId))",contains:true},category:{expr:'RTRIM(v.Category)',contains:true}},
 void:{location:{expr:'RTRIM(v.LOCCODE)',contains:false},cashier:{expr:'RTRIM(v.CASHER)',contains:false},steward:{expr:'RTRIM(v.StewId)',contains:false},item:{expr:'RTRIM(v.ItemDes)',contains:true},voidType:{expr:'RTRIM(v.VOIDTYPE)',contains:false}},
 payment:{location:{expr:'RTRIM(v.LocCode)',contains:false},cashier:{expr:'RTRIM(v.CasherID)',contains:false},payment:{expr:'RTRIM(v.PayDes)',contains:true}},
};
// Forecast plans estimate a FUTURE period from recent daily history.
// They never execute against future dates; the route computes a
// weekday-average projection from the last complete days.
export type ForecastMetric='netSales'|'grossSales'|'bills'|'pax'|'itemQuantity'|'itemRevenue';
export type ForecastPlan={forecast:true;metric:ForecastMetric;from:string;to:string;item?:boolean};
const forecastMetrics=new Set<string>(['netSales','grossSales','bills','pax','itemQuantity','itemRevenue']);
export function validateForecast(x:unknown,today:string):ForecastPlan|null {
 if(!x||typeof x!=='object')return null;const p=x as Record<string,unknown>;
 if(p.forecast!==true||typeof p.metric!=='string'||!forecastMetrics.has(p.metric))return null;
 if(!validDate(p.from)||!validDate(p.to))return null;
 if(p.from<today||p.to<p.from)return null;
 if((Date.parse(p.to)-Date.parse(p.from))/86400000>61)return null;
 if(p.item!==undefined&&(p.item!==true||(p.metric!=='itemQuantity'&&p.metric!=='itemRevenue')))return null;
 return {forecast:true,metric:p.metric as ForecastMetric,from:p.from,to:p.to,...(p.item===true?{item:true}:{})};
}
export type SalesFilter={field:string;value:string;match:'exact'|'contains'};
export type SalesPlan={metric:Metric;dimension:string;from:string;to:string;limit:number;order:'asc'|'desc';filter?:SalesFilter;compare?:boolean};
function validDate(s:unknown):s is string {if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s}
export function validatePlan(x:unknown,today:string):SalesPlan|null {
 if(!x||typeof x!=='object')return null;const p=x as Record<string,unknown>;
 if(typeof p.metric!=='string'||typeof p.dimension!=='string'||!Object.hasOwn(metrics,p.metric))return null;
 const metric=p.metric as Metric,source=sourceOf(metric),dims=dimensionSets[source];
 if(!Object.hasOwn(dims,p.dimension))return null;
 if(metric==='distinctItems'&&p.dimension==='item')return null;
 if(!validDate(p.from)||!validDate(p.to)||p.from>p.to||p.to>today)return null;
 if((Date.parse(p.to)-Date.parse(p.from))/86400000>366)return null;
 if(!Number.isInteger(p.limit)||Number(p.limit)<1||Number(p.limit)>20||!['asc','desc'].includes(String(p.order)))return null;
 const plan:SalesPlan={metric,dimension:p.dimension,from:p.from,to:p.to,limit:Number(p.limit),order:p.order as 'asc'|'desc'};
 if(p.compare!==undefined){if(p.compare!==true||p.dimension!=='none')return null;plan.compare=true}
 if(p.filter!==undefined){
  if(!p.filter||typeof p.filter!=='object')return null;const f=p.filter as Record<string,unknown>;
  if(typeof f.field!=='string'||!Object.hasOwn(filterFields[source],f.field))return null;
  if(typeof f.value!=='string')return null;const value=f.value.trim();
  if(!value||value.length>80||/[\u0000-\u001f]/.test(value))return null;
  const spec=filterFields[source][f.field];
  if(f.match!=='exact'&&f.match!=='contains')return null;
  if(f.match==='contains'&&!spec.contains)return null;
  plan.filter={field:f.field,value,match:f.match};
 }
 return plan;
}
// Diagnostic used only when a plan returns no rows: the latest date that
// has data matching the same source/filters (without the date range).
export function compileLatestDate(p:SalesPlan){
 const source=sourceOf(p.metric),dc=dateCols[source];
 const posFilters=(source==='bill'||source==='item')?` AND ISNULL(LTRIM(RTRIM(v.DoNotShowInSales)),'0')<>'1' AND ISNULL(LTRIM(RTRIM(v.BillType)),'')<>'CM'`:'';
 let filterSql='';
 if(p.filter){const spec=filterFields[source][p.filter.field];filterSql=p.filter.match==='contains'?` AND ${spec.expr} LIKE @fv ESCAPE '\\'`:` AND ${spec.expr} = @fv`}
 return `SELECT CONVERT(varchar(10),MAX(CONVERT(date,v.${dc})),23) AS latest FROM ${views[source]} v WHERE 1=1${posFilters}${filterSql}`;
}
// Chronological series for charts (no TOP-N ranking): every group in the
// period, ordered by the grouping value itself.
export function compileTrend(p:SalesPlan,dimension:string){
 const source=sourceOf(p.metric),dims=dimensionSets[source];
 if(!Object.hasOwn(dims,dimension)||!dims[dimension])throw new Error('UNSUPPORTED_TREND');
 const dim=dims[dimension],dc=dateCols[source];
 const posFilters=(source==='bill'||source==='item')?` AND ISNULL(LTRIM(RTRIM(v.DoNotShowInSales)),'0')<>'1' AND ISNULL(LTRIM(RTRIM(v.BillType)),'')<>'CM'`:'';
 let filterSql='';
 if(p.filter){const spec=filterFields[source][p.filter.field];filterSql=p.filter.match==='contains'?` AND ${spec.expr} LIKE @fv ESCAPE '\\'`:` AND ${spec.expr} = @fv`}
 return `SELECT ${dim} AS label, ${metrics[p.metric]} AS value FROM ${views[source]} v WHERE v.${dc}>=@from AND v.${dc}<DATEADD(day,1,CONVERT(date,@to,23))${posFilters}${filterSql} GROUP BY ${dim} ORDER BY label ASC`;
}
export function filterParamValue(plan:SalesPlan):string|null {
 if(!plan.filter)return null;
 if(plan.filter.match==='exact')return plan.filter.value;
 return '%'+plan.filter.value.replace(/\\/g,'\\\\').replace(/%/g,'\\%').replace(/_/g,'\\_').replace(/\[/g,'\\[')+'%';
}
const views:Record<Source,string>={bill:'dbo.VW_SalesSummery',item:'dbo.Vw_SalesDetail',void:'dbo.Vw_VoidBeforeSettlement',payment:'dbo.Vw_Sales_PaymentCategories'};
const dateCols:Record<Source,string>={bill:'Txndate',item:'Txndate',void:'TxnDate',payment:'Txndate'};
export function compilePlan(p:SalesPlan){
 const source=sourceOf(p.metric),dim=dimensionSets[source][p.dimension],dc=dateCols[source];
 const group=dim?`${dim} AS label, `:'';const by=dim?` GROUP BY ${dim}`:'';
 // POS report semantics: hidden bills and Credit Memos are not sales.
 const posFilters=(source==='bill'||source==='item')?` AND ISNULL(LTRIM(RTRIM(v.DoNotShowInSales)),'0')<>'1' AND ISNULL(LTRIM(RTRIM(v.BillType)),'')<>'CM'`:'';
 let filterSql='';
 if(p.filter){const spec=filterFields[source][p.filter.field];filterSql=p.filter.match==='contains'?` AND ${spec.expr} LIKE @fv ESCAPE '\\'`:` AND ${spec.expr} = @fv`}
 return `SELECT TOP (${p.limit}) ${group}${metrics[p.metric]} AS value FROM ${views[source]} v WHERE v.${dc}>=@from AND v.${dc}<DATEADD(day,1,CONVERT(date,@to,23))${posFilters}${filterSql}${by} ORDER BY value ${p.order==='asc'?'ASC':'DESC'}`;
}
