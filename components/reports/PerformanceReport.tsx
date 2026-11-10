'use client';
import ReportEmptyState from './ReportEmptyState';
import {Document,Page,Text,View,StyleSheet} from '@react-pdf/renderer';
export interface PerformanceReportRow {description:string;value:string;amount:string;heading:boolean;sortingOrder:number|null}
export interface PerformanceReportData {date:string;location:string;locationName:string;locations:{code:string;name:string}[];rows:PerformanceReportRow[]}
export function filterPerformanceReport(d:PerformanceReportData,search:string):PerformanceReportData {const q=search.trim().toLowerCase();if(!q)return d;return {...d,rows:d.rows.filter(r=>`${r.description} ${r.value} ${r.amount} ${r.sortingOrder??''}`.toLowerCase().includes(q))}}
const totalRow=(r:PerformanceReportRow)=>['MAIN GROUP TOTAL','FAMILY GROUP TOTAL'].includes(r.description.trim().toUpperCase());
// Suppress placeholder zeroes only on section headings and the User row.
const shownAmount=(r:PerformanceReportRow)=>{const raw=r.amount.trim();return (r.heading||r.description.trim().toLowerCase()==='user') && raw!=='' && Number(raw)===0?'':r.amount};
const td={padding:'8px 12px',borderBottom:'1px solid #eee3d7',whiteSpace:'pre-wrap',overflowWrap:'anywhere'} as const;
export default function PerformanceReport({report}:{report:PerformanceReportData}) {
 if(!report.rows.length)return <ReportEmptyState>No saved performance data for {report.date} at location {report.locationName}.</ReportEmptyState>;
 return <div style={{border:'1px solid #e4d6bf',borderRadius:10,overflow:'hidden',margin:'16px 24px'}}><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:520,fontSize:12}}><tbody>{report.rows.map((r,i)=><tr key={i} style={{background:totalRow(r)?'#f5df9f':r.heading?'#f0e8d8':i%2?'#fcf8f2':'white',fontWeight:r.heading||totalRow(r)?700:400}}><td style={{...td,width:'50%'}}>{r.description||' '}</td><td style={{...td,width:'25%'}}>{r.value}</td><td style={{...td,width:'25%',textAlign:'right'}}>{shownAmount(r)}</td></tr>)}</tbody></table></div></div>
}
const s=StyleSheet.create({page:{padding:28,fontSize:9,color:'#45301d'},title:{textAlign:'center',fontSize:14,fontFamily:'Helvetica-Bold',marginBottom:8},row:{flexDirection:'row',padding:5,borderBottomWidth:.3,borderBottomColor:'#eee3d7'},section:{backgroundColor:'#f0e8d8',fontFamily:'Helvetica-Bold'},total:{backgroundColor:'#f5df9f',fontFamily:'Helvetica-Bold'}});
export function PerformancePdfDocument({data}:{data:PerformanceReportData}){return <Document><Page size="A4" style={s.page}><Text style={s.title}>Performance Report</Text>{data.rows.map((r,i)=><View key={i} style={totalRow(r)?[s.row,s.total]:r.heading?[s.row,s.section]:s.row}><Text style={{width:'50%'}}>{r.description||' '}</Text><Text style={{width:'25%'}}>{r.value}</Text><Text style={{width:'25%',textAlign:'right'}}>{shownAmount(r)}</Text></View>)}</Page></Document>}
