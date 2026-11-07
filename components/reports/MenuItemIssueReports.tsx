"use client";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface MiiRow { code: string; desc: string; qty: number; weight: number; unitValue: number; lastPrice: number; total: number; costPrice?: number; costTotal?: number }
export interface MiiDept { dept: string; rows: MiiRow[]; total: number }
export interface MiiDate { date: string; depts: MiiDept[]; total: number }
export interface MiiLocation { locCode: string; locName: string; dates: MiiDate[]; locTotal: number }
export interface MiiData { locationGroups: MiiLocation[]; grandTotal: number }
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function miiToRows(d: MiiData) { return d.locationGroups.flatMap(l => l.dates.flatMap(dt => dt.depts.flatMap(dep => dep.rows.map(r => ({date: dt.date, billNo: r.code, desc: r.desc, value: r.total, loc: l.locName}))))); }
export function filterMii(d: MiiData, q0: string): MiiData {
  const q = q0.trim().toLowerCase(); if (!q) return d;
  const locationGroups = d.locationGroups.map(l => {
    const dates = l.dates.map(dt => {
      const depts = dt.depts.map(dep => {
        const rows = dep.rows.filter(r => `${r.code} ${r.desc} ${dep.dept} ${dt.date} ${l.locCode} ${l.locName}`.toLowerCase().includes(q));
        return {...dep, rows, total: rows.reduce((n,r) => n + r.total,0)};
      }).filter(dep => dep.rows.length);
      return {...dt, depts, total: depts.reduce((n,dep) => n + dep.total,0)};
    }).filter(dt => dt.depts.length);
    return {...l, dates, locTotal: dates.reduce((n,dt) => n + dt.total,0)};
  }).filter(l => l.dates.length);
  return {locationGroups, grandTotal: locationGroups.reduce((n,l) => n + l.locTotal,0)};
}
function pivot(l: MiiLocation) {
  const dates = l.dates.map(d => d.date).sort();
  const map = new Map<string, {code:string; desc:string; values:Record<string,number>; total:number}>();
  for (const d of l.dates) for (const dep of d.depts) for (const r of dep.rows) {
    const key = JSON.stringify([r.code,r.desc]); let item = map.get(key);
    if (!item) {item = {code:r.code, desc:r.desc, values:{}, total:0}; map.set(key,item);}
    item.values[d.date] = (item.values[d.date] || 0) + r.qty; item.total += r.qty;
  }
  return {dates, rows:Array.from(map.values()).sort((a,b)=>a.code.localeCompare(b.code))};
}
const th: React.CSSProperties = {padding:"7px 9px", textAlign:"left", background:"#e4d6bf", whiteSpace:"nowrap"};
const td: React.CSSProperties = {padding:"7px 9px", borderBottom:"1px solid #eee2d5"};
const group: React.CSSProperties = {background:"#f0e8d8", padding:"9px 12px", marginTop:16, fontWeight:700, borderRadius:7};
export default function MenuItemIssueReport({report,withCost=false}:{report:MiiData;withCost?:boolean}) {
  if (!report.locationGroups.length) return <p>No menu item issues for this range.</p>;
  return <div>{report.locationGroups.map(l=><div key={l.locCode}><div style={group}>{l.locCode} — {l.locName}</div><div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:withCost?800:600,borderCollapse:"collapse"}}><thead><tr>{["Item Code","Description","Qty","Sales Price","Sales Value",...(withCost?["Cost Price","Cost of Sales"]:[])].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{l.dates.flatMap(d=>d.depts.flatMap(dep=>dep.rows)).map((r,i)=><tr key={i}>{[r.code,r.desc,fmt(r.qty),fmt(r.unitValue),fmt(r.total),...(withCost?[fmt(r.costPrice??0),fmt(r.costTotal??0)]:[])].map((v,j)=><td key={j} style={td}>{v}</td>)}</tr>)}</tbody></table></div><div style={group}>Sales Total: {fmt(l.locTotal)}</div></div>)}<div style={group}>Grand Total: {fmt(report.grandTotal)}</div></div>;
}
export function MenuItemIssueByDateReport({report}:{report:MiiData}) {
  if (!report.locationGroups.length) return <p>No menu item issues for this range.</p>;
  return <div>{report.locationGroups.map(l=>{const p=pivot(l);return <div key={l.locCode}><div style={group}>{l.locCode} — {l.locName} · quantities</div><div style={{overflowX:"auto"}}><table style={{borderCollapse:"collapse",minWidth:"100%"}}><thead><tr>{["Item Code","Description",...p.dates,"Total Qty"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{p.rows.map((r,i)=><tr key={i}>{[r.code,r.desc,...p.dates.map(d=>fmt(r.values[d]||0)),fmt(r.total)].map((v,j)=><td key={j} style={td}>{v}</td>)}</tr>)}</tbody></table></div></div>})}</div>;
}
const ps=StyleSheet.create({page:{padding:24,fontSize:8,fontFamily:"Helvetica",color:"#45301D"},title:{fontSize:14,fontFamily:"Helvetica-Bold",marginBottom:8},loc:{fontSize:10,fontFamily:"Helvetica-Bold",marginTop:12,marginBottom:5},row:{flexDirection:"row"},head:{backgroundColor:"#e4d6bf",padding:4,fontFamily:"Helvetica-Bold"},cell:{padding:4,borderBottomWidth:.4,borderBottomColor:"#ddd"}});
export function MenuItemIssuePdfDocument({title,printDate,printTime,from,to,data,byDate=false,withCost=false}:{title:string;printDate:string;printTime:string;from:string;to:string;data:MiiData;byDate?:boolean;withCost?:boolean}) {
  return <Document><Page size="A4" orientation="landscape" style={ps.page}><Text style={ps.title}>{title}</Text><Text>From {from} To {to} · Printed {printDate} {printTime}</Text>{data.locationGroups.map(l=><View key={l.locCode}><Text style={ps.loc}>{l.locCode} — {l.locName}</Text>{byDate ? (()=>{const p=pivot(l); const chunks:string[][]=[]; for(let i=0;i<p.dates.length;i+=6) chunks.push(p.dates.slice(i,i+6)); return chunks.map((dates,idx)=><View key={idx}><View style={ps.row}>{["Code","Description",...dates,"Total Qty"].map((h,j)=><Text key={j} style={[ps.head,{width:j===0?65:j===1?180:70}]}>{h}</Text>)}</View>{p.rows.map((r,i)=><View style={ps.row} key={i}>{[r.code,r.desc,...dates.map(d=>fmt(r.values[d]||0)),fmt(r.total)].map((v,j)=><Text key={j} style={[ps.cell,{width:j===0?65:j===1?180:70}]}>{v}</Text>)}</View>)}</View>);})() : <><View style={ps.row}>{["Code","Description","Qty","Sales Price","Sales Value",...(withCost?["Cost Price","Cost of Sales"]:[])].map((h,j)=><Text key={j} style={[ps.head,{width:j===0?65:j===1?180:75}]}>{h}</Text>)}</View>{l.dates.flatMap(d=>d.depts.flatMap(dep=>dep.rows)).map((r,i)=><View style={ps.row} key={i}>{[r.code,r.desc,fmt(r.qty),fmt(r.unitValue),fmt(r.total),...(withCost?[fmt(r.costPrice??0),fmt(r.costTotal??0)]:[])].map((v,j)=><Text key={j} style={[ps.cell,{width:j===0?65:j===1?180:75}]}>{v}</Text>)}</View>)}<Text style={ps.loc}>Sales Total: {fmt(l.locTotal)}</Text></>}</View>)}{!byDate && <Text style={ps.loc}>Grand Total: {fmt(data.grandTotal)}</Text>}</Page></Document>;
}
