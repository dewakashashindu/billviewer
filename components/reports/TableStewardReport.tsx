"use client";
import { ReportPdfHeader, ReportPdfFooter } from './ReportPdfBrand';
import ReportEmptyState from './ReportEmptyState';
import {Document,Page,Text,View,StyleSheet} from '@react-pdf/renderer';
export type TableRow={date:string;tableNo:string;netTotal:number;pax:number};
export type Steward={id:string;name:string;rows:TableRow[]};
export type Location={code:string;name:string;stewards:Steward[]};
export type TableStewardData={locations:Location[]};
const fmt=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=(s:string)=>{const [y,m,d]=s.split('-');return y&&m&&d?`${d}/${m}/${y}`:s};
const sum=(rows:TableRow[])=>rows.reduce((a,r)=>({netTotal:a.netTotal+r.netTotal,pax:a.pax+r.pax}),{netTotal:0,pax:0});
const allRows=(l:Location)=>l.stewards.flatMap(s=>s.rows);
export function filterTableSteward(data:TableStewardData,selection:string,search:string):TableStewardData {
 const q=search.trim().toLowerCase();return {locations:data.locations.map(l=>({...l,stewards:l.stewards.filter(s=>selection==='all'||`s:${s.id}`===selection).map(s=>({...s,rows:s.rows.filter(r=>!q||`${l.code} ${l.name} ${s.id} ${s.name} ${r.date} ${date(r.date)} ${r.tableNo}`.toLowerCase().includes(q))})).filter(s=>s.rows.length)})).filter(l=>l.stewards.length)};
}
const bar={background:'#e4d6bf',color:'#684830',fontWeight:700,padding:'8px 10px',marginTop:12,borderRadius:5};
const cell={padding:'7px 9px',borderBottom:'1px solid #eee2d5'};
export function TableStewardReport({data}:{data:TableStewardData}){
 if(!data.locations.length)return <ReportEmptyState>No dining table records found for this range.</ReportEmptyState>;
 return <div>{data.locations.map(l=><section key={l.code}><div style={bar}>{l.code} — {l.name}</div>{l.stewards.map((s,i)=>{const total=sum(s.rows);return <div key={i}><div style={{...bar,background:'#f0e8d8'}}>{s.id||'Unassigned'}{s.name?` — ${s.name}`:''}</div><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Date','Table No','Net Total','No Of Pax'].map((h,j)=><th key={h} style={{...cell,background:'#f0e8d8',textAlign:j<2?'left':'right'}}>{h}</th>)}</tr></thead><tbody>{s.rows.map((r,j)=><tr key={j}>{[date(r.date),r.tableNo,fmt(r.netTotal),fmt(r.pax)].map((v,k)=><td key={k} style={{...cell,textAlign:k<2?'left':'right'}}>{v}</td>)}</tr>)}<tr style={{fontWeight:700}}><td colSpan={2} style={cell}>Steward Total</td><td style={{...cell,textAlign:'right'}}>{fmt(total.netTotal)}</td><td style={{...cell,textAlign:'right'}}>{fmt(total.pax)}</td></tr></tbody></table></div></div>})}{(()=>{const t=sum(allRows(l));return <div style={{textAlign:'right',padding:10,fontWeight:800}}>Locational Total: {fmt(t.netTotal)} &nbsp; · &nbsp; Pax: {fmt(t.pax)}</div>})()}</section>)}</div>;
}
const p=StyleSheet.create({page:{padding:28,fontSize:9,fontFamily:'Helvetica',color:'#45301d'},title:{textAlign:'center',fontSize:14,fontFamily:'Helvetica-Bold',marginBottom:8},group:{backgroundColor:'#e4d6bf',padding:5,marginTop:10,fontFamily:'Helvetica-Bold'},steward:{backgroundColor:'#f0e8d8',padding:5,marginTop:5,fontFamily:'Helvetica-Bold'},row:{flexDirection:'row'},head:{backgroundColor:'#f0e8d8',padding:5,fontFamily:'Helvetica-Bold'},cell:{padding:5,borderBottomWidth:.3,borderBottomColor:'#e4d6bf'},total:{fontFamily:'Helvetica-Bold',borderTopWidth:1,borderTopColor:'#684830'},right:{textAlign:'right'}});
const widths=[120,160,130,120];
function PdfTotal({label,rows}:{label:string;rows:TableRow[]}){const t=sum(rows);return <View style={[p.row,p.total]}><Text style={[p.cell,{width:280}]}>{label}</Text><Text style={[p.cell,p.right,{width:130}]}>{fmt(t.netTotal)}</Text><Text style={[p.cell,p.right,{width:120}]}>{fmt(t.pax)}</Text></View>}
export function TableStewardPdf({data,title,from,to,printDate,printTime}:{data:TableStewardData;title:string;from:string;to:string;printDate:string;printTime:string}){
 return <Document><Page size="A4" style={[p.page, {paddingBottom: 45}]}><ReportPdfHeader title={title}/><Text>From {from} To {to}</Text><Text>Printed {printDate} {printTime}</Text>{data.locations.map(l=><View key={l.code}><Text style={p.group}>{l.code} — {l.name}</Text>{l.stewards.map((s,i)=><View key={i}><Text style={p.steward}>{s.id||'Unassigned'} {s.name}</Text><View style={p.row}>{['Date','Table No','Net Total','No Of Pax'].map((h,j)=><Text key={h} style={[p.head,{width:widths[j]},...(j>1?[p.right]:[])]}>{h}</Text>)}</View>{s.rows.map((r,j)=><View style={p.row} key={j} wrap={false}>{[date(r.date),r.tableNo,fmt(r.netTotal),fmt(r.pax)].map((v,k)=><Text key={k} style={[p.cell,{width:widths[k]},...(k>1?[p.right]:[])]}>{v}</Text>)}</View>)}<PdfTotal label="Steward Total" rows={s.rows}/></View>)}<PdfTotal label="Locational Total" rows={allRows(l)}/></View>)}<ReportPdfFooter/></Page></Document>;
}
