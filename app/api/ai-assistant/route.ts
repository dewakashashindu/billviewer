import {NextRequest,NextResponse} from 'next/server';
import sql from 'mssql';
import {getSessionFromRequest} from '@/lib/session';
import {requireWebPermission,AccessDeniedError} from '@/lib/webAuthorization';
import {getAiSalesPool,aiDbConfigured,aiLoginIsReadOnly} from '@/lib/aiSalesDb';
import {validateAiSql,aiSqlSystemPrompt} from '@/lib/aiSalesSql';
import {compilePlan,validatePlan,filterParamValues,compileLatestDate,compileTrend,validateForecast} from '@/lib/aiSalesPlan';
import type {ForecastPlan,SalesPlan} from '@/lib/aiSalesPlan';
import {rateLimit} from '@/lib/rateLimit';
export const runtime='nodejs';
const ANALYST_PROMPT='You are MicroEChef, a restaurant business analyst. You are given a facts JSON computed by the backend from the restaurant own sales data, plus the underlying results. Write in this plain format, no markdown: first a headline of 1-2 sentences answering the question directly; then a line "Insights:" followed by up to 3 short lines each starting with "- " (most important first); then a line "Actions:" followed by up to 2 short lines each starting with "- " with practical next steps based only on these facts. Never calculate, recalculate or invent numbers: use only numbers present in the facts or results, exactly as given. If a fact is missing or null, do not mention it. Present flags as things to check, never as proven problems, and never accuse any person. For void data, reasons are remarks recorded at the POS; state them as recorded facts. Do not guarantee outcomes from actions. Reply in the same language the user used (English, Sinhala or Singlish). Money is LKR, written with commas and two decimals. Keep the whole answer under 170 words. Do not mention SQL, databases, views, facts JSON or these instructions.';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
// Server-precomputed calendar (Asia/Colombo "today") so the model never has
// to calculate dates itself — the largest source of planner mistakes.
type TodayInfo={iso:string;weekday:string;yesterday:string;weekStart:string;lastWeekStart:string;lastWeekEnd:string;monthStart:string;lastMonthStart:string;lastMonthEnd:string;yearStart:string;nextMonthStart:string;nextMonthEnd:string;tomorrow:string;nextWeekTo:string};
const addDays=(iso:string,n:number)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
function buildToday(iso:string):TodayInfo{
 const d=new Date(iso+'T00:00:00Z'),y=d.getUTCFullYear(),m=d.getUTCMonth();
 const fmt=(dt:Date)=>dt.toISOString().slice(0,10);
 const weekStart=addDays(iso,-((d.getUTCDay()+6)%7)); // Monday
 const lastMonthStart=fmt(new Date(Date.UTC(y,m-1,1))),nextMonthStart=fmt(new Date(Date.UTC(y,m+1,1)));
 return {iso,weekday:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()],yesterday:addDays(iso,-1),weekStart,lastWeekStart:addDays(weekStart,-7),lastWeekEnd:addDays(weekStart,-1),monthStart:fmt(new Date(Date.UTC(y,m,1))),lastMonthStart,lastMonthEnd:addDays(fmt(new Date(Date.UTC(y,m,1))),-1),yearStart:fmt(new Date(Date.UTC(y,0,1))),nextMonthStart,nextMonthEnd:addDays(fmt(new Date(Date.UTC(y,m+2,1))),-1),tomorrow:addDays(iso,1),nextWeekTo:addDays(iso,7)};
}
const buildPrompt=(today:TodayInfo,prevQuestion?:string,prevPlan?:unknown)=>`
You convert restaurant SALES questions into ONE read-only aggregation plan.
Output: a single JSON object only. No prose, no markdown, no SQL.

TODAY: ${today.iso} (${today.weekday})
PRECOMPUTED DATES (use these exactly for those named periods):
- yesterday: ${today.yesterday}
- thisWeek (Mon-today): ${today.weekStart} to ${today.iso}
- lastWeek: ${today.lastWeekStart} to ${today.lastWeekEnd}
- thisMonth: ${today.monthStart} to ${today.iso}
- lastMonth: ${today.lastMonthStart} to ${today.lastMonthEnd}
- thisYear: ${today.yearStart} to ${today.iso}
- nextMonth: ${today.nextMonthStart} to ${today.nextMonthEnd}

LANGUAGE: English, Sinhala, Singlish, typos allowed.
Hints: wikunuma/sales=netSales, adu/lowest=asc, wedi/most=desc, ada=today,
iye=yesterday, mee masaya=thisMonth, kalin masaya=lastMonth, branch=location.

SCHEMA
{"metric":M,"dimension":D,"from":"YYYY-MM-DD","to":"YYYY-MM-DD","limit":10,"order":"desc"}
Optional: "metrics":[M,M,M] (up to 3) | "filters":[{field,value,match}] | "compare":"previous"|"lastYear"

METRIC FAMILIES (never mix families)
bill: netSales grossSales grossAfterDiscount discount discountPercent serviceCharge vat tdl packingCharge deliveryCharge salesExTax bills pax averageBill spendPerPax paxPerBill
item: itemQuantity itemRevenue itemAveragePrice distinctItems itemBillCount itemsPerBill itemCost itemProfit itemMarginPercent
void: voidCount voidQuantity voidValue
payment: paymentAmount paymentCount averagePayment

DIMENSIONS BY FAMILY
bill: none day month weekday hour location billType orderMode cashier steward table
item: bill dims + item category (distinctItems: no item)
void: none day month weekday hour location cashier steward item voidType authorizer table reason
payment: none day month weekday location payment cashier

DEFAULTS
- No period => today. No metric stated for "sales" => netSales.
- Top/best items => itemQuantity unless revenue/value is clearly asked.
- limit 1-20, order desc unless lowest/worst/adu.
- Payment method questions => paymentAmount + dimension payment.
- Max range 367 days, no future dates (except forecast).

FILTERS: max 2, only if user named them, value copied exactly.
Codes (billType orderMode cashier steward table voidType) => "exact".
location => "exact" with the branch code or branch name the user gave.
item/category/payment/reason => "contains".
Void reasons: "why voids / void reasons / remarks / hethuwa" => void metric + dimension reason (voidCount unless quantity or value is clearly asked). Reasons come only from the remarks recorded in the POS; if none was recorded the data says so.

COMPARE: "vs last month/previous" => compare:"previous"; "vs last year" => compare:"lastYear".
Use dimension none, ONE metric, from/to = the current period.

RUN RATE: run rate / pace / tracking for the rest of THIS month => return the month-to-date plan (netSales unless another metric is named, dimension none, thisMonth dates), NOT a forecast. The system adds the projection.
FORECAST: future sales => {"forecast":true,"metric":M,"from":..,"to":..}
M in netSales grossSales bills pax itemQuantity itemRevenue. Max 62 days, from >= today.
"next month" forecast => from ${today.nextMonthStart} to ${today.nextMonthEnd}.
Which items will sell most => add "item":true, metric itemQuantity.

FOLLOW-UP: ${prevQuestion ? `Previous question: "${prevQuestion}"
Previous plan: ${JSON.stringify(prevPlan ?? {})}
If the new question is a short follow-up ("by branch?", "only dine-in", "vs last year"), return the FULL plan: copy the previous plan and change only what is asked. Otherwise ignore it.` : 'None.'}

UNSUPPORTED => {"unsupported":true,"message":"short reason"}
for: inventory/stock, open bills/tables, finding a specific bill, item prices/availability, staffing.

EXAMPLES
Q: ada wikunuma kiyada?
{"metric":"netSales","dimension":"none","from":"${today.iso}","to":"${today.iso}","limit":10,"order":"desc"}

Q: top 5 items this month by revenue
{"metric":"itemRevenue","dimension":"item","from":"${today.monthStart}","to":"${today.iso}","limit":5,"order":"desc"}

Q: sales this month vs last month
{"metric":"netSales","dimension":"none","from":"${today.monthStart}","to":"${today.iso}","limit":10,"order":"desc","compare":"previous"}

Q: quantity and revenue by category last week
{"metrics":["itemQuantity","itemRevenue"],"dimension":"category","from":"${today.lastWeekStart}","to":"${today.lastWeekEnd}","limit":10,"order":"desc"}

Q: cash vs card this month
{"metric":"paymentAmount","dimension":"payment","from":"${today.monthStart}","to":"${today.iso}","limit":10,"order":"desc"}

Q: iye dine-in sales (location Colombo)
{"metric":"netSales","dimension":"none","from":"${today.yesterday}","to":"${today.yesterday}","limit":10,"order":"desc","filters":[{"field":"orderMode","value":"dine-in","match":"exact"},{"field":"location","value":"Colombo","match":"exact"}]}

Q: ai ada voids wenne? / why were there voids today?
{"metric":"voidCount","dimension":"reason","from":"${today.iso}","to":"${today.iso}","limit":10,"order":"desc"}

Q: next week sales?
{"forecast":true,"metric":"netSales","from":"${today.tomorrow}","to":"${today.nextWeekTo}"}

Q: how many bills in stock?
{"unsupported":true,"message":"Inventory is not supported"}
`;
// Guarded AI-SQL fallback. Returns null whenever anything is not fully
// verified, so the caller can answer with the normal "not supported" error.
async function tryAiSql(question:string,today:string,key:string){
 try{
  if(process.env.AI_SQL_ENABLED!=='true')return null;
  const pool=await getAiSalesPool();
  if(!(await aiLoginIsReadOnly(pool)))console.warn('AI SQL: AI_DB login is not verified read-only. Validator plus always-rolled-back transaction enforced; a dedicated SELECT-only login is still recommended.');
  let safeSql:string|null=null;let recordsetRaw:Record<string,unknown>[]|null=null;let feedback='';
  for(let attempt=0;attempt<2&&!recordsetRaw;attempt++){
   const gen=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',temperature:0,max_tokens:1600,response_format:{type:'json_object'},messages:[{role:'system',content:aiSqlSystemPrompt(today)},{role:'user',content:JSON.stringify({today,question,...(feedback?{previousProblem:feedback}:{})})}]}),signal:AbortSignal.timeout(20000)});
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
  const prevRaw=body&&typeof body==='object'?'previous'in body?(body as {previous?:unknown}).previous:undefined:undefined;
  const previous=prevRaw&&typeof prevRaw==='object'&&typeof (prevRaw as {question?:unknown}).question==='string'&&(prevRaw as {context?:unknown}).context&&typeof (prevRaw as {context?:unknown}).context==='object'?{question:String((prevRaw as {question:string}).question).slice(0,300),context:(prevRaw as {context:unknown}).context}:undefined;
  if(!aiDbConfigured())return json({error:'AI database connection is not configured. Please contact your administrator.'},503);
  const key=(process.env.GROQ_API_KEY||'').trim();if(!key)return json({error:'AI service is not configured. Please contact your administrator.'},503);
  if(!rateLimit(`ai-assistant:${session.userId}`,12,60000).allowed)return json({error:'Too many requests. Please wait and try again.'},429);
  const today=dateToday();
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',temperature:0,max_tokens:2000,response_format:{type:'json_object'},messages:[{role:'system',content:buildPrompt(buildToday(today),previous?.question,previous?.context)},{role:'user',content:JSON.stringify({question})}]}),signal:AbortSignal.timeout(20000)});
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
  const labels:Record<string,string>={netSales:'Net sales',grossSales:'Gross sales',grossAfterDiscount:'Gross after discount',discount:'Bill discount',discountPercent:'Discount % of gross',serviceCharge:'Service charge',vat:'VAT',tdl:'TDL',packingCharge:'Packing charges',deliveryCharge:'Delivery charges',salesExTax:'Sales excluding tax',bills:'Bill count',pax:'Guest count (pax)',averageBill:'Average bill value',spendPerPax:'Spend per guest',itemQuantity:'Item quantity sold',itemRevenue:'Item sales value',itemAveragePrice:'Average item price',distinctItems:'Distinct items sold',itemBillCount:'Bills containing item',voidCount:'Void entries (before settlement)',voidQuantity:'Voided quantity (before settlement)',voidValue:'Voided value (before settlement)',paymentAmount:'Payment amount',paymentCount:'Payment transactions',averagePayment:'Average payment transaction',paxPerBill:'Guests per bill',itemsPerBill:'Items per bill',itemCost:'Item cost (recorded)',itemProfit:'Item gross profit (recorded cost)',itemMarginPercent:'Item margin % (recorded cost)'};
  const currencyMetrics=new Set(['netSales','grossSales','grossAfterDiscount','discount','serviceCharge','vat','tdl','packingCharge','deliveryCharge','salesExTax','averageBill','spendPerPax','itemRevenue','itemAveragePrice','voidValue','paymentAmount','averagePayment','itemCost','itemProfit']);
  const percentMetrics=new Set(['discountPercent','itemMarginPercent']);
  const formatOf=(m:string)=>percentMetrics.has(m)?'percent':currencyMetrics.has(m)?'currency':'number';
  const format=formatOf(plan.metric);
  const fmtValue=(m:string,v:number|null)=>v===null?'No data':formatOf(m)==='currency'?`LKR ${v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:formatOf(m)==='percent'?`${v.toLocaleString(undefined,{maximumFractionDigits:2})}%`:v.toLocaleString(undefined,{maximumFractionDigits:2});
  const bindFilters=(request:ReturnType<typeof pool.request>,pl:SalesPlan)=>{filterParamValues(pl).forEach((v,i)=>request.input(`fv${i}`,sql.NVarChar(200),v))};
  const weekdayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const runPlan=async(from:string,to:string,p:SalesPlan=plan)=>{
   const request=pool.request().input('from',sql.VarChar(10),from).input('to',sql.VarChar(10),to);
   bindFilters(request,p);
   const rows=await request.query(compilePlan(p));
   return rows.recordset.map((row:Record<string,unknown>)=>{
    let label=row.label instanceof Date?row.label.toISOString().slice(0,10):String(row.label??'').trim().slice(0,160);
    if(p.dimension==='hour'&&/^\d+$/.test(label))label=`${label.padStart(2,'0')}:00`;
    if(p.dimension==='weekday'&&/^[0-6]$/.test(label))label=weekdayNames[Number(label)];
    return {label,values:p.metrics.map((_,i)=>row[`v${i}`]===null||row[`v${i}`]===undefined?null:Number(row[`v${i}`]))};
   });
  };
  const data=await runPlan(plan.from,plan.to);
  if(data.some(row=>row.values.some(v=>v!==null&&!Number.isFinite(v))))throw Error('INVALID_DATA');
  // Empty result: don't just say "No data" — tell the user the latest date
  // that actually has matching data, so a wrong/stale AI database or a
  // date with no trading is easy to recognise.
  const isEmpty=data.length===0||(plan.dimension==='none'&&data.every(row=>row.values.every(v=>v===null)));
  // Chart data: grouped results chart themselves; a bare total over several
  // days also fetches the daily (or monthly, for long ranges) breakdown so
  // the user can see how the total is spread across the period.
  let chartPoints:{label:string;value:number}[]=[];
  let trendSummary:{daysWithData:number;bestDay:string;bestValue:number;lowestDay:string;lowestValue:number}|undefined;
  if(!isEmpty){
   if(plan.dimension!=='none'){
    chartPoints=data.filter(row=>row.values[0]!==null).map(row=>({label:row.label,value:row.values[0] as number}));
    if(plan.dimension==='day'||plan.dimension==='month')chartPoints=[...chartPoints].sort((a,b)=>a.label<b.label?-1:1);
   }else if(plan.from<plan.to){
    try{
     const days=Math.round((Date.parse(plan.to)-Date.parse(plan.from))/86400000)+1;
     const trendPlan={...plan,dimension:days<=62?'day':'month'};
     const request=pool.request().input('from',sql.VarChar(10),plan.from).input('to',sql.VarChar(10),plan.to);
     bindFilters(request,trendPlan);
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
    const request=pool.request();bindFilters(request,plan);
    const diag=await request.query(compileLatestDate(plan));
    const raw=diag.recordset[0]?.latest;latestDate=raw instanceof Date?raw.toISOString().slice(0,10):raw?String(raw).slice(0,10):null;
   }catch{latestDate=null}
  }
  let compareInfo:{previousPeriod:string;previousValue:number|null;changePercent:number|null;mode?:'previous'|'lastYear'|'lastMonth'}|undefined;
  let compareRange:{from:string;to:string}|undefined;
  let compareText='';
  if(plan.compare){
   const days=Math.round((Date.parse(plan.to)-Date.parse(plan.from))/86400000)+1;
   const shift=(iso:string,n:number)=>new Date(Date.parse(iso)+n*86400000).toISOString().slice(0,10);
   const shiftYear=(iso:string)=>{const d=new Date(iso+'T00:00:00Z');const day=d.getUTCDate();d.setUTCFullYear(d.getUTCFullYear()-1);if(d.getUTCDate()!==day)d.setUTCDate(0);return d.toISOString().slice(0,10)};
   const isMtd=plan.compare==='previous'&&plan.from.endsWith('-01')&&plan.to===today;
   const mtdPrevFrom=(()=>{const d=new Date(plan.from+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,10)})();
   const prevTo=plan.compare==='lastYear'?shiftYear(plan.to):isMtd?shift(mtdPrevFrom,Number(plan.to.slice(8,10))-1):shift(plan.from,-1),prevFrom=plan.compare==='lastYear'?shiftYear(plan.from):isMtd?mtdPrevFrom:shift(prevTo,-(days-1));
   const compareLabel=plan.compare==='lastYear'?'Same period last year':isMtd?'Same days last month':'Previous period';
   const prev=await runPlan(prevFrom,prevTo);
   const cur=data[0]?.values[0]??null,pv=prev[0]?.values[0]??null;
   const pct=cur!==null&&pv!==null&&pv!==0?((cur-pv)/Math.abs(pv))*100:null;
   compareInfo={previousPeriod:`${prevFrom} to ${prevTo}`,previousValue:pv,changePercent:pct,mode:isMtd?'lastMonth':plan.compare};compareRange={from:prevFrom,to:prevTo};
   compareText=` ${compareLabel} ${prevFrom} to ${prevTo}: ${pv===null?'no data':pv.toLocaleString(undefined,{maximumFractionDigits:2})}${pct===null?'':` (${pct>=0?'+':''}${pct.toFixed(1)}% change)`}.`;
  }
  const costNote=plan.metrics.some(mm=>['itemCost','itemProfit','itemMarginPercent'].includes(mm))?' Cost, profit and margin use the CostPrice recorded on each sold item; labour and overheads are not included, so this is item-level gross profit, not total business profit.':'';
  const filterText=plan.filters.length?(' Filters: '+plan.filters.map(f=>f.field+' '+(f.match==='contains'?'containing':'=')+' "'+f.value+'"').join('; ')+'.'):'';
  const emptyNote=isEmpty?(latestDate?` No matching data was found for this period. The latest date with matching data is ${latestDate}.`:' No matching data was found for this period, and no matching data exists for any date. This usually means the AI database (AI_DB_*) is not the live POS database.'):'';
  // Analysis pack: for comparisons and multi-day totals, also break the
  // result down (locations, items, peak hours, stewards) so the answer can
  // explain WHAT drove the figures, not just state them. Charts included.
  type Section={title:string;format:string;points:{label:string;value:number}[];rows?:string[]};
  let sections:Section[]=[];let prevSections:Section[]=[];let moverRows:string[]=[];
  const billMetricNames=new Set(['netSales','grossSales','grossAfterDiscount','discount','discountPercent','serviceCharge','vat','tdl','packingCharge','deliveryCharge','salesExTax','bills','pax','averageBill','spendPerPax','paxPerBill']);
  const itemMetricNames=new Set(['itemQuantity','itemRevenue','itemAveragePrice','distinctItems','itemBillCount','itemsPerBill','itemCost','itemProfit','itemMarginPercent']);
  const periodDays=Math.round((Date.parse(plan.to)-Date.parse(plan.from))/86400000)+1;
  if(!isEmpty&&(billMetricNames.has(plan.metric)||itemMetricNames.has(plan.metric))&&(plan.compare||(plan.dimension==='none'&&periodDays>=7))){
   try{
    const pts=(rows:{label:string;values:(number|null)[]}[])=>rows.filter(r=>r.values[0]!==null).map(r=>({label:r.label,value:r.values[0] as number}));
    const breakdowns=async(from:string,to:string):Promise<Section[]>=>
    {const itemMetric=billMetricNames.has(plan.metric)?'itemRevenue':plan.metric;
     const hourPoints=(async()=>{const hrReq=pool.request().input('from',sql.VarChar(10),from).input('to',sql.VarChar(10),to);bindFilters(hrReq,plan);const hr=await hrReq.query(compileTrend(plan,'hour'));return (hr.recordset as Record<string,unknown>[]).map(r=>({label:`${String(r.label??'').padStart(2,'0')}:00`,value:r.value===null?0:Number(r.value)}))})();
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
  // Void answers always carry a remarks breakdown: the reasons recorded in
  // VOIDREMARKS are primary POS facts, shown as-is (never used to accuse).
  const voidMetricNames=new Set(['voidCount','voidQuantity','voidValue']);
  if(!isEmpty&&voidMetricNames.has(plan.metric)&&plan.dimension!=='reason'){
   try{
    const vpts=(rows:{label:string;values:(number|null)[]}[])=>rows.filter(r=>r.values[0]!==null).map(r=>({label:r.label,value:r.values[0] as number}));
    const [reasonPts,typePts,authPts]=await Promise.all([
     runPlan(plan.from,plan.to,{...plan,dimension:'reason',limit:8}),
     plan.dimension==='voidType'?Promise.resolve([] as {label:string;values:(number|null)[]}[]):runPlan(plan.from,plan.to,{...plan,dimension:'voidType',limit:5}),
     plan.dimension==='authorizer'?Promise.resolve([] as {label:string;values:(number|null)[]}[]):runPlan(plan.from,plan.to,{...plan,dimension:'authorizer',limit:5})]);
    const extra:Section[]=[{title:'Void reasons (from POS remarks)',format,points:vpts(reasonPts)}];
    if(typePts.length)extra.push({title:'By void type',format,points:vpts(typePts)});
    if(authPts.length)extra.push({title:'Approved by',format,points:vpts(authPts)});
    sections=[...sections,...extra];
   }catch{/* keep the plain answer */}
  }
  // Advanced analysis facts (user's 5 layers): context, comparison, drivers,
  // anomaly flags and action inputs - ALL computed here. The model only
  // narrates this JSON; it never calculates or invents a number.
  let analysisFacts:Record<string,unknown>|null=null;
  if(!isEmpty){
   try{
    const round2=(n:number)=>Math.round(n*100)/100;
    const sharePct=(v:number,t:number|null)=>t===null||t===0?null:round2((v/t)*100);
    const pctChg=(a:number|null,b:number|null)=>a===null||b===null||b===0?null:round2(((a-b)/Math.abs(b))*100);
    const totalVal=plan.dimension==='none'?(data[0]?.values[0]??null):null;
    const flags:string[]=[];
    const facts:Record<string,unknown>={measure:labels[plan.metric],period:`${plan.from} to ${plan.to}`,total:totalVal};
    // Layer 1: context from the daily series (trend already fetched above)
    const dailyPts=(plan.dimension==='day'||plan.dimension==='none')&&periodDays<=62?chartPoints.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.label)):[];
    if(dailyPts.length>1&&totalVal!==null){
     const vals=dailyPts.map(x=>x.value),mean=vals.reduce((a,b)=>a+b,0)/vals.length;
     const sd=Math.sqrt(vals.reduce((a,v)=>a+(v-mean)*(v-mean),0)/vals.length);
     const best=dailyPts.reduce((a,b)=>b.value>a.value?b:a),worst=dailyPts.reduce((a,b)=>b.value<a.value?b:a);
     const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
     const wdSum=new Map<string,{sum:number;n:number}>();
     for(const pt of dailyPts){const wd=dayNames[new Date(pt.label+'T00:00:00Z').getUTCDay()];const e=wdSum.get(wd)??{sum:0,n:0};e.sum+=pt.value;e.n++;wdSum.set(wd,e)}
     const wdAvg=[...wdSum.entries()].map(([weekday,e])=>({weekday,averagePerDay:round2(e.sum/e.n),days:e.n})).sort((a,b)=>b.averagePerDay-a.averagePerDay);
     const wknd=wdAvg.filter(w=>w.weekday==='Saturday'||w.weekday==='Sunday'),wkdy=wdAvg.filter(w=>w.weekday!=='Saturday'&&w.weekday!=='Sunday');
     const avgOf=(arr:{averagePerDay:number}[])=>arr.length?arr.reduce((a,w)=>a+w.averagePerDay,0)/arr.length:null;
     facts.dailyAverage=round2(mean);facts.daysWithData=dailyPts.length;
     facts.bestDay={date:best.label,value:best.value};facts.worstDay={date:worst.label,value:worst.value};
     if(wdAvg.length>=4){facts.weekdayAverages=wdAvg;facts.bestWeekday=wdAvg[0];facts.worstWeekday=wdAvg[wdAvg.length-1];const we=avgOf(wknd),wi=avgOf(wkdy);if(we!==null&&wi!==null)facts.weekendVsWeekdayPercent=pctChg(we,wi)}
     // run rate for a month-to-date question (rest of this month)
     if(plan.to===today&&plan.from.endsWith('-01')&&['netSales','grossSales','bills'].includes(plan.metric)){
      const d0=new Date(plan.to+'T00:00:00Z'),lastDay=new Date(Date.UTC(d0.getUTCFullYear(),d0.getUTCMonth()+1,0)).getUTCDate();
      const wdMap=new Map(wdAvg.map(w=>[w.weekday,w.averagePerDay]));let projectedRemaining=0;
      for(let day=d0.getUTCDate()+1;day<=lastDay;day++){const wd=dayNames[new Date(Date.UTC(d0.getUTCFullYear(),d0.getUTCMonth(),day)).getUTCDay()];projectedRemaining+=wdMap.get(wd)??mean}
      facts.runRate={monthToDateTotal:totalVal,remainingDays:lastDay-d0.getUTCDate(),projectedRemaining:round2(projectedRemaining),projectedMonthTotal:round2(totalVal+projectedRemaining),basis:wdMap.size>=4?'weekday averages this month':'daily average this month'};
     }
     // Layer 4: outliers and a suspiciously low day (possible partial day)
     if(sd>0)for(const pt of dailyPts)if(Math.abs(pt.value-mean)>2*sd)flags.push(`Unusual day: ${pt.label} was ${pt.value} vs a daily average of ${round2(mean)} - worth checking what happened that day.`);
     if(worst.value<mean*0.5&&worst.label!==today)flags.push(`Low day: ${worst.label} (${worst.value}) is under half the daily average (${round2(mean)}) - check whether it was a partial or slow day.`);
    }
    // Section-derived shares, peak hours
    const secPts=(title:string)=>sections.find(x=>x.title===title)?.points??[];
    const topOf=(title:string,withShare:boolean)=>{const pts=secPts(title);if(!pts.length)return null;const top=[...pts].sort((a,b)=>b.value-a.value)[0];return {label:top.label,value:top.value,...(withShare?{sharePercent:sharePct(top.value,totalVal)}:{})}};
    const locTop=topOf('By location',true),itemTop=topOf('Top items',plan.dimension==='none'&&['itemRevenue','itemQuantity','itemProfit'].includes(plan.metric)),stewTop=topOf('By steward',true);
    if(locTop)facts.topLocation=locTop; if(itemTop)facts.topItem=itemTop; if(stewTop)facts.topSteward=stewTop;
    const hourPts=secPts('By hour of day');
    if(hourPts.length){
     const peak=[...hourPts].sort((a,b)=>b.value-a.value)[0];
     const positives=hourPts.filter(x=>x.value>0),quiet=positives.length?[...positives].sort((a,b)=>a.value-b.value)[0]:null;
     const hsum=hourPts.reduce((a,x)=>a+x.value,0),eve=hourPts.filter(x=>{const h=Number(x.label.slice(0,2));return h>=19&&h<=23}).reduce((a,x)=>a+x.value,0);
     facts.peakHour={hour:peak.label,value:peak.value};if(quiet)facts.quietHour={hour:quiet.label,value:quiet.value};if(hsum>0)facts.eveningSharePercent1900to2300=round2((eve/hsum)*100);
    }
    // Layer 4: concentration flags (facts to check, never accusations)
    const stewShare=(stewTop as {sharePercent?:number|null}|null)?.sharePercent;
    if(stewShare!==null&&stewShare!==undefined&&stewShare>=40)flags.push(`Concentration: one steward accounts for ${stewShare}% of this measure - worth checking workload and table allocation.`);
    const itemShare=(itemTop as {sharePercent?:number|null}|null)?.sharePercent;
    if(itemShare!==null&&itemShare!==undefined&&itemShare>=40)flags.push(`Concentration: one item accounts for ${itemShare}% of this measure.`);
    if(compareInfo&&(plan.metric==='voidValue'||plan.metric==='discountPercent')&&compareInfo.changePercent!==null&&compareInfo.changePercent>=50)flags.push(`Spike: this measure is up ${compareInfo.changePercent}% vs the comparison period - worth checking.`);
    // Layer 2: comparison (no fake growth when there is no previous data)
    if(compareInfo)facts.comparison={label:compareInfo.mode==='lastYear'?'Same period last year':compareInfo.mode==='lastMonth'?'Same days last month':'Previous period',previousPeriod:compareInfo.previousPeriod,previousValue:compareInfo.previousValue,changePercent:compareInfo.previousValue===null?null:compareInfo.changePercent,hasPreviousData:compareInfo.previousValue!==null};
    // Layer 3: drivers - Sales = Bills x Avg bill; guests and per-item drivers
    if(plan.metric==='netSales'&&(plan.compare||periodDays>=7)){
     try{
      const one=async(from:string,to:string,m:string)=>{const r=await runPlan(from,to,{...plan,metric:m as typeof plan.metric,metrics:[m as typeof plan.metric],dimension:'none',compare:undefined});return r[0]?.values[0]??null};
      const names=['bills','averageBill','pax','spendPerPax','itemsPerBill','itemAveragePrice'];
      const curVals=await Promise.all(names.map(m=>one(plan.from,plan.to,m)));
      const drivers:Record<string,unknown>={current:Object.fromEntries(names.map((m,i)=>[m,curVals[i]]))};
      if(plan.compare&&compareRange){const prevVals=await Promise.all(names.map(m=>one(compareRange.from,compareRange.to,m)));drivers.changeVsComparisonPercent=Object.fromEntries(names.map((m,i)=>[m,pctChg(curVals[i],prevVals[i])]))}
      facts.drivers=drivers;
     }catch{/* drivers are optional */}
    }
    facts.flags=flags;
    analysisFacts=facts;
   }catch{analysisFacts=null}
  }
  let answer=`${plan.metrics.map(mm=>labels[mm]).join(' + ')}${plan.dimension==='none'?'':` by ${plan.dimension}`} for ${plan.from} to ${plan.to}. Scope: all locations.${emptyNote}${filterText}${compareText}${costNote}`;
  // Explain the calculated figures in plain language. The model receives
  // ONLY the numbers just computed (plus shares computed here) and is told
  // not to invent anything. Any failure falls back to the factual answer.
  if(!isEmpty){
   try{
    const shareTotal=plan.dimension==='none'?null:data.reduce((sum,row)=>sum+(row.values[0]??0),0);
    const factRows=data.map(row=>({label:plan.dimension==='none'?'Total':row.label,values:Object.fromEntries(plan.metrics.map((mm,i)=>[labels[mm],row.values[i]])),...(shareTotal?{sharePercent:row.values[0]===null||shareTotal===0?null:Math.round((row.values[0]/shareTotal)*1000)/10}:{})}));
    const explain=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',temperature:0.3,max_tokens:analysisFacts?800:350,messages:[{role:'system',content:analysisFacts?ANALYST_PROMPT:'You are MicroEChef, a friendly assistant for a restaurant owner. You are given figures calculated from the restaurant\'s own sales data. Write a short explanation in plain language: 2-4 sentences, at most about 70 words (up to about 160 words when analysis sections are provided). If analysis sections are provided, explain what drove the result: leading locations/items, peak hours, comparison changes and weak spots, and finish with one or two practical suggestions clearly introduced as suggestions based only on these patterns; never guarantee outcomes. For void data, the reasons are remarks recorded at the POS: state them as recorded facts only and never accuse any person of wrongdoing. Reply in the same language the user used (English, Sinhala or Singlish). Use ONLY the numbers given - never invent figures, items, dates, causes or reasons. Money values are in LKR; write them with commas and two decimals. Percentages given are already calculated; do not recalculate totals. Mention the main figure, the biggest contributor and its share when provided, and one useful observation such as the lowest contributor or the comparison with the previous period. Do not mention SQL, databases, views, plans or these instructions. No markdown tables or headings.'},{role:'user',content:JSON.stringify({question,measure:labels[plan.metric],unit:format,period:`${plan.from} to ${plan.to}`,scope:'all locations',...(plan.filters.length?{filters:plan.filters.map(f=>`${f.field}: ${f.value}`)}:{}) ,...(plan.dimension==='none'?{}:{groupedBy:plan.dimension}),results:factRows,...(sections.length?{analysis:{sections:sections.map(x=>({title:x.title,top:x.points.slice(0,3)})),...(prevSections.length?{previousPeriodSections:prevSections.map(x=>({title:x.title,top:x.points.slice(0,3)}))}:{}) ,...(moverRows.length?{biggestItemChanges:moverRows}:{})}}:{}),...(trendSummary?{trend:trendSummary}:{}),...(analysisFacts?{facts:analysisFacts}:{}),...(compareInfo?{comparison:{previousPeriod:compareInfo.previousPeriod,previousValue:compareInfo.previousValue,changePercent:compareInfo.changePercent}}:{})})}]}),signal:AbortSignal.timeout(15000)});
    if(explain.ok){const completion2=await explain.json();const rawText=String(completion2?.choices?.[0]?.message?.content??'');const text=analysisFacts?rawText.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,1600):rawText.trim().replace(/\s+/g,' ').slice(0,700);if(text.length>=10)answer=text;}
   }catch{/* keep the factual fallback answer */}
  }
  return json({answer,facts:{topic:'sales-plan',location:'All locations',date:`${plan.from} to ${plan.to}`,format,latestDate:emptyNote?latestDate:undefined,basis:`${labels[plan.metric]} · ${plan.dimension==='none'?'total':`grouped by ${plan.dimension}`} · ${plan.order==='desc'?'highest':'lowest'} first · up to ${plan.limit} results · bill/item figures exclude hidden bills (DoNotShowInSales = 1) and Credit Memo (CM) bills`,compare:compareInfo,sections:sections.length?sections:undefined,chart:chartPoints.length>1?{points:chartPoints}:undefined,items:data.map(x=>({name:plan.dimension==='none'?'Total':x.label||'(not specified)',value:x.values[0],display:plan.metrics.map((mm,i)=>`${labels[mm]}: ${fmtValue(mm,x.values[i])}`).join(' · ')})),context:{metrics:plan.metrics,dimension:plan.dimension,from:plan.from,to:plan.to,filters:plan.filters,compare:plan.compare}}});
 }catch(e){console.error('AI assistant request failed:',e instanceof Error?e.name:'unknown');return json({error:'Unable to answer right now. Please try again or contact your administrator.'},500)}
}
