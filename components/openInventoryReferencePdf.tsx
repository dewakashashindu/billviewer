'use client';
import {createElement} from 'react';
import {getPrintProfile,printDateTime} from './InventoryPrintBrand';
import type {PdfSection} from './InventoryReferencePdf';
/** Call from a click handler, before any await, so browsers can open the viewer. */
export async function openInventoryReferencePdf(title:string,sections:PdfSection[],subtitle?:string){
 const popup=window.open('about:blank','_blank');
 if(!popup)throw Error('Please allow pop-ups for this site to open the PDF.');
 try{
  popup.opener=null;popup.document.title='Preparing PDF';popup.document.body.textContent='Preparing PDF…';
  const [profile,renderer,pdfModule]=await Promise.all([getPrintProfile(),import('@react-pdf/renderer'),import('./InventoryReferencePdf')]);
  const document=createElement(pdfModule.default,{title,profile,printed:printDateTime(new Date()),subtitle,sections});
  const blob=await renderer.pdf(document).toBlob();const url=URL.createObjectURL(blob);
  popup.location.replace(url);window.setTimeout(()=>URL.revokeObjectURL(url),60*60*1000);
 }catch(e){popup.close();throw e}
}
