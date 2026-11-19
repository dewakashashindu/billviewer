"use client";
import { ReportPdfHeader, ReportPdfFooter } from './ReportPdfBrand';
import {useEffect,useMemo,useRef,useState} from 'react';
import ReportEmptyState from './ReportEmptyState';
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface MiiRow { code: string; desc: string; qty: number; weight: number; unitValue: number; lastPrice: number; total: number; costPrice?: number; costTotal?: number }
export interface MiiDept { dept: string; rows: MiiRow[]; total: number }
export interface MiiDate { date: string; depts: MiiDept[]; total: number }
export interface MiiLocation { locCode: string; locName: string; dates: MiiDate[]; locTotal: number }
export interface MiiData { locationGroups: MiiLocation[]; grandTotal: number; departments?: {code:string;name:string}[] }
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
  return {...d,locationGroups, grandTotal: locationGroups.reduce((n,l) => n + l.locTotal,0)};
}
export type MiiSort = 'description' | 'quantity';
function pivot(l: MiiLocation, sort:MiiSort='description') {
  const dates = l.dates.map(d => d.date).sort();
  const map = new Map<string, {code:string; desc:string; values:Record<string,number>; total:number}>();
  for (const d of l.dates) for (const dep of d.depts) for (const r of dep.rows) {
    const key = JSON.stringify([r.code,r.desc]); let item = map.get(key);
    if (!item) {item = {code:r.code, desc:r.desc, values:{}, total:0}; map.set(key,item);}
    item.values[d.date] = (item.values[d.date] || 0) + r.qty; item.total += r.qty;
  }
  return {dates, rows:Array.from(map.values()).sort((a,b)=>(sort==='quantity' ? b.total-a.total : 0) || a.desc.localeCompare(b.desc,undefined,{sensitivity:'base',numeric:true}) || a.code.localeCompare(b.code,undefined,{numeric:true}))};
}
const th: React.CSSProperties = {padding:"7px 9px", textAlign:"left", background:"#e4d6bf", whiteSpace:"nowrap"};
const td: React.CSSProperties = {padding:"7px 9px", borderBottom:"1px solid #eee2d5"};
const group: React.CSSProperties = {background:"#f0e8d8", padding:"9px 12px", marginTop:16, fontWeight:700, borderRadius:7};
// Consolidate the same item across different sales/cost prices for quantity display.
function quantityItems(dep:MiiDept){const m=new Map<string,{code:string;desc:string;qty:number;costTotal:number}>();for(const r of dep.rows){const key=JSON.stringify([r.code,r.desc]);let it=m.get(key);if(!it){it={code:r.code,desc:r.desc,qty:0,costTotal:0};m.set(key,it)}it.qty+=r.qty;it.costTotal+=r.costTotal??0}return [...m.values()].sort((a,b)=>a.code.localeCompare(b.code))}
const average=(qty:number,days:number)=>days>0?(Math.round((qty/days)*100)/100).toFixed(4):'—';
export default function MenuItemIssueReport({report,withCost=false,days}:{report:MiiData;withCost?:boolean;days:number}) {
  if (!report.locationGroups.length) return <ReportEmptyState>No menu item issues for this range.</ReportEmptyState>;
  return <div>{report.locationGroups.map(l=><div key={l.locCode}><div style={group}>{l.locName}</div>{l.dates.flatMap(d=>d.depts).map((dep,di)=><section key={di}><div style={group}>{dep.dept}</div><div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:600,borderCollapse:"collapse"}}><thead><tr>{["Menu Item ID","Description","Qty",`Average Qty For ${days} Day/s`,...(withCost?["Cost of Sales"]:[])].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{quantityItems(dep).map((r,i)=><tr key={i}>{[r.code,r.desc,fmt(r.qty),average(r.qty,days),...(withCost?[fmt(r.costTotal)]:[])].map((v,j)=><td key={j} style={td}>{v}</td>)}</tr>)}</tbody></table></div></section>)}</div>)}{days===0&&<p style={{padding:12,color:'#806b56'}}>Average is unavailable when the date range is zero days.</p>}</div>;
}
type PageSize = '50' | '100' | '150' | 'all';
const controlSelect:React.CSSProperties={background:'#fff',border:'1px solid #cbb49a',borderRadius:8,color:'#45301d',padding:'9px 32px 9px 11px',fontWeight:700,minWidth:160,cursor:'pointer'};
const navButton:React.CSSProperties={background:'#fff',border:'1px solid #cbb49a',borderRadius:8,color:'#684830',padding:'8px 13px',fontWeight:700,cursor:'pointer'};

function DateLocation({location,sort,pageSize}:{location:MiiLocation;sort:MiiSort;pageSize:PageSize}) {
 const pivoted=useMemo(()=>pivot(location,sort),[location,sort]);
 const [page,setPage]=useState(1);
 const scroller=useRef<HTMLDivElement>(null),top=useRef<HTMLDivElement>(null),table=useRef<HTMLTableElement>(null);
 const [width,setWidth]=useState(0);
 useEffect(()=>{setPage(1)},[location,sort,pageSize]);
 useEffect(()=>{const resize=()=>setWidth(table.current?.scrollWidth||0);resize();const ro=new ResizeObserver(resize);if(table.current)ro.observe(table.current);if(scroller.current)ro.observe(scroller.current);window.addEventListener('resize',resize);return()=>{ro.disconnect();window.removeEventListener('resize',resize)}},[pivoted,page,pageSize]);
 const count=pivoted.rows.length, size=pageSize==='all'?Math.max(count,1):Number(pageSize),pages=Math.max(1,Math.ceil(count/size)),safePage=Math.min(page,pages),visible=pivoted.rows.slice((safePage-1)*size,safePage*size);
 const moveTop=()=>{if(scroller.current&&top.current&&scroller.current.scrollLeft!==top.current.scrollLeft)scroller.current.scrollLeft=top.current.scrollLeft};
 const moveTable=()=>{if(scroller.current&&top.current&&top.current.scrollLeft!==scroller.current.scrollLeft)top.current.scrollLeft=scroller.current.scrollLeft};
 const pagination=<div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',padding:'10px 12px',flexWrap:'wrap',background:'#f9f3eb',border:'1px solid #e4d6bf',borderRadius:9}}><span style={{color:'#684830',fontWeight:700}}>{count?`Showing ${(safePage-1)*size+1}–${Math.min(safePage*size,count)} of ${count} items`:'No items'}</span><div style={{display:'flex',alignItems:'center',gap:8}}><button style={{...navButton,opacity:safePage<=1?.45:1,cursor:safePage<=1?'not-allowed':'pointer'}} type="button" disabled={safePage<=1} onClick={()=>setPage(safePage-1)}>‹ Previous</button><span style={{background:'#684830',color:'#fff',borderRadius:8,padding:'8px 12px',fontWeight:700}}>Page {safePage} / {pages}</span><button style={{...navButton,opacity:safePage>=pages?.45:1,cursor:safePage>=pages?'not-allowed':'pointer'}} type="button" disabled={safePage>=pages} onClick={()=>setPage(safePage+1)}>Next ›</button></div></div>;
 return <section><div style={{...group,marginBottom:8}}>{location.locCode} — {location.locName} · quantities</div>{pagination}<div ref={top} onScroll={moveTop} role="region" aria-label={`Scroll dates horizontally for ${location.locName}`} tabIndex={0} style={{overflowX:'auto',overflowY:'hidden',position:'sticky',top:0,zIndex:4,background:'#f8f2e9',height:18}}><div style={{width,height:1}}/></div><div ref={scroller} onScroll={moveTable} style={{overflowX:'auto'}}><table ref={table} style={{borderCollapse:'collapse',minWidth:'100%'}}><thead><tr>{['Item Code','Description',...pivoted.dates,'Total Qty'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{visible.map((r,i)=><tr key={`${r.code}-${r.desc}-${i}`}>{[r.code,r.desc,...pivoted.dates.map(d=>fmt(r.values[d]||0)),fmt(r.total)].map((v,j)=><td key={j} style={td}>{v}</td>)}</tr>)}</tbody></table></div><div style={{marginTop:8}}>{pagination}</div></section>;
}
export function MenuItemIssueByDateReport({report,sort,onSortChange}:{report:MiiData;sort:MiiSort;onSortChange:(sort:MiiSort)=>void}) {
 const [pageSize,setPageSize]=useState<PageSize>('50');
 if (!report.locationGroups.length) return <ReportEmptyState>No menu item issues for this range.</ReportEmptyState>;
 return <div><div style={{margin:'12px 0 16px',padding:'14px 16px',display:'flex',gap:18,alignItems:'end',flexWrap:'wrap',background:'#fff',border:'1px solid #e4d6bf',borderLeft:'4px solid #684830',borderRadius:10,boxShadow:'0 2px 8px rgba(69,48,29,.06)'}}><div style={{marginRight:8}}><strong style={{display:'block',color:'#45301d'}}>REPORT OPTIONS</strong><span style={{display:'block',marginTop:4,color:'#907860'}}>Choose sorting and page size</span></div><label style={{display:'grid',gap:5,color:'#684830',fontWeight:700}}>Order by<select style={controlSelect} aria-label="Order by" value={sort} onChange={e=>onSortChange(e.target.value as MiiSort)}><option value="description">Description (A–Z)</option><option value="quantity">Total Qty (highest first)</option></select></label><label style={{display:'grid',gap:5,color:'#684830',fontWeight:700}}>Rows per page<select style={controlSelect} aria-label="Rows per page" value={pageSize} onChange={e=>setPageSize(e.target.value as PageSize)}><option value="50">50 rows</option><option value="100">100 rows</option><option value="150">150 rows</option><option value="all">All rows</option></select></label></div>{report.locationGroups.map(l=><DateLocation key={l.locCode} location={l} sort={sort} pageSize={pageSize}/>)}</div>;
}
const ps=StyleSheet.create({page:{padding:24,fontSize:8,fontFamily:"Helvetica",color:"#45301D"},title:{fontSize:14,fontFamily:"Helvetica-Bold",marginBottom:8},loc:{fontSize:10,fontFamily:"Helvetica-Bold",marginTop:12,marginBottom:5},row:{flexDirection:"row"},head:{backgroundColor:"#e4d6bf",padding:4,fontFamily:"Helvetica-Bold"},cell:{padding:4,borderBottomWidth:.4,borderBottomColor:"#ddd"}});
export function MenuItemIssuePdfDocument({title,printDate,printTime,from,to,data,byDate=false,withCost=false,days=0,sort='description'}:{title:string;printDate:string;printTime:string;from:string;to:string;data:MiiData;byDate?:boolean;withCost?:boolean;days?:number;sort?:MiiSort}) {
  return <Document><Page size="A4" orientation="landscape" style={[ps.page, {paddingBottom: 45}]}><ReportPdfHeader title={title}/><Text>From {from} To {to} · Printed {printDate} {printTime}</Text>{data.locationGroups.map(l=><View key={l.locCode}><Text style={ps.loc}>{l.locCode} — {l.locName}</Text>{byDate ? (()=>{const p=pivot(l,sort); const chunks:string[][]=[]; for(let i=0;i<p.dates.length;i+=6) chunks.push(p.dates.slice(i,i+6)); return chunks.map((dates,idx)=><View key={idx}><View style={ps.row}>{["Code","Description",...dates,"Total Qty"].map((h,j)=><Text key={j} style={[ps.head,{width:j===0?65:j===1?180:70}]}>{h}</Text>)}</View>{p.rows.map((r,i)=><View style={ps.row} key={i}>{[r.code,r.desc,...dates.map(d=>fmt(r.values[d]||0)),fmt(r.total)].map((v,j)=><Text key={j} style={[ps.cell,{width:j===0?65:j===1?180:70}]}>{v}</Text>)}</View>)}</View>);})() : <>{l.dates.flatMap(d=>d.depts).map((dep,di)=><View key={di}><Text style={ps.loc}>{dep.dept}</Text><View style={ps.row}>{["Menu Item ID","Description","Qty",`Average Qty (${days} days)`,...(withCost?["Cost of Sales"]:[])].map((h,j)=><Text key={j} style={[ps.head,{width:j===0?80:j===1?240:110}]}>{h}</Text>)}</View>{quantityItems(dep).map((r,i)=><View style={ps.row} key={i}>{[r.code,r.desc,fmt(r.qty),average(r.qty,days),...(withCost?[fmt(r.costTotal)]:[])].map((v,j)=><Text key={j} style={[ps.cell,{width:j===0?80:j===1?240:110}]}>{v}</Text>)}</View>)}</View>)}{days===0&&<Text>Average unavailable for a zero-day range.</Text>}</>}</View>)}<ReportPdfFooter/></Page></Document>;
}
