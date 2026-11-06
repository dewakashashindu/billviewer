import 'server-only';
import sql from 'mssql';

/** Caller must hold a SQL transaction and commit/rollback the entire posting. */
export async function nextStockSerial(tx:sql.Transaction,location:string):Promise<number>{
 const row=await new sql.Request(tx).input('loc',sql.Char(10),location).query('SELECT SerialNo FROM dbo.Tbl_TxnSerial WITH (UPDLOCK,HOLDLOCK) WHERE LocCode=@loc');
 if(row.recordset.length!==1)throw Error('SERIAL');
 const n=Number(row.recordset[0].SerialNo);
 if(!Number.isSafeInteger(n)||n<=0||!Number.isSafeInteger(n+1))throw Error('SERIAL');
 const updated=await new sql.Request(tx).input('loc',sql.Char(10),location).query('UPDATE dbo.Tbl_TxnSerial SET SerialNo=SerialNo+1 WHERE LocCode=@loc');
 if(updated.rowsAffected[0]!==1)throw Error('SERIAL');
 return n;
}
export async function writeStockMovement(tx:sql.Transaction,p:{loc:string;item:string;doc:string;type:string;user:string;serial:number;pre:number;qty:number;last:number;direction:'+'|'-'|'.';remarks:string}){
 if(![p.pre,p.qty,p.last,p.serial].every(Number.isFinite))throw Error('STOCK');
 await new sql.Request(tx).input('loc',sql.Char(15),p.loc).input('item',sql.VarChar(20),p.item)
 .input('doc',sql.VarChar(20),p.doc).input('type',sql.VarChar(100),p.type).input('user',sql.VarChar(20),p.user)
 .input('serial',sql.Float,p.serial).input('pre',sql.Float,p.pre).input('qty',sql.Float,p.qty).input('last',sql.Float,p.last)
 .input('remarks',sql.VarChar(200),p.remarks.trim().slice(0,200)||' ').input('direction',sql.Char(1),p.direction)
 .query(`DECLARE @now datetime=GETDATE(); INSERT INTO dbo.Tbl_TxnMovement
 (LocCode,RowItemCode,TxnNo,TxnType,TxnDate,TxndateTime,PreQty,TxnQty,LastQty,UserId,SysSerialId,Remarks,AddDeduct,TXNDATETIMEMANUAL,SourceItemCode)
 VALUES (@loc,@item,@doc,@type,@now,@now,@pre,@qty,@last,@user,@serial,@remarks,@direction,@now,' ')`);
}
