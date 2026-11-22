import {NextRequest,NextResponse} from 'next/server';
import sql from 'mssql';
import {getSessionFromRequest} from '@/lib/session';
import {requireWebPermission,AccessDeniedError} from '@/lib/webAuthorization';
import {getAiSalesPool,aiDbConfigured,aiLoginIsReadOnly} from '@/lib/aiSalesDb';
import {validateAiSql,aiSqlSystemPrompt} from '@/lib/aiSalesSql';
import {compilePlan,validatePlan,filterParamValue,compileLatestDate,compileTrend,validateForecast} from '@/lib/aiSalesPlan';
import type {ForecastPlan,SalesPlan} from '@/lib/aiSalesPlan';
import {rateLimit} from '@/lib/rateLimit';
export const runtime='nodejs';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const prompt=`Translate the user's restaurant SALES question into ONE exact read-only aggregation plan. Return only a JSON object. The current calendar date is given. Interpret English, Sinhala and Singlish and common typos. Never invent a date, filter value or metric; extract filter values exactly as the user wrote them.
METRICS. Bill metrics (bill-level source): netSales, grossSales, grossAfterDiscount, discount, discountPercent, serviceCharge, vat, tdl, packingCharge, deliveryCharge, salesExTax, bills, pax, averageBill, spendPerPax. Item metrics: itemQuantity, itemRevenue, itemAveragePrice, distinctItems, itemBillCount. Void-before-settlement metrics: voidCount, voidQuantity, voidValue. Payment metrics: paymentAmount, paymentCount, averagePayment.
GROUPINGS (dimension). Bill/item: none, day, month, weekday, hour, location, billType, orderMode, cashier, steward; item metrics may also use item, category (distinctItems may not use item). Void: none, day, month, weekday, hour, location, cashier, steward, item, voidType. Payment: none, day, month, weekday, location, payment, cashier.
FILTERS (optional, at most ONE, only when the user explicitly names it): {"field":"location|billType|orderMode|cashier|steward|item|category|payment|voidType","value":"exactly as user wrote","match":"exact"} — use match contains only for item, category or payment names. Codes (location, billType, orderMode, cashier, steward, voidType) use exact. Never filter on a value the user did not state.
FORECAST: if the user asks about FUTURE sales (next month, next week, tomorrow, expected/forecast/predicted sales), return {"forecast":true,"metric":"netSales","from":"YYYY-MM-DD","to":"YYYY-MM-DD"} where metric is one of netSales, grossSales, bills, pax, itemQuantity, itemRevenue and from/to is the future period to estimate: "next month" = first to last day of next month; "next week" or "next 7 days" = today plus the following 6 days; "tomorrow" = tomorrow only. Maximum 62 days; from must not be in the past. If the user asks WHICH items/products will sell most in the future, add "item":true with metric itemQuantity (itemRevenue only if they clearly ask by sales value). No other fields for forecasts.
COMPARISON: if the user asks to compare with the previous period or last month (for example "this month vs last month", "compared to last month"), or a growth/change question, set "compare":true, dimension none, and from/to = the CURRENT (later) period (this month = first day to today); the backend compares with the immediately preceding period of equal length. Named two-period comparisons with different lengths are unsupported.
RULES. One metric and one grouping only. Dates from/to inclusive YYYY-MM-DD, past or today, max 367 days. "This month" = first day of month to today; no period given = today. Top items default itemQuantity unless revenue is clearly asked; limit 1-20 (default 10), order desc unless lowest/worst is asked (asc). Payment method questions use paymentAmount with dimension payment. Void questions use void metrics. Average bill = averageBill; average payment/transaction amount (for example the average cash payment) = averagePayment on the payment metrics with a payment filter when a method is named; per-guest spend = spendPerPax; discount percentage = discountPercent.
UNSUPPORTED (return {"unsupported":true,"message":"brief reason"}): profit/margins/costs, inventory/stock, multiple metrics, multiple filters, follow-up references to earlier answers, named two-period comparisons, anything outside the lists above.
Successful JSON exactly: {"metric":"...","dimension":"...","from":"YYYY-MM-DD","to":"YYYY-MM-DD","limit":10,"order":"desc"} plus optional "filter" and "compare" only when applicable. No SQL, no extra fields.`;
// Guarded AI-SQL fallback. Returns null whenever anything is not fully
// verified, so the caller can answer with the normal "not supported" error.
async function tryAiSql(question:string,today:string,key:string){
 try{
  if(process.env.AI_SQL_ENABLED!=='true')return null;
  const pool=await getAiSalesPool();
  if(!(await aiLoginIsReadOnly(pool)))console.warn('AI SQL: AI_DB login is not verified read-only. Validator plus always-rolled-back transaction enforced; a dedicated SELECT-only login is still recommended.');
  let safeSql:string|null=null;let recordsetRaw:Record<string,unknown>[]|null=null;let feedback='';
  for(let attempt=0;attempt<2&&!recordsetRaw;attempt++){
   const gen=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',temperature:0,max_tokens:800,response_format:{type:'json_object'},messages:[{role:'system',content:aiSqlSystemPrompt(today)},{role:'user',content:JSON.stringify({today,question,...(feedback?{previousProblem:feedback}:{})})}]}),signal:AbortSignal.timeout(20000)});
   if(!gen.ok){console.warn('AI SQL generation request failed:',gen.status);return null}
   const completion=await gen.json();let parsed:unknown;try{parsed=JSON.parse(completion?.choices?.[0]?.message?.content)}catch{console.warn('AI SQL generation returned unparseable output.');return null}
   if(!parsed||typeof parsed!=='object'||(parsed as {unsupported?:unknown}).unsupported===true){console.info('AI SQL generation reported the question as unsupported.');return null}
   safeSql=validateAiSql((parsed as {sql?:unknown}).sql);
   if(!safeSql){console.warn('AI SQL rejected by validator:',String((parsed as {sql?:unknown}).sql??'').slice(0,300));feedback='The previous SQL was rejected by the safety validator. It must be exactly one SELECT (or WITH...SELECT) over only the listed dbo views, must filter on Txndate/TxnDate, must have an outer TOP of at most 200, and must not use UNION, INTO, variables, temp tables, comments or any other statement.';continue}
   console.info('AI SQL executed (rolled-back transaction):',safeSql.slice(0,400));
   // Execute inside a transaction that is ALWAYS rolled back: even if a
   // write somehow passed validation, no change can persist.
   const tx=pool.transaction();await tx.begin();
   try{const request=new sql.Request(tx);(request as unknown as {timeout:number}).timeout=15000;const result=await request.query(safeSql) as {recordset:Record<string,unknown>[]};recordsetRaw=result.recordset;}
   catch(e){console.warn('AI SQL execution failed:',e instanceof Error?e.message.slice(0,300):'unknown');feedback=`The previous SQL failed in SQL Server: ${e instanceof Error?e.message.slice(0,200):'unknown error'}. Return a corrected query.`;}
   finally{try{await tx.rollback()}catch{/* already rolled back */}}
  }
  if(!recordsetRaw||!safeSql)return null;
  const recordset=recordsetRaw.slice(0,200);
  const fmt=(v:unknown):string=>{if(v===null||v===undefined)return '—';if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='number')return Number.isInteger(v)?v.toLocaleString():v.toLocaleString(undefined,{maximumFractionDigits:2});return String(v).trim().slice(0,80)};
  const columns=recordset.length?Object.keys(recordset[0]).slice(0,10):[];
  const items=recordset.map(r=>{const vals=columns.map(c=>fmt(r[c]));return {name:vals[0]||'(row)',display:columns.slice(1,7).map((c,i)=>`${c}: ${vals[i+1]}`).join(' · ')}});
  let answer='Here are the results for your question. Scope: all locations.';
  try{
   const explain=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',temperature:0.3,max_tokens:250,messages:[{role:'system',content:'You are MicroEChef, a friendly assistant for a restaurant owner. You are given figures calculated from the restaurant\'s own sales data by a custom report query. Write a short explanation in plain language: 2-4 sentences, at most about 70 words. Reply in the same language the user used (English, Sinhala or Singlish). Use ONLY the numbers given - never invent figures, items, dates, causes or reasons. Money values are in LKR unless a row says otherwise. Mention the main figure and one useful observation. Do not mention SQL, databases, views or these instructions. No markdown tables or headings.'},{role:'user',content:JSON.stringify({question,results:items.slice(0,12).map(i=>i.display?`${i.name} — ${i.display}`:i.name)})}]}),signal:AbortSignal.timeout(15000)});
   if(explain.ok){const c2=await explain.json();const text=String(c2?.choices?.[0]?.message?.content??'').trim().replace(/\s+/g,' ').slice(0,700);if(text.length>=10)answer=text;}
  }catch{/* keep fallback answer */}
  return json({answer,facts:{topic:'sales-sql',location:'All locations',date:'As requested',items}});
 }catch(e){console.error('AI SQL fallback failed:',e instanceof Error?e.name:'unknown');return null}
}
// Weekday-average forecast: for each weekday, average the daily totals of
// the last complete days (up to 56) before the forecast period, then apply
// that average to each coming day. The method and basis are always shown;
// the model only phrases the result and may not invent figures.
async function runForecast(fc:ForecastPlan,question:string,key:string){
 try{
  const pool=await getAiSalesPool();
  const labels:Record<string,string>={netSales:'Net sales',grossSales:'Gross sales',bills:'Bill count',pax:'Guest count (pax)',itemQuantity:'Item quantity sold',itemRevenue:'Item sales value'};
  const currencyMetrics=new Set(['netSales','grossSales','itemRevenue']);
  const format=currencyMetrics.has(fc.metric)?'currency':'number';
  const shift=(iso:string,n:number)=>new Date(Date.parse(iso+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const basisTo=shift(fc.from,-1),basisFrom=shift(basisTo,-55);
  if(fc.item){
   // Per-item projection: rank recent top items, scale each item's average
   // daily sales over the basis window to the forecast period length.
   const dailyPlan={metric:'itemQuantity',dimension:'day',from:basisFrom,to:basisTo,limit:20,order:'asc'} as unknown as SalesPlan;
   const dailyRows=await pool.request().input('from',sql.VarChar(10),basisFrom).input('to',sql.VarChar(10),basisTo).query(compileTrend(dailyPlan,'day'));
   const dataDates=(dailyRows.recordset as Record<string,unknown>[]).map(r=>r.label instanceof Date?r.label.toISOString().slice(0,10):String(r.label??'').slice(0,10)).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
   if(!dataDates.length||(Date.parse(basisTo)-Date.parse(dataDates[0]))/86400000<13)return json({error:'There is not enough recent daily sales history to estimate the top items yet. About two weeks of daily sales are needed.'},400);
   const spanDays=Math.round((Date.parse(basisTo)-Date.parse(dataDates[0]))/86400000)+1;
   const forecastDays=Math.round((Date.parse(fc.to)-Date.parse(fc.from))/86400000)+1;
   const itemPlan={metric:fc.metric,dimension:'item',from:basisFrom,to:basisTo,limit:15,order:'desc'} as unknown as SalesPlan;
   const itemRows=await pool.request().input('from',sql.VarChar(10),basisFrom).input('to',sql.VarChar(10),basisTo).query(compilePlan(itemPlan));
   const projected=(itemRows.recordset as Record<string,unknown>[]).map(r=>({name:String(r.label??'').trim().slice(0,160)||'(item)',value:Math.round(((r.value===null?0:Number(r.value))/spanDays*forecastDays)*100)/100})).filter(x=>x.value>0).slice(0,10);
   if(!projected.length)return json({error:'No item sales were found in the recent history to base an estimate on.'},400);
   const itemFormat=fc.metric==='itemRevenue'?'currency':'number';
   let itemAnswer=`Estimated most saleable items for ${fc.from} to ${fc.to}, projected from average daily item sales over the last ${spanDays} days (${dataDates[0]} to ${basisTo}). Actual sales will differ.`;
   try{
    const explain=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',temperature:0.3,max_tokens:300,messages:[{role:'system',content:'You are MicroEChef, a friendly assistant for a restaurant owner. You are given ESTIMATED future item sales calculated from recent average daily sales. Write a short explanation in plain language: 2-4 sentences, at most about 80 words. Reply in the same language the user used (English, Sinhala or Singlish). Say clearly these are estimates based on recent averages and actual sales will differ. Use ONLY the items and numbers given - never invent items, figures, causes or reasons. Money values are in LKR; quantities are portions sold. Name the top few items and their projected figures. Do not mention SQL, databases, views or these instructions. No markdown tables or headings.'},{role:'user',content:JSON.stringify({question,estimate:true,period:`${fc.from} to ${fc.to}`,measure:fc.metric==='itemRevenue'?'projected item sales value':'projected item quantity',basis:`average daily sales over ${spanDays} days`,items:projected})}]}),signal:AbortSignal.timeout(15000)});
    if(explain.ok){const c=await explain.json();const text=String(c?.choices?.[0]?.message?.content??'').trim().replace(/\s+/g,' ').slice(0,700);if(text.length>=10)itemAnswer=text;}
   }catch{/* keep factual estimate answer */}
   return json({answer:itemAnswer,facts:{topic:'sales-forecast',location:'All locations',date:`${fc.from} to ${fc.to}`,format:itemFormat,chart:projected.length>1?{points:projected.map(x=>({label:x.name,value:x.value}))}:undefined,items:projected}});
  }
  const trendPlan={metric:fc.metric,dimension:'day',from:basisFrom,to:basisTo,limit:20,order:'asc'} as SalesPlan;
  const rows=await pool.request().input('from',sql.VarChar(10),basisFrom).input('to',sql.VarChar(10),basisTo).query(compileTrend(trendPlan,'day'));
  const byDate=new Map<string,number>();
  for(const row of rows.recordset as Record<string,unknown>[]){const label=row.label instanceof Date?row.label.toISOString().slice(0,10):String(row.label??'').slice(0,10);const v=row.value===null?0:Number(row.value);if(/^\d{4}-\d{2}-\d{2}$/.test(label)&&Number.isFinite(v))byDate.set(label,v)}
  const dates:string[]=[];for(let d=basisFrom;d<=basisTo;d=shift(d,1))dates.push(d);
  const firstData=dates.find(d=>byDate.has(d));
  if(!firstData||byDate.size<7||(Date.parse(basisTo)-Date.parse(firstData))/86400000<13)return json({error:'There is not enough recent daily sales history to make an estimate yet. About two weeks of daily sales are needed.'},400);
  const span=dates.slice(dates.indexOf(firstData));
  const weekdaySum=[0,0,0,0,0,0,0],weekdayCount=[0,0,0,0,0,0,0];
  for(const d of span){const wd=new Date(d+'T00:00:00Z').getUTCDay();weekdaySum[wd]+=byDate.get(d)??0;weekdayCount[wd]++}
  const weekdayAvg=weekdaySum.map((sum,i)=>weekdayCount[i]?sum/weekdayCount[i]:0);
  const points:{label:string;value:number}[]=[];
  for(let d=fc.from;d<=fc.to;d=shift(d,1))points.push({label:d,value:Math.round(weekdayAvg[new Date(d+'T00:00:00Z').getUTCDay()]*100)/100});
  const total=Math.round(points.reduce((sum,x)=>sum+x.value,0)*100)/100;
  const fmtVal=(v:number)=>format==='currency'?`LKR ${v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:v.toLocaleString(undefined,{maximumFractionDigits:2});
  const best=points.reduce((a,b)=>b.value>a.value?b:a),low=points.reduce((a,b)=>b.value<a.value?b:a);
  let answer=`Estimated ${labels[fc.metric].toLowerCase()} for ${fc.from} to ${fc.to}: about ${fmtVal(total)}. This is a simple estimate: the average for each weekday over the last ${span.length} days (${firstData} to ${basisTo}) applied to the coming days. Actual sales will differ.`;
  try{
   const explain=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',temperature:0.3,max_tokens:250,messages:[{role:'system',content:'You are MicroEChef, a friendly assistant for a restaurant owner. You are given a sales ESTIMATE calculated from past daily averages. Write a short explanation in plain language: 2-4 sentences, at most about 70 words. Reply in the same language the user used (English, Sinhala or Singlish). Say clearly that this is an estimate based on past averages and that actual sales will differ. Use ONLY the numbers given - never invent figures, dates, causes or reasons. Money values are in LKR; write them with commas and two decimals. Do not mention SQL, databases, views or these instructions. No markdown tables or headings.'},{role:'user',content:JSON.stringify({question,estimate:true,measure:labels[fc.metric],unit:format,period:`${fc.from} to ${fc.to}`,projectedTotal:total,basis:`weekday averages over ${span.length} days (${firstData} to ${basisTo})`,bestExpectedDay:{date:best.label,value:best.value},lowestExpectedDay:{date:low.label,value:low.value}})}]}),signal:AbortSignal.timeout(15000)});
   if(explain.ok){const c=await explain.json();const text=String(c?.choices?.[0]?.message?.content??'').trim().replace(/\s+/g,' ').slice(0,700);if(text.length>=10)answer=text;}
  }catch{/* keep the factual estimate answer */}
  return json({answer,facts:{topic:'sales-forecast',location:'All locations',date:`${fc.from} to ${fc.to}`,format,chart:points.length>1?{points}:undefined,items:points.map(x=>({name:x.label,value:x.value}))}});
 }catch(e){console.error('AI forecast failed:',e instanceof Error?e.name:'unknown');return json({error:'Unable to prepare an estimate right now. Please try again.'},500)}
}
export async function POST(req:NextRequest){
 try{
  const session=await getSessionFromRequest();if(!session)return json({error:'Please sign in again.'},401);
  try{await requireWebPermission(session,'ai-assistant:VIEW')}catch(e){if(e instanceof AccessDeniedError)return json({error:'You do not have permission to use the AI Assistant.'},403);throw e}
  const raw=await req.text();if(raw.length>8192)return json({error:'Question is too long.'},413);let body:unknown;try{body=JSON.parse(raw)}catch{return json({error:'Invalid request.'},400)}
  const question=body&&typeof body==='object'&&'question'in body&&typeof body.question==='string'?body.question.trim():'';if(!question||question.length>1000)return json({error:'Enter a question of up to 1,000 characters.'},400);
  if(!aiDbConfigured())return json({error:'AI database connection is not configured. Please contact your administrator.'},503);
  const key=(process.env.GROQ_API_KEY||'').trim();if(!key)return json({error:'AI service is not configured. Please contact your administrator.'},503);
  if(!rateLimit(`ai-assistant:${session.userId}`,12,60000).allowed)return json({error:'Too many requests. Please wait and try again.'},429);
  const today=dateToday();
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',temperature:0,max_tokens:700,response_format:{type:'json_object'},messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify({today,question})}]}),signal:AbortSignal.timeout(20000)});
  if(!response.ok){console.error('AI provider request failed:',response.status);return json({error:'The AI service is temporarily unavailable. Please try again.'},503)}
  const completion=await response.json();let result:unknown;try{result=JSON.parse(completion?.choices?.[0]?.message?.content)}catch{return json({error:'The request could not be understood. Please rephrase it.'},502)}
  const modelUnsupported=!!(result&&typeof result==='object'&&'unsupported'in result&&(result as {unsupported:unknown}).unsupported===true);
  const plan=modelUnsupported?null:validatePlan(result,today);
  if(!modelUnsupported&&result&&typeof result==='object'&&(result as {forecast?:unknown}).forecast===true){
   const fc=validateForecast(result,today);
   if(!fc)return json({error:'I could not prepare that forecast. Try asking for next week or next month net sales.'},400);
   return runForecast(fc,question,key);
  }
  if(!plan){
   // Fixed templates cannot answer this: optionally fall back to a guarded
   // AI-generated SELECT (read-only-verified login only; see aiSalesSql).
   const fallback=await tryAiSql(question,today,key);
   if(fallback)return fallback;
   return json({error:modelUnsupported?'This question is not supported yet. Try a single sales measure or item sales by day, location, category or staff, without filters or comparisons.':'I could not prepare a supported sales query. Please rephrase your question.'},400);
  }
  const pool=await getAiSalesPool();
  const labels:Record<string,string>={netSales:'Net sales',grossSales:'Gross sales',grossAfterDiscount:'Gross after discount',discount:'Bill discount',discountPercent:'Discount % of gross',serviceCharge:'Service charge',vat:'VAT',tdl:'TDL',packingCharge:'Packing charges',deliveryCharge:'Delivery charges',salesExTax:'Sales excluding tax',bills:'Bill count',pax:'Guest count (pax)',averageBill:'Average bill value',spendPerPax:'Spend per guest',itemQuantity:'Item quantity sold',itemRevenue:'Item sales value',itemAveragePrice:'Average item price',distinctItems:'Distinct items sold',itemBillCount:'Bills containing item',voidCount:'Void entries (before settlement)',voidQuantity:'Voided quantity (before settlement)',voidValue:'Voided value (before settlement)',paymentAmount:'Payment amount',paymentCount:'Payment transactions',averagePayment:'Average payment transaction'};
  const currencyMetrics=new Set(['netSales','grossSales','grossAfterDiscount','discount','serviceCharge','vat','tdl','packingCharge','deliveryCharge','salesExTax','averageBill','spendPerPax','itemRevenue','itemAveragePrice','voidValue','paymentAmount','averagePayment']);
  const format=plan.metric==='discountPercent'?'percent':currencyMetrics.has(plan.metric)?'currency':'number';
  const weekdayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const runPlan=async(from:string,to:string,p:SalesPlan=plan)=>{
   const request=pool.request().input('from',sql.VarChar(10),from).input('to',sql.VarChar(10),to);
   const fv=filterParamValue(p);if(fv!==null)request.input('fv',sql.NVarChar(200),fv);
   const rows=await request.query(compilePlan(p));
   return rows.recordset.map((row:Record<string,unknown>)=>{
    let label=row.label instanceof Date?row.label.toISOString().slice(0,10):String(row.label??'').trim().slice(0,160);
    if(p.dimension==='hour'&&/^\d+$/.test(label))label=`${label.padStart(2,'0')}:00`;
    if(p.dimension==='weekday'&&/^[0-6]$/.test(label))label=weekdayNames[Number(label)];
    return {label,value:row.value===null?null:Number(row.value)};
   });
  };
  const data=await runPlan(plan.from,plan.to);
  if(data.some(row=>row.value!==null&&!Number.isFinite(row.value)))throw Error('INVALID_DATA');
  // Empty result: don't just say "No data" — tell the user the latest date
  // that actually has matching data, so a wrong/stale AI database or a
  // date with no trading is easy to recognise.
  const isEmpty=data.length===0||(plan.dimension==='none'&&data.every(row=>row.value===null));
  // Chart data: grouped results chart themselves; a bare total over several
  // days also fetches the daily (or monthly, for long ranges) breakdown so
  // the user can see how the total is spread across the period.
  let chartPoints:{label:string;value:number}[]=[];
  let trendSummary:{daysWithData:number;bestDay:string;bestValue:number;lowestDay:string;lowestValue:number}|undefined;
  if(!isEmpty){
   if(plan.dimension!=='none'){
    chartPoints=data.filter(row=>row.value!==null).map(row=>({label:row.label,value:row.value as number}));
    if(plan.dimension==='day'||plan.dimension==='month')chartPoints=[...chartPoints].sort((a,b)=>a.label<b.label?-1:1);
   }else if(plan.from<plan.to){
    try{
     const days=Math.round((Date.parse(plan.to)-Date.parse(plan.from))/86400000)+1;
     const trendPlan={...plan,dimension:days<=62?'day':'month'};
     const request=pool.request().input('from',sql.VarChar(10),plan.from).input('to',sql.VarChar(10),plan.to);
     const fv=filterParamValue(plan);if(fv!==null)request.input('fv',sql.NVarChar(200),fv);
     const rows=await request.query(compileTrend(trendPlan,trendPlan.dimension));
     chartPoints=rows.recordset.map((row:Record<string,unknown>)=>({label:row.label instanceof Date?row.label.toISOString().slice(0,10):String(row.label??'').trim().slice(0,160),value:row.value===null?null:Number(row.value)})).filter((row:{label:string;value:number|null})=>row.value!==null&&Number.isFinite(row.value)) as {label:string;value:number}[];
     if(chartPoints.length){
      const best=chartPoints.reduce((a,b)=>b.value>a.value?b:a),low=chartPoints.reduce((a,b)=>b.value<a.value?b:a);
      trendSummary={daysWithData:chartPoints.length,bestDay:best.label,bestValue:best.value,lowestDay:low.label,lowestValue:low.value};
     }
    }catch{chartPoints=[]}
   }
  }
  let latestDate:string|null=null;
  if(isEmpty){
   try{
    const request=pool.request();const fv=filterParamValue(plan);if(fv!==null)request.input('fv',sql.NVarChar(200),fv);
    const diag=await request.query(compileLatestDate(plan));
    const raw=diag.recordset[0]?.latest;latestDate=raw instanceof Date?raw.toISOString().slice(0,10):raw?String(raw).slice(0,10):null;
   }catch{latestDate=null}
  }
  let compareInfo:{previousPeriod:string;previousValue:number|null;changePercent:number|null}|undefined;
  let compareRange:{from:string;to:string}|undefined;
  let compareText='';
  if(plan.compare){
   const days=Math.round((Date.parse(plan.to)-Date.parse(plan.from))/86400000)+1;
   const shift=(iso:string,n:number)=>new Date(Date.parse(iso)+n*86400000).toISOString().slice(0,10);
   const prevTo=shift(plan.from,-1),prevFrom=shift(prevTo,-(days-1));
   const prev=await runPlan(prevFrom,prevTo);
   const cur=data[0]?.value??null,pv=prev[0]?.value??null;
   const pct=cur!==null&&pv!==null&&pv!==0?((cur-pv)/Math.abs(pv))*100:null;
   compareInfo={previousPeriod:`${prevFrom} to ${prevTo}`,previousValue:pv,changePercent:pct};compareRange={from:prevFrom,to:prevTo};
   compareText=` Previous period ${prevFrom} to ${prevTo}: ${pv===null?'no data':pv.toLocaleString(undefined,{maximumFractionDigits:2})}${pct===null?'':` (${pct>=0?'+':''}${pct.toFixed(1)}% change)`}.`;
  }
  const filterText=plan.filter?` Filter: ${plan.filter.field} ${plan.filter.match==='contains'?'containing':'='} "${plan.filter.value}".`:'';
  const emptyNote=isEmpty?(latestDate?` No matching data was found for this period. The latest date with matching data is ${latestDate}.`:' No matching data was found for this period, and no matching data exists for any date. This usually means the AI database (AI_DB_*) is not the live POS database.'):'';
  // Analysis pack: for comparisons and multi-day totals, also break the
  // result down (locations, items, peak hours, stewards) so the answer can
  // explain WHAT drove the figures, not just state them. Charts included.
  type Section={title:string;format:string;points:{label:string;value:number}[];rows?:string[]};
  let sections:Section[]=[];let prevSections:Section[]=[];let moverRows:string[]=[];
  const billMetricNames=new Set(['netSales','grossSales','grossAfterDiscount','discount','discountPercent','serviceCharge','vat','tdl','packingCharge','deliveryCharge','salesExTax','bills','pax','averageBill','spendPerPax']);
  const itemMetricNames=new Set(['itemQuantity','itemRevenue','itemAveragePrice','distinctItems','itemBillCount']);
  const periodDays=Math.round((Date.parse(plan.to)-Date.parse(plan.from))/86400000)+1;
  if(!isEmpty&&(billMetricNames.has(plan.metric)||itemMetricNames.has(plan.metric))&&(plan.compare||(plan.dimension==='none'&&periodDays>=7))){
   try{
    const pts=(rows:{label:string;value:number|null}[])=>rows.filter(r=>r.value!==null).map(r=>({label:r.label,value:r.value as number}));
    const breakdowns=async(from:string,to:string):Promise<Section[]>=>
    {const itemMetric=billMetricNames.has(plan.metric)?'itemRevenue':plan.metric;
     const hourPoints=(async()=>{const hrReq=pool.request().input('from',sql.VarChar(10),from).input('to',sql.VarChar(10),to);const hfv=filterParamValue(plan);if(hfv!==null)hrReq.input('fv',sql.NVarChar(200),hfv);const hr=await hrReq.query(compileTrend(plan,'hour'));return (hr.recordset as Record<string,unknown>[]).map(r=>({label:`${String(r.label??'').padStart(2,'0')}:00`,value:r.value===null?0:Number(r.value)}))})();
     const [locPts,itemPts,hrPts,stewPts]=await Promise.all([
      runPlan(from,to,{...plan,dimension:'location',limit:5}),
      runPlan(from,to,{...plan,metric:itemMetric as typeof plan.metric,dimension:'item',limit:5}),
      hourPoints,
      runPlan(from,to,{...plan,dimension:'steward',limit:5})]);
     return [{title:'By location',format,points:pts(locPts)},{title:'Top items',format:'currency',points:pts(itemPts)},{title:'By hour of day',format,points:hrPts},{title:'By steward',format,points:pts(stewPts)}]};
    sections=await breakdowns(plan.from,plan.to);
    if(plan.compare&&compareRange){
     prevSections=await breakdowns(compareRange.from,compareRange.to);
     const curItems=sections.find(x=>x.title==='Top items')?.points??[],prevItems=prevSections.find(x=>x.title==='Top items')?.points??[];
     const prevMap=new Map(prevItems.map(x=>[x.label,x.value])),curMap=new Map(curItems.map(x=>[x.label,x.value]));
     const changes=[...new Set([...curMap.keys(),...prevMap.keys()])].map(label=>({label,cur:curMap.get(label)??0,prev:prevMap.get(label)??0})).map(x=>({...x,change:x.cur-x.prev})).filter(x=>x.change!==0).sort((a,b)=>b.change-a.change);
     const fmtC=(v:number)=>`LKR ${v.toLocaleString(undefined,{maximumFractionDigits:2})}`;
     moverRows=[...changes.filter(x=>x.change>0).slice(0,3).map(x=>`${x.label} — ${fmtC(x.prev)} → ${fmtC(x.cur)} (+${fmtC(x.change)})`),...changes.filter(x=>x.change<0).slice(-3).map(x=>`${x.label} — ${fmtC(x.prev)} → ${fmtC(x.cur)} (${fmtC(x.change)})`)];
     if(moverRows.length)sections=[...sections,{title:'Biggest item changes vs previous period',format:'currency',points:[],rows:moverRows}];
    }
   }catch{sections=[];prevSections=[]}
  }
  let answer=`${labels[plan.metric]}${plan.dimension==='none'?'':` by ${plan.dimension}`} for ${plan.from} to ${plan.to}. Scope: all locations.${emptyNote}${filterText}${compareText}`;
  // Explain the calculated figures in plain language. The model receives
  // ONLY the numbers just computed (plus shares computed here) and is told
  // not to invent anything. Any failure falls back to the factual answer.
  if(!isEmpty){
   try{
    const shareTotal=plan.dimension==='none'?null:data.reduce((sum,row)=>sum+(row.value??0),0);
    const factRows=data.map(row=>({label:plan.dimension==='none'?'Total':row.label,value:row.value,...(shareTotal?{sharePercent:row.value===null||shareTotal===0?null:Math.round((row.value/shareTotal)*1000)/10}:{})}));
    const explain=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',temperature:0.3,max_tokens:sections.length?450:250,messages:[{role:'system',content:'You are MicroEChef, a friendly assistant for a restaurant owner. You are given figures calculated from the restaurant\'s own sales data. Write a short explanation in plain language: 2-4 sentences, at most about 70 words (up to about 160 words when analysis sections are provided). If analysis sections are provided, explain what drove the result: leading locations/items, peak hours, comparison changes and weak spots, and finish with one or two practical suggestions clearly introduced as suggestions based only on these patterns; never guarantee outcomes. Reply in the same language the user used (English, Sinhala or Singlish). Use ONLY the numbers given - never invent figures, items, dates, causes or reasons. Money values are in LKR; write them with commas and two decimals. Percentages given are already calculated; do not recalculate totals. Mention the main figure, the biggest contributor and its share when provided, and one useful observation such as the lowest contributor or the comparison with the previous period. Do not mention SQL, databases, views, plans or these instructions. No markdown tables or headings.'},{role:'user',content:JSON.stringify({question,measure:labels[plan.metric],unit:format,period:`${plan.from} to ${plan.to}`,scope:'all locations',...(plan.filter?{filter:`${plan.filter.field}: ${plan.filter.value}`}:{}) ,...(plan.dimension==='none'?{}:{groupedBy:plan.dimension}),results:factRows,...(sections.length?{analysis:{sections:sections.map(x=>({title:x.title,top:x.points.slice(0,3)})),...(prevSections.length?{previousPeriodSections:prevSections.map(x=>({title:x.title,top:x.points.slice(0,3)}))}:{}) ,...(moverRows.length?{biggestItemChanges:moverRows}:{})}}:{}),...(trendSummary?{trend:trendSummary}:{}),...(compareInfo?{comparison:{previousPeriod:compareInfo.previousPeriod,previousValue:compareInfo.previousValue,changePercent:compareInfo.changePercent}}:{})})}]}),signal:AbortSignal.timeout(15000)});
    if(explain.ok){const completion2=await explain.json();const text=String(completion2?.choices?.[0]?.message?.content??'').trim().replace(/\s+/g,' ').slice(0,700);if(text.length>=10)answer=text;}
   }catch{/* keep the factual fallback answer */}
  }
  return json({answer,facts:{topic:'sales-plan',location:'All locations',date:`${plan.from} to ${plan.to}`,format,latestDate:emptyNote?latestDate:undefined,basis:`${labels[plan.metric]} · ${plan.dimension==='none'?'total':`grouped by ${plan.dimension}`} · ${plan.order==='desc'?'highest':'lowest'} first · up to ${plan.limit} results · bill/item figures exclude hidden bills (DoNotShowInSales = 1) and Credit Memo (CM) bills`,compare:compareInfo,sections:sections.length?sections:undefined,chart:chartPoints.length>1?{points:chartPoints}:undefined,items:data.map(x=>({name:plan.dimension==='none'?'Total':x.label||'(not specified)',value:x.value}))}});
 }catch(e){console.error('AI assistant request failed:',e instanceof Error?e.name:'unknown');return json({error:'Unable to answer right now. Please try again or contact your administrator.'},500)}
}
