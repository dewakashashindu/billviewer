/** Presentation only; document state is provided by the existing screen. */
export default function InventoryDocumentStatus({id,confirmed,empty='Draft'}:{id?:string;confirmed:boolean;empty?:string}) {
 const label=id?(confirmed?'Confirmed':'Pending'):empty;
 const colors=id?(confirmed?{background:'#dceee0',color:'#2f6539',border:'#9bc3a2'}:{background:'#fff0d4',color:'#80531a',border:'#dec69b'}):{background:'#f3ece4',color:'#685342',border:'#d8c8b7'};
 return <span style={{display:'inline-flex',alignItems:'center',flexWrap:'wrap',gap:7,fontSize:11,fontWeight:700,color:'inherit'}}>{id&&<span>{id}</span>}<span style={{background:colors.background,color:colors.color,border:`1px solid ${colors.border}`,borderRadius:999,padding:'4px 10px',lineHeight:1.3}}>{label}</span></span>;
}
