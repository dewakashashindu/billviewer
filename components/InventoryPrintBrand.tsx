'use client';
export type PrintProfile={address:string[];tel:string};
export async function getPrintProfile():Promise<PrintProfile>{const r=await fetch('/api/inventory/print-profile',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to load print profile.');return data}
export function printDateTime(date:Date){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)}
export function InventoryPrintBrand({profile,title,at,status}:{profile:PrintProfile;title:string;at:string;status?:string}){return <div className="inv-brand"><div className="inv-brand-left"><img src="/millamirissa.png" alt="Mila Mirissa"/><div><b>MILA MIRISSA</b>{profile.address.map((line,i)=><div key={i}>{line}</div>)}{profile.tel&&<div>Tel: {profile.tel}</div>}</div></div><strong>{title}</strong><div className="inv-brand-date">Printed: {at}{status&&<><br/>Status: {status}</>}</div></div>}
export const inventoryPrintBrandCss=`.inv-brand{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;align-items:start;color:#45301d;margin-bottom:14px}.inv-brand-left{display:flex;gap:8px;align-items:flex-start;font-size:8pt;font-weight:normal;line-height:1.35}.inv-brand-left img{width:48px;height:48px;object-fit:contain}.inv-brand-left b{font-size:9pt}.inv-brand strong{text-align:center;font-size:14pt}.inv-brand-date{text-align:right;font-size:8pt;font-weight:normal}.inv-print-footer{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-between;color:#684830;font-size:8pt}.inv-print-footer .brand{font-weight:bold}.inv-print-footer .page{position:absolute;left:45%;width:10%;text-align:center}.inv-print-footer .page:after{content:counter(page)}`;

/** Wait for the logo before opening the native print dialog. */
export async function waitForInventoryPrintLogo(){
 const image=document.querySelector<HTMLImageElement>('.inv-brand-left img');
 if(!image||image.complete)return;
 await Promise.race([new Promise<void>(resolve=>{image.addEventListener('load',()=>resolve(),{once:true});image.addEventListener('error',()=>resolve(),{once:true})}),new Promise<void>(resolve=>setTimeout(resolve,3000))]);
}
