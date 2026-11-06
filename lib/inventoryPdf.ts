import 'server-only';
import PDFDocument from 'pdfkit';

type PdfLine={item:string;name?:string;unit:string;unitName?:string;qty:number;cost:number;value:number};
export type InventoryPdfData={title:string;id:string;date:string;status:string;location:string;locationName?:string;destination?:string;supplier?:string;supplierName?:string;invoice?:string;due?:string;delivery?:string;remarks?:string;total:number;discount?:number;adjustment?:number;type?:string;lines:PdfLine[]};
const money=(n:number)=>Number(n||0).toFixed(2);
export async function renderInventoryPdf(d:InventoryPdfData,copy:'standard'|'supplier'):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  try{
   const pdf=new PDFDocument({size:'A4',margin:32,autoFirstPage:true,info:{Title:`${d.title} ${d.id}`}}),chunks:Buffer[]=[];
   pdf.on('data',(chunk:Buffer)=>chunks.push(chunk));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);
   const monetary=copy==='standard',left=32,right=pdf.page.width-32,width=right-left;
   pdf.fillColor('#292929').font('Helvetica-Bold').fontSize(18).text(d.title);
   pdf.font('Helvetica').fontSize(9).moveDown(.3).text(monetary?'Standard Copy':'Supplier Copy').moveDown(.5);
   pdf.text(`Document: ${d.id}    Date: ${d.date}    Status: ${d.status}`);
   pdf.text(`Location: ${d.location} ${d.locationName||''}${d.destination?`    To: ${d.destination}`:''}`);
   if(d.supplier)pdf.text(`Supplier: ${d.supplier} ${d.supplierName||''}    Invoice: ${d.invoice||'-'}`);
   if(d.due)pdf.text(`Due date: ${d.due}    Delivery: ${d.delivery||'-'}`);
   pdf.moveDown();
   const columns=monetary?[.35,.17,.16,.16,.16]:[.50,.25,.25];
   const headers=monetary?['Item code / name','Unit','Quantity','Cost','Value']:['Item code / name','Unit','Quantity'];
   function header(){const y=pdf.y;let x=left;pdf.font('Helvetica-Bold').fontSize(9);headers.forEach((v,i)=>{pdf.text(v,x,y,{width:width*columns[i]-6,lineBreak:false});x+=width*columns[i]});pdf.moveTo(left,y+15).lineTo(right,y+15).strokeColor('#aaaaaa').lineWidth(.6).stroke();pdf.y=y+20}
   header();
   for(const line of d.lines){
    const vals=[`${line.item} ${line.name||''}`.trim(),line.unitName||line.unit,String(line.qty),...(monetary?[money(line.cost),money(line.value)]:[])];
    pdf.font('Helvetica').fontSize(9);const heights=vals.map((v,i)=>pdf.heightOfString(v,{width:width*columns[i]-8}));const rowHeight=Math.max(14,...heights)+8;
    if(pdf.y+rowHeight>pdf.page.height-48){pdf.addPage();header()}
    const y=pdf.y;let x=left;vals.forEach((v,i)=>{pdf.text(v,x,y,{width:width*columns[i]-8});x+=width*columns[i]});pdf.moveTo(left,y+rowHeight-4).lineTo(right,y+rowHeight-4).strokeColor('#dddddd').lineWidth(.4).stroke();pdf.y=y+rowHeight;
   }
   if(pdf.y>pdf.page.height-100)pdf.addPage();pdf.x=left;pdf.moveDown(.5);
   if(monetary){if(d.type==='grn'){pdf.text(`Discount: ${money(d.discount||0)}`,{align:'right'});pdf.text(`Adjustment: ${money(d.adjustment||0)}`,{align:'right'})}pdf.font('Helvetica-Bold').text(`Total (LKR): ${money(d.total)}`,{align:'right'}).font('Helvetica')}
   pdf.moveDown().text(`Remarks: ${d.remarks||'-'}`);pdf.end();
  }catch(e){reject(e)}
 });
}
