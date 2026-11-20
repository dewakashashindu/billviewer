"use client";
import {useEffect,useMemo,useState,type ReactNode} from "react";

/** Pack complete groups against a soft row target. An oversized group is never split. */
export function packGroups<T>(groups: T[], size: number, count: (g:T)=>number): T[][] {
 const pages:T[][]=[]; let page:T[]=[]; let rows=0;
 for(const group of groups){const n=Math.max(0,count(group));if(page.length && rows+n>size){pages.push(page);page=[];rows=0}page.push(group);rows+=n;}
 if(page.length)pages.push(page);return pages;
}
type Group={key:string;count:number;content:ReactNode};
export default function GroupPagination({groups,unit="rows",resetKey=""}:{groups:Group[];unit?:string;resetKey?:string}){
 const [size,setSize]=useState('50'); const [page,setPage]=useState(0);
 const signature=groups.map(g=>`${g.key}:${g.count}`).join('|');
 const pages=useMemo(()=>packGroups(groups,size==='all'?Infinity:Number(size),g=>g.count),[groups,size]);
 useEffect(()=>setPage(0),[signature,size,resetKey]);
 const current=Math.min(page,Math.max(0,pages.length-1)),shown=pages[current]||[];
 if(!groups.length)return null;
 const button={border:'1px solid #cbb9a4',background:'#fff',color:'#684830',borderRadius:7,padding:'7px 10px',fontWeight:700} as const;
 const controls=<nav aria-label="Report pagination" style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'10px 12px',background:'#f9f3eb',border:'1px solid #e4d6bf',borderRadius:8,margin:'10px 0',fontSize:12,color:'#684830'}}><label>Target {unit} per page{' '}<select aria-label={`Target ${unit} per page`} value={size} onChange={e=>setSize(e.target.value)} style={{...button,padding:'6px'}}><option value="50">50</option><option value="100">100</option><option value="150">150</option><option value="all">All</option></select></label><span style={{flex:1,minWidth:120}}>Complete groups stay together · {shown.reduce((s,g)=>s+g.count,0)} {unit} shown</span><button type="button" style={button} disabled={current===0} onClick={()=>setPage(current-1)}>‹ Previous</button><span aria-live="polite">Page {current+1} / {pages.length}</span><button type="button" style={button} disabled={current>=pages.length-1} onClick={()=>setPage(current+1)}>Next ›</button></nav>;
 return <>{controls}{shown.map(g=><div key={g.key}>{g.content}</div>)}{pages.length>1&&controls}</>;
}
