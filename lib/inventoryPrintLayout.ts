export type PrintCopy='standard'|'supplier';
export type PrintLine={item:string;name?:string;unit:string;unitName?:string;qty:number;cost:number;value:number;free?:number;sysQty?:number};
export type PrintDoc={title:string;id:string;date:string;status:string;location:string;locationName?:string;destination?:string;supplier?:string;supplierName?:string;invoice?:string;due?:string;delivery?:string;remarks?:string;total:number;discount?:number;adjustment?:number;type?:string;lines:PrintLine[]};
export type PrintColumn={label:string;width:number;align:'left'|'right';value:(line:PrintLine)=>string};
export const money=(n:number|undefined)=>Number(n||0).toFixed(2);
export function columns(d:PrintDoc,copy:PrintCopy):PrintColumn[]{const standard=copy==='standard',extra=d.type==='grn'||d.type==='recon';return [
 {label:'Item code',width:.14,align:'left',value:l=>l.item},
 {label:'Item description',width:standard?(extra?.22:.32):(extra?.54:.64),align:'left',value:l=>l.name||''},
 {label:'Unit',width:.12,align:'left',value:l=>l.unitName||l.unit},
 ...(d.type==='recon'?[{label:'System qty',width:.10,align:'right' as const,value:(l:PrintLine)=>String(l.sysQty??0)}]:[]),
 {label:d.type==='recon'?'Physical qty':'Qty',width:.10,align:'right',value:l=>String(l.qty)},
 ...(d.type==='grn'?[{label:'Free qty',width:.10,align:'right' as const,value:(l:PrintLine)=>String(l.free??0)}]:[]),
 ...(standard?[{label:'Cost price',width:.14,align:'right' as const,value:(l:PrintLine)=>money(l.cost)},{label:'Item value',width:.18,align:'right' as const,value:(l:PrintLine)=>money(l.value)}]:[]),
 ]}
