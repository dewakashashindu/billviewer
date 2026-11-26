'use client';
import { ReportPdfHeader, ReportPdfFooter } from './ReportPdfBrand';
import ReportEmptyState from './ReportEmptyState';
import {Document,Page,Text,View,StyleSheet} from '@react-pdf/renderer';

export interface TxnLogRow {txn:string;remarks:string;time:string;workstation:string}
export interface TxnLogDay {date:string;rows:TxnLogRow[]}
export interface TxnLogUser {userId:string;userName:string;days:TxnLogDay[]}
export interface TxnLogLocation {locCode:string;locName:string;users:TxnLogUser[]}
export interface TxnLogData {locations:TxnLogLocation[];total:number;truncated?:boolean;users?:{id:string;name:string}[];types?:string[]}

const pretty=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:s;
export const txnTime12=(t:string)=>{const m=t.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);if(!m)return t;let h=Number(m[1]);const ap=h>=12?'PM':'AM';h=h%12||12;return `${h}:${m[2]}${m[3]?`:${m[3]}`:''} ${ap}`};

export function filterTxnLog(d:TxnLogData,q0:string):TxnLogData{
  const q=q0.trim().toLowerCase();if(!q)return d;
  const locations=d.locations.map(l=>({...l,users:l.users.map(u=>({...u,days:u.days.map(day=>({...day,rows:day.rows.filter(r=>`${l.locCode} ${l.locName} ${u.userId} ${u.userName} ${day.date} ${pretty(day.date)} ${r.txn} ${r.remarks} ${r.workstation}`.toLowerCase().includes(q))})).filter(day=>day.rows.length)})).filter(u=>u.days.length)})).filter(l=>l.users.length);
  const total=locations.reduce((n,l)=>n+l.users.reduce((m,u)=>m+u.days.reduce((x,day)=>x+day.rows.length,0),0),0);
  return {...d,locations,total};
}

const locBand={background:'#684830',color:'white',padding:'8px 12px',fontWeight:700} as const;
const userBand={background:'#eadfce',color:'#45301d',padding:'7px 12px',fontWeight:700} as const;
const dateBand={background:'#f8f2ea',color:'#684830',padding:'6px 12px',fontWeight:700,fontSize:12} as const;
const th={padding:'7px',textAlign:'left' as const,background:'#f0e8d8',whiteSpace:'nowrap' as const};
const td={padding:'7px',borderBottom:'1px solid #eee3d8',verticalAlign:'top' as const};

export default function TxnLogReport({report}:{report:TxnLogData}){
  if(!report.locations.length)return <ReportEmptyState>No transaction log records for this range.</ReportEmptyState>;
  return <div>
    {report.locations.map(l=><section key={l.locCode}>
      <div style={locBand}>{l.locCode} — {l.locName}</div>
      {l.users.map(u=><div key={u.userId||'(none)'}>
        <div style={userBand}>User: {u.userId||'—'}{u.userName&&u.userName!==u.userId?` · ${u.userName}`:''}</div>
        {u.days.map(d=><div key={d.date}>
          <div style={dateBand}>Date: {pretty(d.date)}</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',minWidth:900,borderCollapse:'collapse',fontSize:12}}>
              <thead><tr><th style={{...th,width:150}}>Txn Type</th><th style={th}>Txn Remarks</th><th style={{...th,width:110}}>Txn Time</th><th style={{...th,width:170}}>Work Station</th></tr></thead>
              <tbody>{d.rows.map((r,j)=><tr key={j} style={{background:j%2?'#fbf7f2':'white'}}>
                <td style={{...td,fontWeight:700,color:'#8a4d1c'}}>{r.txn}</td>
                <td style={{...td,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{r.remarks||'—'}</td>
                <td style={{...td,whiteSpace:'nowrap'}}>{txnTime12(r.time)}</td>
                <td style={{...td,whiteSpace:'nowrap'}}>{r.workstation}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>)}
      </div>)}
    </section>)}
    <div style={userBand}>Records: {report.total.toLocaleString('en-US')}{report.truncated?' (first 5,000 shown — narrow the date range or filters)':''}</div>
  </div>;
}

const s=StyleSheet.create({
  page:{padding:20,fontSize:7.5,color:'#45301d'},
  loc:{backgroundColor:'#e4d6bf',padding:6,marginTop:8,fontFamily:'Helvetica-Bold'},
  user:{backgroundColor:'#f0e8d8',padding:5,marginTop:5,fontFamily:'Helvetica-Bold'},
  date:{padding:5,fontFamily:'Helvetica-Bold'},
  row:{flexDirection:'row',borderBottomWidth:.3,borderColor:'#ddd',paddingVertical:3},
  bold:{fontFamily:'Helvetica-Bold'},
});
const widths=[80,520,55,105];
const headings=['Txn Type','Txn Remarks','Txn Time','Work Station'];

export function TxnLogPdfDocument({title,printDate,printTime,from,to,data}:{title:string;printDate:string;printTime:string;from:string;to:string;data:TxnLogData}){
  return <Document><Page size="A4" orientation="landscape" style={[s.page,{paddingBottom:45}]}>
    <ReportPdfHeader title={title}/>
    <Text>From {from} To {to}   ·   Print {printDate} {printTime}</Text>
    {data.locations.map(l=><View key={l.locCode}>
      <Text style={s.loc}>{l.locCode} — {l.locName}</Text>
      {l.users.map(u=><View key={u.userId||'(none)'}>
        <Text style={s.user}>User: {u.userId||'—'}{u.userName&&u.userName!==u.userId?` · ${u.userName}`:''}</Text>
        {u.days.map(d=><View key={d.date}>
          <Text style={s.date}>{pretty(d.date)}</Text>
          <View style={s.row}>{headings.map((h,j)=><Text key={h} style={[s.bold,{width:widths[j]}]}>{h}</Text>)}</View>
          {d.rows.map((r,j)=><View key={j} style={s.row}>
            <Text style={{width:widths[0]}}>{r.txn}</Text>
            <Text style={{width:widths[1]}}>{r.remarks||'—'}</Text>
            <Text style={{width:widths[2]}}>{txnTime12(r.time)}</Text>
            <Text style={{width:widths[3]}}>{r.workstation}</Text>
          </View>)}
        </View>)}
      </View>)}
    </View>)}
    <Text style={s.loc}>Records: {data.total.toLocaleString('en-US')}{data.truncated?' (first 5,000 shown)':''}</Text>
    <ReportPdfFooter/>
  </Page></Document>;
}
