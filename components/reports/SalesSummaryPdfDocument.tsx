import { ReportPdfHeader, ReportPdfFooter } from './ReportPdfBrand';
// ============================================================
// LOCATION: components/reports/SalesSummaryPdfDocument.tsx
// FULL REPLACE — PDF eka POS report eka wage, ✅ LOCATION-WISE:
// ============================================================
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface SummaryRow {
  billNo: string;
  netTotal: number;
  steward: string;
  billType: string;
  orderMode: string;
  txnTime: string;
  casher: string;
}

export interface SummaryGroup {
  date: string;
  rows: SummaryRow[];
  dayTotal: number;
}

export interface SummaryLocation {
  locCode: string;
  locName: string;
  dateGroups: SummaryGroup[];
  locTotal: number;
}

interface Props {
  title: string;
  printDate: string;
  printTime: string;
  from: string;
  to: string;
  locationGroups: SummaryLocation[];
  grandTotal: number;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const styles = StyleSheet.create({
 page:{padding:28,paddingBottom:45,fontFamily:'Helvetica',fontSize:8,color:'#30251e'},
 meta:{flexDirection:'row',justifyContent:'space-between',marginBottom:14},metaLabel:{fontFamily:'Helvetica-Bold',fontSize:7,color:'#806d5e',marginBottom:4},metaValue:{fontFamily:'Helvetica-Bold',fontSize:9},
 location:{backgroundColor:'#f8f4ef',padding:10,fontFamily:'Helvetica-Bold',fontSize:10,color:'#624631',marginBottom:8,marginTop:6},
 date:{fontFamily:'Helvetica-Bold',fontSize:9,color:'#624631',marginTop:6,marginBottom:6},
 row:{flexDirection:'row'},head:{backgroundColor:'#624631',color:'white',fontFamily:'Helvetica-Bold',padding:5,fontSize:7},cell:{padding:5,fontSize:8,borderBottomWidth:.5,borderBottomColor:'#eee5db'},right:{textAlign:'right'},
 total:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#f1e7d8',padding:7,marginTop:4,marginBottom:6,fontFamily:'Helvetica-Bold',color:'#624631'},
});
const W={billNo:65,steward:70,billType:70,orderMode:70,txnTime:75,casher:85,netTotal:104};
function LocationBlock({loc}:{loc:SummaryLocation}){return <View>
 <Text style={styles.location}>{loc.locCode}   {loc.locName}</Text>
 {loc.dateGroups.map(g=><View key={g.date}><Text style={styles.date}>{g.date}</Text>
 <View style={styles.row} wrap={false}>{([['Bill No',W.billNo],['Steward',W.steward],['Bill Type',W.billType],['Order Mode',W.orderMode],['Txn Time',W.txnTime],['Cashier',W.casher],['Net Total',W.netTotal]] as [string,number][]).map(([label,width])=><Text key={label} style={[styles.head,{width},...(label==='Net Total'?[styles.right]:[])]}>{label}</Text>)}</View>
 {g.rows.map((r,i)=><View key={`${r.billNo}-${i}`} style={[styles.row,i%2===0?{backgroundColor:'#faf7f3'}:{}]} wrap={false}>{([ [r.billNo,W.billNo],[r.steward,W.steward],[r.billType,W.billType],[r.orderMode,W.orderMode],[r.txnTime,W.txnTime],[r.casher,W.casher],[fmt(r.netTotal),W.netTotal]] as [string,number][]).map(([v,width],j)=><Text key={j} style={[styles.cell,{width},...(j===6?[styles.right]:[])]}>{v}</Text>)}</View>)}
 <View style={styles.total} wrap={false}><Text>Daily Collection</Text><Text>{fmt(g.dayTotal)}</Text></View></View>)}
 <View style={styles.total} wrap={false}><Text>Total — {loc.locName}</Text><Text>{fmt(loc.locTotal)}</Text></View>
 </View>}

export default function SalesSummaryPdfDocument({
  title,
  printDate,
  printTime,
  from,
  to,
  locationGroups,
  grandTotal,
}: Props) {
  return (
    <Document title={title} author="Mila Mirissa">
      <Page size="A4" style={[styles.page, {paddingBottom: 45}]}>
        <ReportPdfHeader title={title}/>

        <View style={styles.meta} wrap={false}>
          <View><Text style={styles.metaLabel}>REPORT PERIOD</Text><Text style={styles.metaValue}>{from}  -  {to}</Text></View>
          <View><Text style={styles.metaLabel}>PRINTED</Text><Text>{printDate}  |  {printTime}</Text></View>
        </View>

        {/* Location-wise sections */}
        {locationGroups.map((loc) => (
          <LocationBlock key={loc.locCode} loc={loc} />
        ))}

        <View style={styles.total} wrap={false}><Text>Grand Total</Text><Text>{fmt(grandTotal)}</Text></View>
      <ReportPdfFooter/></Page>
    </Document>
  );
}
