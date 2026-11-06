import {NextRequest,NextResponse} from 'next/server';
import sql from 'mssql';
import {getPool} from '@/lib/db';
import {SESSION_COOKIE,verifySessionValue} from '@/lib/auth';
import {AccessDeniedError,requireWebPermission} from '@/lib/webAuthorization';
import {nextStockSerial,writeStockMovement} from '@/lib/stockPosting';
export const runtime='nodejs';
const docs={
 trq:{header:'Tbl_TransferReqHeder',detail:'Tbl_TransferReqDetail',id:'TRNO',qty:'TRQty',source:''},
 tn:{header:'Tbl_TransferNoteHeader',detail:'Tbl_TransferNoteDetail',id:'TranNo',qty:'TranQty',source:'TReqNO'},
 tr:{header:'Tbl_TransferReturnHeader',detail:'Tbl_TransferReturnDetail',id:'TRtnNo',qty:'TranRtnQty',source:'TNNO'},
} as const;
type Kind=keyof typeof docs;
const clean=(x:unknown)=>typeof x==='string'?x.trim():'';
const errors:Record<string,string>={
 INVALID:'Invalid document or location.', LOCATION_ACCESS:'Both locations must be in your permitted locations.',
 LOCATION_PAIR:'Choose a sub location and its assigned main location in the correct direction.',
 LOCKED:'The document is missing, duplicated, or already confirmed.', NO_LINES:'The document has no valid item lines, or item lines are duplicated.',
 SOURCE:'The confirmed source document or source item is missing or duplicated.',
 ITEM_ROW:'An enabled item row is missing or duplicated in a required location. Set it up in Item Master first.',
 STOCK:'Insufficient stock or invalid stock balance in the sending location.',
 SERIAL:'Location serial counter is missing, duplicated or invalid. No changes were committed.',
};
function params(tx:sql.Transaction,from:string,to:string,id:string){return new sql.Request(tx).input('from',sql.Char(10),from).input('to',sql.Char(10),to).input('id',sql.VarChar(15),id)}
export async function POST(req:NextRequest){
 let tx:sql.Transaction|undefined;
 try{
  const token=req.cookies.get(SESSION_COOKIE)?.value,user=token?verifySessionValue(token):null;
  if(!user)return NextResponse.json({error:'Please log in.'},{status:401});
  const body=await req.json(),kind=clean(body.kind) as Kind,from=clean(body.from),to=clean(body.to),id=clean(body.id);
  if(!Object.hasOwn(docs,kind)||!from||from.length>10||!to||to.length>10||!id||id.length>(kind==='tn'?15:10)||from.toUpperCase()===to.toUpperCase())throw Error('INVALID');
  const access=await requireWebPermission(user,`${kind}:CONFIRM`);
  const allowed=new Set([...access.locations].map(x=>clean(x).toUpperCase()));
  if(!allowed.has(from.toUpperCase())||!allowed.has(to.toUpperCase()))throw Error('LOCATION_ACCESS');
  const d=docs[kind];tx=new sql.Transaction(await getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const locs=await params(tx,from,to,id).query('SELECT RTRIM(LocCode) AS code,SubLoc,RTRIM(MainLoc) AS parent,Enable FROM dbo.Tbl_LocationMaster WITH (UPDLOCK,HOLDLOCK) WHERE LocCode=@from OR LocCode=@to');
  const lf=locs.recordset.filter(x=>clean(x.code).toUpperCase()===from.toUpperCase()),lt=locs.recordset.filter(x=>clean(x.code).toUpperCase()===to.toUpperCase());
  if(lf.length!==1||lt.length!==1||!lf[0].Enable||!lt[0].Enable)throw Error('LOCATION_PAIR');
  const sub=kind==='tn'?lt[0]:lf[0],main=kind==='tn'?lf[0]:lt[0];
  if(!sub.SubLoc||main.SubLoc||clean(sub.parent).toUpperCase()!==clean(main.code).toUpperCase())throw Error('LOCATION_PAIR');
  const head=await params(tx,from,to,id).query(`SELECT * FROM dbo.[${d.header}] WITH (UPDLOCK,HOLDLOCK) WHERE FromLocCode=@from AND ToLoc=@to AND [${d.id}]=@id`);
  if(head.recordset.length!==1||clean(head.recordset[0].Confirmed).toUpperCase()!=='N')throw Error('LOCKED');
  const existingSerial=Number(head.recordset[0].SysSerialNo);
  if(!Number.isSafeInteger(existingSerial)||existingSerial<0)throw Error('SERIAL');
  const serial=existingSerial>0?existingSerial:await nextStockSerial(tx,from);
  const lines=await params(tx,from,to,id).query(`SELECT RTRIM(ItemCode) AS item,[${d.qty}] AS qty FROM dbo.[${d.detail}] WITH (UPDLOCK,HOLDLOCK) WHERE FromLocCode=@from AND ToLoc=@to AND [${d.id}]=@id`);
  if(!lines.recordset.length||lines.recordset.some(x=>!clean(x.item)||clean(x.item).length>15||x.qty===null||!Number.isFinite(Number(x.qty))||Number(x.qty)<=0)||new Set(lines.recordset.map(x=>clean(x.item).toUpperCase())).size!==lines.recordset.length)throw Error('NO_LINES');
  const source=d.source?clean(head.recordset[0][d.source]):'';
  if(kind==='tr'&&!source)throw Error('SOURCE');
  if(source){
   const sourceHead=kind==='tn'?'Tbl_TransferReqHeder':'Tbl_TransferNoteHeader',sourceDetail=kind==='tn'?'Tbl_TransferReqDetail':'Tbl_TransferNoteDetail',sourceKey=kind==='tn'?'TRNO':'TranNo';
   const parent=await params(tx,to,from,source).query(`SELECT Confirmed FROM dbo.[${sourceHead}] WITH (UPDLOCK,HOLDLOCK) WHERE FromLocCode=@from AND ToLoc=@to AND [${sourceKey}]=@id`);
   if(parent.recordset.length!==1||clean(parent.recordset[0].Confirmed).toUpperCase()!=='Y')throw Error('SOURCE');
   for(const line of lines.recordset){
    const found=await params(tx,to,from,source).input('item',sql.Char(15),clean(line.item)).query(`SELECT ItemCode FROM dbo.[${sourceDetail}] WITH (UPDLOCK,HOLDLOCK) WHERE FromLocCode=@from AND ToLoc=@to AND [${sourceKey}]=@id AND ItemCode=@item`);
    if(found.recordset.length!==1)throw Error('SOURCE');
   }
  }
  // No auto-creation of stock rows. Lock all item rows for the duration of posting.
  for(const line of [...lines.recordset].sort((a,b)=>clean(a.item).localeCompare(clean(b.item)))){
   const item=clean(line.item),qty=Number(line.qty);
   const stock=await params(tx,from,to,id).input('item',sql.Char(15),item).query('SELECT RTRIM(LocCode) AS loc,StkBal,Enable FROM dbo.Tbl_RowItems WITH (UPDLOCK,HOLDLOCK) WHERE RowItemCode=@item AND (LocCode=@from OR LocCode=@to)');
   const sending=stock.recordset.filter(x=>clean(x.loc).toUpperCase()===from.toUpperCase());
   const receiving=stock.recordset.filter(x=>clean(x.loc).toUpperCase()===to.toUpperCase());
   if(sending.length!==1||receiving.length!==1||!sending[0].Enable||!receiving[0].Enable)throw Error('ITEM_ROW');
   if(kind==='trq')continue; // Approval only; both rows must exist, but stock does not move.
   if(sending[0].StkBal===null||receiving[0].StkBal===null||!Number.isFinite(Number(sending[0].StkBal))||!Number.isFinite(Number(receiving[0].StkBal)))throw Error('STOCK');
   const out=await new sql.Request(tx).input('loc',sql.Char(10),from).input('item',sql.Char(15),item).input('qty',sql.Float,qty).query('UPDATE dbo.Tbl_RowItems SET StkBal=StkBal-@qty WHERE LocCode=@loc AND RowItemCode=@item AND Enable=1 AND StkBal>=@qty');
   if(out.rowsAffected[0]!==1)throw Error('STOCK');
   const into=await new sql.Request(tx).input('loc',sql.Char(10),to).input('item',sql.Char(15),item).input('qty',sql.Float,qty).query('UPDATE dbo.Tbl_RowItems SET StkBal=StkBal+@qty WHERE LocCode=@loc AND RowItemCode=@item AND Enable=1 AND StkBal IS NOT NULL');
   if(into.rowsAffected[0]!==1)throw Error('ITEM_ROW');
   const current=await params(tx,from,to,id).input('item',sql.Char(15),item).query('SELECT RTRIM(LocCode) AS loc,StkBal FROM dbo.Tbl_RowItems WHERE RowItemCode=@item AND (LocCode=@from OR LocCode=@to)');
   const afterFrom=current.recordset.filter(x=>clean(x.loc).toUpperCase()===from.toUpperCase()),afterTo=current.recordset.filter(x=>clean(x.loc).toUpperCase()===to.toUpperCase());
   if(afterFrom.length!==1||afterTo.length!==1||afterFrom[0].StkBal===null||afterTo[0].StkBal===null)throw Error('ITEM_ROW');
   const common={item,doc:id,user:clean(user.userId),serial,qty,remarks:`${kind==='tn'?'Transfer Note':'Transfer Return'} ${id}`};
   await writeStockMovement(tx,{...common,loc:from,type:kind==='tn'?'TO':'TRTO',pre:Number(sending[0].StkBal),last:Number(afterFrom[0].StkBal),direction:'-'});
   await writeStockMovement(tx,{...common,loc:to,type:kind==='tn'?'TI':'TRTI',pre:Number(receiving[0].StkBal),last:Number(afterTo[0].StkBal),direction:'+'});
   if(source){
    const table=kind==='tn'?'Tbl_TransferReqDetail':'Tbl_TransferNoteDetail',key=kind==='tn'?'TRNO':'TranNo',column=kind==='tn'?'IssuedQTY':'TranRtnQTY';
    const updated=await params(tx,to,from,source).input('item',sql.Char(15),item).input('qty',sql.Float,qty).query(`UPDATE dbo.[${table}] SET [${column}]=ISNULL([${column}],0)+@qty WHERE FromLocCode=@from AND ToLoc=@to AND [${key}]=@id AND ItemCode=@item`);
    if(updated.rowsAffected[0]!==1)throw Error('SOURCE');
   }
  }
  if(source){
   if(kind==='tn')await params(tx,to,from,source).query(`UPDATE h SET TakenForTransfer='1' FROM dbo.Tbl_TransferReqHeder h WHERE h.FromLocCode=@from AND h.ToLoc=@to AND h.TRNO=@id AND NOT EXISTS (SELECT 1 FROM dbo.Tbl_TransferReqDetail d WHERE d.FromLocCode=h.FromLocCode AND d.ToLoc=h.ToLoc AND d.TRNo=h.TRNO AND ISNULL(d.TRQty,0)<>ISNULL(d.IssuedQTY,0))`);
   if(kind==='tr')await params(tx,to,from,source).query(`UPDATE h SET TakenForTransferRtn=1 FROM dbo.Tbl_TransferNoteHeader h WHERE h.FromLocCode=@from AND h.ToLoc=@to AND h.TranNo=@id AND NOT EXISTS (SELECT 1 FROM dbo.Tbl_TransferNoteDetail d WHERE d.FromLocCode=h.FromLocCode AND d.ToLoc=h.ToLoc AND d.TranNo=h.TranNo AND ISNULL(d.TranQty,0)<>ISNULL(d.TranRtnQTY,0))`);
  }
  const result=await params(tx,from,to,id).input('user',sql.Char(10),clean(user.userId)).input('serial',sql.Float,serial).query(`UPDATE dbo.[${d.header}] SET Confirmed='Y',ConUserID=@user,ConDatetime=GETDATE(),SysSerialNo=@serial WHERE FromLocCode=@from AND ToLoc=@to AND [${d.id}]=@id AND UPPER(RTRIM(Confirmed))='N'`);
  if(result.rowsAffected[0]!==1)throw Error('LOCKED');
  await tx.commit();tx=undefined;return NextResponse.json({success:true});
 }catch(e){
  if(tx)try{await tx.rollback()}catch{}
  const m=(e as Error).message;console.error('Transfer confirmation error:',e);
  return NextResponse.json({error:errors[m]??(e instanceof AccessDeniedError?'Access denied.':'Confirmation failed. No changes were committed; check database schema and server logs.')},{status:e instanceof AccessDeniedError||m==='LOCATION_ACCESS'?403:errors[m]?409:500});
 }
}
