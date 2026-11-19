import type {ChartModel,ChartPoint} from './reportCharts';
import type {ComplimentaryCostData} from './ComplimentaryCostReport';
import type {TaxPosRow} from './TaxPosReport';
import type {VoidPosRow} from './VoidPosReport';
import type {InvoiceData} from './InvoiceTraceReport';

type Unit=ChartModel['unit'];
function aggregate<T>(rows:T[], label:(r:T)=>string, value:(r:T)=>number|null|undefined):ChartPoint[]{const m=new Map<string,number>();for(const r of rows){const k=label(r).trim(),v=value(r);if(!k||v==null||!Number.isFinite(v))continue;m.set(k,(m.get(k)||0)+v)}return [...m].map(([label,v])=>({label,values:[Math.round(v*100)/100]}))}
function chart(id:string,title:string,kind:ChartModel['kind'],unit:Unit,points:ChartPoint[]):ChartModel|null{if(!points.length)return null;const dk=(s:string)=>{const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:s};const temporal=kind==='line'||/per day|daily/i.test(title);const p=temporal?points.sort((a,b)=>dk(a.label).localeCompare(dk(b.label))):points.sort((a,b)=>b.values[0]-a.values[0]);return{id,title,kind,unit,series:[title],points:kind==='hbars'?p.slice(0,10):p,...(kind==='hbars'&&p.length>10?{truncatedFrom:p.length}:{})}}
const keep=(cs:(ChartModel|null)[]):ChartModel[]=>cs.filter((c):c is ChartModel=>c!==null);
export function complimentaryCharts(data:ComplimentaryCostData):ChartModel[]{const items=data.locations.flatMap(l=>l.days.flatMap(d=>d.bills.flatMap(b=>b.items.map(i=>({...i,loc:l.locName||l.locCode,date:d.date,bill:b.billNo})))));const bills=data.locations.flatMap(l=>l.days.flatMap(d=>d.bills.map(b=>({date:d.date,loc:l.locName||l.locCode}))));return keep([
 chart('comp-bills','Complimentary Bills per Day','line','number',aggregate(bills,r=>r.date,()=>1)),
 chart('comp-day','Daily Complimentary Cost','line','currency',aggregate(items,r=>r.date,r=>r.itemCost)),
 chart('comp-item','Top Complimentary Items by Cost','hbars','currency',aggregate(items,r=>`${r.id} ${r.name}`,r=>r.itemCost)),
 chart('comp-qty','Top Complimentary Items by Quantity','hbars','number',aggregate(items,r=>`${r.id} ${r.name}`,r=>r.qty)),
 chart('comp-loc','Location-wise Complimentary Cost','hbars','currency',aggregate(items,r=>r.loc,r=>r.itemCost)),
 chart('comp-share','Complimentary Cost by Item','pie','currency',aggregate(items,r=>`${r.id} ${r.name}`,r=>r.itemCost)),
 ]);}
export function taxPosCharts(rows:TaxPosRow[]):ChartModel[]{const component=([['VAT','vat'],['TDL','tdl']] as const).filter(([,k])=>rows.some(r=>r[k]!=null)).map(([label,k])=>({label,values:[rows.reduce((n,r)=>n+(r[k]??0),0)]}));return keep([
 chart('tax-vat-tdl','Daily VAT + TDL','line','currency',aggregate(rows,r=>r.txnDate,r=>r.vat==null&&r.tdl==null?null:(r.vat??0)+(r.tdl??0))),
 chart('tax-vat-day','Daily VAT','line','currency',aggregate(rows,r=>r.txnDate,r=>r.vat)),
 chart('tax-tdl-day','Daily TDL','line','currency',aggregate(rows,r=>r.txnDate,r=>r.tdl)),
 chart('tax-components','Tax Components','bars','currency',component),
 chart('tax-loc-vat','Location-wise VAT','hbars','currency',aggregate(rows,r=>r.locName||r.locCode,r=>r.vat)),
 chart('tax-loc-tdl','Location-wise TDL','hbars','currency',aggregate(rows,r=>r.locName||r.locCode,r=>r.tdl)),
 ]);}
export function voidPosCharts(rows:VoidPosRow[]):ChartModel[]{return keep([
 chart('void-daily','Daily Void Value','line','currency',aggregate(rows,r=>r.txnDate,r=>r.value)),
 chart('void-count','Void Records per Day','bars','number',aggregate(rows,r=>r.txnDate,()=>1)),
 chart('void-cash','Cashier-wise Void Value','hbars','currency',aggregate(rows,r=>r.cashierName||r.cashierId,r=>r.value)),
 chart('void-cash-count','Void Records by Cashier','hbars','number',aggregate(rows,r=>r.cashierName||r.cashierId,()=>1)),
 chart('void-loc-count','Void Records by Location','hbars','number',aggregate(rows,r=>r.locName||r.loc,()=>1)),
 chart('void-loc','Location-wise Void Value','hbars','currency',aggregate(rows,r=>r.locName||r.loc,r=>r.value)),
 chart('void-type','Void Type by Value','hbars','currency',aggregate(rows,r=>r.voidType,r=>r.value)),
 chart('void-item','Top Voided Items by Value','hbars','currency',aggregate(rows,r=>`${r.itemCode} ${r.itemDes}`,r=>r.value)),
 ]);}
export function invoiceCharts(data:InvoiceData):ChartModel[]{const rows=data.rows;return keep([
 chart('invoice-amount','Item Amounts','hbars','currency',aggregate(rows,r=>`${r.ItemCode} ${r.MenuItmDes}`,r=>r.Amount)),
 chart('invoice-qty','Item Quantities','hbars','number',aggregate(rows,r=>`${r.ItemCode} ${r.MenuItmDes}`,r=>r.Qty)),
 chart('invoice-lines','Item Record Count','hbars','number',aggregate(rows,r=>`${r.ItemCode} ${r.MenuItmDes}`,()=>1)),
 ]);}
import type {TypesData,DailyData} from './PaymentPosTotals';
export function paymentTotalsCharts(types?:TypesData,daily?:DailyData):ChartModel[]{
 const rows=types?types.locationGroups.flatMap(l=>l.rows.map(r=>({loc:l.locName||l.locCode,date:'',mode:r.type,value:r.total}))):daily?daily.locationGroups.flatMap(l=>l.days.flatMap(d=>d.rows.map(r=>({loc:l.locName||l.locCode,date:d.date,mode:r.name||r.code,value:r.amount})))):[];
 return keep([chart('pt-mode','Payment Type Totals','hbars','currency',aggregate(rows,r=>r.mode,r=>r.value)),chart('pt-share','Payment Type Share','pie','currency',aggregate(rows,r=>r.mode,r=>r.value)),chart('pt-loc','Location-wise Payments','hbars','currency',aggregate(rows,r=>r.loc,r=>r.value)),chart('pt-day','Daily Payments','line','currency',aggregate(rows,r=>r.date,r=>r.value))]);
}
import type {PerformanceReportData} from './PerformanceReport';
/** Build independent section charts from the selected saved snapshot, without adding totals together. */
export function performanceCharts(data:PerformanceReportData, search = ''):ChartModel[]{
 const parse=(raw:string):number|null=>{const t=raw.trim();if(!/^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(t))return null;const n=Number(t.replace(/,/g,''));return Number.isFinite(n)?n:null};
 const norm=(s:string)=>s.trim().replace(/\s+/g,' ').toUpperCase();
 const specs:Record<string,{title:string;unit:Unit;field:'value'|'amount';exclude?:string[]}>={
  'SALES VOLUME':{title:'Sales Volume',unit:'currency',field:'amount'},
  'SERVICE CHARGE AND TAXES':{title:'Service Charge and Taxes',unit:'currency',field:'amount',exclude:['TAX TOTAL','SALES WITHOUT TAX']},
  'SERVICE MODE COLLECTION':{title:'Collection by Service Mode',unit:'currency',field:'amount'},
  'PAX DISTRIBUTION':{title:'Pax Distribution',unit:'number',field:'amount',exclude:['TOTAL PAX COUNT']},
  'PAY MODE WISE COLLECTION':{title:'Collection by Payment Mode',unit:'currency',field:'amount'},
  'CASHIER WISE COLLECTION':{title:'Collection by Cashier',unit:'currency',field:'amount'},
  'DEDUCTIONS':{title:'Deductions and Adjustments',unit:'currency',field:'amount'},
  'PROMOTIONS':{title:'Promotions',unit:'currency',field:'amount'},
  'VOID BILLS':{title:'Bill Values',unit:'currency',field:'amount'},
  'SPENDING AVERAGE':{title:'Spending Averages',unit:'currency',field:'amount',exclude:['AVG PAX PER BILL','AVG TIME PER BILL']},
  'MAIN GROUP SALES':{title:'Main Group Sales',unit:'currency',field:'amount',exclude:['MAIN GROUP TOTAL']},
  'FAMILY SALES':{title:'Family Sales',unit:'currency',field:'amount',exclude:['FAMILY GROUP TOTAL']},
  'MONTH TO DATE':{title:'Month-to-Date Collection by Mode',unit:'currency',field:'amount',exclude:['MONTH TO DATE TOTAL','MONTH TO DATE AVERAGE']},
 };
 const sections=new Map<string,typeof data.rows>();let current='';
 for(const r of data.rows){const name=norm(r.description);if(r.heading&&!['MAIN GROUP TOTAL','FAMILY GROUP TOTAL'].includes(name)){current=name;if(!sections.has(current))sections.set(current,[]);continue}if(current)sections.get(current)?.push(r)}
 const q=search.trim().toLowerCase();const matches=(r:typeof data.rows[number])=>!q||`${r.description} ${r.value} ${r.amount} ${r.sortingOrder??''}`.toLowerCase().includes(q);
 const output:ChartModel[]=[];
 for(const [key,spec] of Object.entries(specs)){const rows=(sections.get(key)||[]).filter(r=>matches(r)&&!spec.exclude?.includes(norm(r.description))&&r.description.trim());const points=rows.flatMap(r=>{const n=parse(r[spec.field]);return n===null?[]:[{label:r.description.trim(),values:[n]}]});if(points.length)output.push({id:`perf-${key.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,title:spec.title,kind:'hbars',unit:spec.unit,series:[spec.title],points});}
 const countRows=(sections.get('VOID BILLS')||[]).filter(matches);const counts=countRows.flatMap(r=>{const n=parse(r.value);return n===null||!r.description.trim()?[]:[{label:r.description.trim(),values:[n]}]});if(counts.length)output.push({id:'perf-bill-counts',title:'Bill Counts',kind:'hbars',unit:'number',series:['Count'],points:counts});
 return output;
}
import type {CreditRow} from './CreditHistoryPos';
export function creditHistoryPosCharts(rows:CreditRow[]):ChartModel[]{return keep([
 chart('credit-pos-day','Daily Credit Transaction Amount','line','currency',aggregate(rows,r=>r.txnDate,r=>r.txn)),
 chart('credit-pos-customer','Credit Transaction Amount by Customer','hbars','currency',aggregate(rows,r=>`${r.cus} ${r.cusName}`.trim(),r=>r.txn)),
 chart('credit-pos-customer-count','Credit Records by Customer','hbars','number',aggregate(rows,r=>`${r.cus} ${r.cusName}`.trim(),()=>1)),
 chart('credit-pos-loc-count','Credit Records by Location','hbars','number',aggregate(rows,r=>r.locName||r.loc,()=>1)),
 chart('credit-pos-loc','Credit Transaction Amount by Location','hbars','currency',aggregate(rows,r=>r.locName||r.loc,r=>r.txn)),
 chart('credit-pos-count','Credit Records per Day','line','number',aggregate(rows,r=>r.txnDate,()=>1)),
 chart('credit-pos-paid','Recorded Payments by Customer','hbars','currency',aggregate(rows,r=>`${r.cus} ${r.cusName}`.trim(),r=>r.paid)),
]);}
import type {ServiceRow} from './ServiceChargeReport';
import type {TableStewardData} from './TableStewardReport';
export function serviceChargeCharts(rows:ServiceRow[]):ChartModel[]{return keep([
 chart('service-steward','Service Charge by Steward','hbars','currency',aggregate(rows,r=>`${r.stewardId} ${r.stewardName}`.trim()||'Unassigned',r=>r.service)),
 chart('service-day','Daily Service Charge','line','currency',aggregate(rows,r=>r.txnDate,r=>r.service)),
 chart('service-loc','Service Charge by Location','hbars','currency',aggregate(rows,r=>r.locName||r.locCode,r=>r.service)),
 chart('service-share','Service Charge Share by Steward','pie','currency',aggregate(rows,r=>`${r.stewardId} ${r.stewardName}`.trim()||'Unassigned',r=>r.service)),
 chart('service-gross','Daily Gross After Discount','line','currency',aggregate(rows,r=>r.txnDate,r=>r.gross)),
]);}
export function tableStewardCharts(data:TableStewardData):ChartModel[]{const rows=data.locations.flatMap(l=>l.stewards.flatMap(s=>s.rows.map(r=>({...r,loc:l.name||l.code,steward:`${s.id} ${s.name}`.trim()||'Unassigned'}))));return keep([
 chart('table-steward','Steward-wise Sales','hbars','currency',aggregate(rows,r=>r.steward,r=>r.netTotal)),
 chart('table-day','Daily Sales','line','currency',aggregate(rows,r=>r.date,r=>r.netTotal)),
 chart('table-loc','Location-wise Sales','hbars','currency',aggregate(rows,r=>r.loc,r=>r.netTotal)),
 chart('table-share','Steward Sales Share','pie','currency',aggregate(rows,r=>r.steward,r=>r.netTotal)),
 chart('table-pax','Pax by Steward','hbars','number',aggregate(rows,r=>r.steward,r=>r.pax)),
 chart('table-sales','Sales by Table','hbars','currency',aggregate(rows,r=>`${r.loc} · ${r.tableNo}`,r=>r.netTotal)),
]);}
