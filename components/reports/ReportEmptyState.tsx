import type {ReactNode} from 'react';
import {IconInbox} from './ReportIcons';
export default function ReportEmptyState({children,hint='Try changing the date range, filters or search.'}:{children?:ReactNode;hint?:string}) {
 return <div style={{padding:'22px 24px 28px',fontFamily:'Inter, sans-serif'}}><div role="status" style={{border:'1px solid #E4D6BF',borderRadius:14,background:'#fff',boxShadow:'0 1px 2px rgba(114,86,60,0.04), 0 8px 24px rgba(114,86,60,0.06)',padding:'46px 20px',textAlign:'center'}}><div style={{display:'flex',justifyContent:'center',color:'#b6a799',marginBottom:10}}><IconInbox size={30} strokeWidth={1.6}/></div><p style={{margin:0,fontSize:13.5,fontWeight:600,color:'#684830'}}>{children||'No records found for the selected filters.'}</p>{hint&&<p style={{margin:'4px 0 0',fontSize:12,color:'#907860'}}>{hint}</p>}</div></div>;
}
