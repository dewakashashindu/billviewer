import 'server-only';
import PDFDocument from 'pdfkit';
import path from 'node:path';
import {columns,money,type PrintDoc,type PrintCopy} from './inventoryPrintLayout';
export type InventoryPdfData=PrintDoc;
export async function renderInventoryPdf(d:InventoryPdfData,copy:PrintCopy):Promise<Buffer>{return new Promise((resolve,reject)=>{try{
 const pdf=new PDFDocument({size:'A4',margin:34,bufferPages:true,info:{Title:`${d.title} ${d.id}`}}),chunks:Buffer[]=[];pdf.on('data',(c:Buffer)=>chunks.push(c));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);
 const left=34,right=pdf.page.width-34,width=right-left,blue='#a98f70',pale='#f4eadb',cols=columns(d,copy);let y=34;
 const txt=(text:string,x:number,yy:number,w:number,align:'left'|'right'|'center'='left',bold=false,size=9)=>{pdf.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).fillColor('#45301d').text(text,x,yy,{width:w,align,lineBreak:false,ellipsis:true})};
 const printedAt=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
 function header(){const top=34;pdf.image(path.join(process.cwd(),'public','millamirissa.png'),left,top,{fit:[48,48]});
  const brandX=left+55,brandWidth=width*.26-55;txt('MILA MIRISSA',brandX,top,brandWidth,'left',true,8);
  let brandY=top+12;for(const line of d.profile?.address||[]){pdf.font('Helvetica').fontSize(7).fillColor('#45301d').text(line,brandX,brandY,{width:Math.max(brandWidth,55)});brandY=pdf.y+2}if(d.profile?.tel){pdf.font('Helvetica').fontSize(7).text(`Tel: ${d.profile.tel}`,brandX,brandY,{width:Math.max(brandWidth,55)});brandY=pdf.y+2}
  txt(d.title,left+width*.30,top+5,width*.39,'center',true,13);txt(`Printed: ${printedAt}`,left+width*.69,top,width*.31,'right',false,8);txt(`Status: ${d.status}`,left+width*.69,top+15,width*.31,'right');
  y=Math.max(top+58,brandY+5);const rightText=[d.due?`Due date: ${d.due}`:'',d.delivery?`Delivery: ${d.delivery}`:''].filter(Boolean).join('\n');
  const ctx=d.destination?`${d.location} ${d.locationName||''}  to  ${d.destination}`:d.supplier?`${d.supplier} ${d.supplierName||''}`:`${d.location} ${d.locationName||''}`;
  pdf.font('Helvetica').fontSize(8);const boxH=Math.max(38,pdf.heightOfString(ctx,{width:width*.53-16})+24,rightText?pdf.heightOfString(rightText,{width:width*.42-16})+16:0);
  pdf.rect(left,y,width,boxH).lineWidth(.6).strokeColor(blue).stroke();txt(d.destination?'FROM / TO':d.supplier?'SUPPLIER':'LOCATION',left+8,y+6,width*.53-16,'left',true,8);pdf.font('Helvetica').fontSize(8).fillColor('#45301d').text(ctx,left+8,y+20,{width:width*.53-16});if(rightText)pdf.text(rightText,left+width*.55,y+8,{width:width*.45-8,align:'right'});
  y+=boxH+6;pdf.rect(left,y,width,21).fillAndStroke(pale,blue);txt(`Document No: ${d.id}${d.invoice?`    Supplier invoice: ${d.invoice}`:''}`,left+7,y+6,width-14,'left',true,9);y+=21;tableHeader()}

 function tableHeader(){pdf.rect(left,y,width,22).fillAndStroke('#f1e7da',blue);let x=left;for(const col of cols){const w=width*col.width;txt(col.label,x+4,y+7,w-8,col.align,true,7.5);x+=w}y+=22}
 function page(){pdf.addPage();y=34;header()}
 header();for(const line of d.lines){pdf.font('Helvetica').fontSize(8.5);const values=cols.map(c=>c.value(line));const height=Math.max(22,...values.map((v,i)=>pdf.heightOfString(v,{width:width*cols[i].width-8})+10));if(y+height>pdf.page.height-60)page();let x=left;cols.forEach((col,i)=>{const w=width*col.width;pdf.rect(x,y,w,height).lineWidth(.4).strokeColor('#d4c1a9').stroke();pdf.fillColor('#45301d').font('Helvetica').fontSize(8.5).text(values[i],x+4,y+5,{width:w-8,align:col.align});x+=w});y+=height}
 if(y+100>pdf.page.height-48)page();y+=10;if(copy==='standard'){if(d.type==='grn'){txt(`Discount: ${money(d.discount)}    Adjustment: ${money(d.adjustment)}`,left,y,width,'right');y+=16}pdf.rect(left,y,width,22).fillAndStroke(pale,blue);txt(`Total (LKR): ${money(d.total)}`,left+8,y+6,width-16,'right',true);y+=30}pdf.font('Helvetica').fontSize(9).fillColor('#45301d').text(`Remarks: ${d.remarks||'-'}`,left,y,{width});
 const pages=pdf.bufferedPageRange();for(let i=0;i<pages.count;i++){pdf.switchToPage(i);pdf.page.margins.bottom=0;const fy=pdf.page.height-24;txt(copy==='standard'?'Standard Copy':'Supplier Copy',left,fy,width*.5,'left',false,8);txt(`Page ${i+1} of ${pages.count}`,left+width*.35,fy,width*.30,'center',false,8);txt('MicroEChef',left+width*.70,fy,width*.30,'right',true,8)}pdf.end();
 }catch(e){reject(e)}})}
