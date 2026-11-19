"use client";
import { ReportPdfHeader, ReportPdfFooter } from './ReportPdfBrand';
import ReportEmptyState from './ReportEmptyState';
import {Document,Page,Text,View,StyleSheet} from '@react-pdf/renderer';
export type CostItem={id:string;name:string;qty:number;costPrice:number;itemCost:number};
export type CostBill={billNo:string;items:CostItem[]};
export type CostDay={date:string;bills:CostBill[]};
export type CostLocation={locCode:string;locName:string;days:CostDay[]};
export type ComplimentaryCostData={locations:CostLocation[]};
const money=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const billTotal=(b:CostBill)=>b.items.reduce((n,i)=>n+i.itemCost,0);
const dayTotal=(d:CostDay)=>d.bills.reduce((n,b)=>n+billTotal(b),0);
const locationTotal=(l:CostLocation)=>l.days.reduce((n,d)=>n+dayTotal(d),0);
const dateLabel=(d:string)=>{const p=d.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d};
export function filterComplimentaryCost(data:ComplimentaryCostData,search:string):ComplimentaryCostData {
 const q=search.trim().toLowerCase();if(!q)return data;
 return {locations:data.locations.map(l=>({...l,days:l.days.map(d=>({...d,bills:d.bills.filter(b=>`${l.locCode} ${l.locName} ${d.date} ${dateLabel(d.date)} ${b.billNo} ${b.items.map(i=>`${i.id} ${i.name}`).join(' ')}`.toLowerCase().includes(q))})).filter(d=>d.bills.length)})).filter(l=>l.days.length)};
}
const section={background:'#e4d6bf',color:'#684830',padding:'8px 10px',fontWeight:700,marginTop:12,borderRadius:5};
const cell={padding:'6px 8px',borderBottom:'1px solid #eee2d5'};
export function ComplimentaryCostReport({data}:{data:ComplimentaryCostData}){
 if(!data.locations.length)return <ReportEmptyState>No complimentary items found for this range.</ReportEmptyState>;
 return <div>{data.locations.map(l=><div key={l.locCode}><div style={section}>{l.locCode} — {l.locName}</div>{l.days.map(d=><div key={d.date}><div style={{...section,background:'#f0e8d8'}}>{dateLabel(d.date)}</div>{d.bills.map((b,i)=><div key={i}><div style={{padding:'8px',fontWeight:700}}>Bill No: {b.billNo||'—'}</div><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr style={{background:'#f0e8d8'}}>{['Menu ID','Menu Items','Qty','Cost Price','Item Cost'].map((h,j)=><th key={h} style={{...cell,textAlign:j<2?'left':'right'}}>{h}</th>)}</tr></thead><tbody>{b.items.map((it,j)=><tr key={j}>{[it.id,it.name,money(it.qty),money(it.costPrice),money(it.itemCost)].map((v,k)=><td key={k} style={{...cell,textAlign:k<2?'left':'right'}}>{v}</td>)}</tr>)}</tbody></table></div><div style={{textAlign:'right',padding:8,fontWeight:700}}>Bill Wise Cost: {money(billTotal(b))}</div></div>)}<div style={{textAlign:'right',padding:8,fontWeight:700}}>Daily Cost: {money(dayTotal(d))}</div></div>)}<div style={{textAlign:'right',padding:8,fontWeight:800}}>Locational Cost: {money(locationTotal(l))}</div></div>)}</div>;
}
const p=StyleSheet.create({page:{padding:28,fontSize:9,fontFamily:'Helvetica',color:'#45301d'},title:{fontSize:14,fontFamily:'Helvetica-Bold',textAlign:'center',marginBottom:8},group:{backgroundColor:'#e4d6bf',padding:5,marginTop:8,fontFamily:'Helvetica-Bold'},bill:{padding:5,fontFamily:'Helvetica-Bold'},row:{flexDirection:'row'},head:{backgroundColor:'#f0e8d8',padding:4,fontFamily:'Helvetica-Bold'},cell:{padding:4,borderBottomWidth:.3,borderBottomColor:'#ddd'},right:{textAlign:'right'},total:{textAlign:'right',padding:5,fontFamily:'Helvetica-Bold'}});
const widths=[75,230,65,80,85];
export function ComplimentaryCostPdf({data,title,from,to,printDate,printTime}:{data:ComplimentaryCostData;title:string;from:string;to:string;printDate:string;printTime:string}){
 return <Document><Page size="A4" style={[p.page, {paddingBottom: 45}]}><ReportPdfHeader title={title}/><Text>From {from} To {to}</Text><Text>Printed {printDate} {printTime}</Text>{data.locations.map(l=><View key={l.locCode}><Text style={p.group}>{l.locCode} — {l.locName}</Text>{l.days.map(d=><View key={d.date}><Text style={p.group}>{dateLabel(d.date)}</Text>{d.bills.map((b,i)=><View key={i}><Text style={p.bill}>Bill No: {b.billNo||'-'}</Text><View style={p.row}>{['Menu ID','Menu Items','Qty','Cost Price','Item Cost'].map((h,j)=><Text key={j} style={[p.head,{width:widths[j]},...(j>1?[p.right]:[])]}>{h}</Text>)}</View>{b.items.map((it,j)=><View key={j} style={p.row}>{[it.id,it.name,money(it.qty),money(it.costPrice),money(it.itemCost)].map((v,k)=><Text key={k} style={[p.cell,{width:widths[k]},...(k>1?[p.right]:[])]}>{v}</Text>)}</View>)}<Text style={p.total}>Bill Wise Cost: {money(billTotal(b))}</Text></View>)}<Text style={p.total}>Daily Cost: {money(dayTotal(d))}</Text></View>)}<Text style={p.total}>Locational Cost: {money(locationTotal(l))}</Text></View>)}<ReportPdfFooter/></Page></Document>;
}
