// ============================================================
// LOCATION: components/reports/TaxVatPdfDocument.tsx
// 8.2 PDF — same print structure as the Sales Summary PDF
// (title / print info / range / location header / grey-head
// table / locationwise + grand totals), Helvetica font.
// ============================================================
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { TaxVatData } from "./TaxVatReport";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a" },
  title: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  infoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  infoLabel: { width: 80 },
  range: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 8, marginBottom: 4 },
  location: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  row: { flexDirection: "row" },
  th: {
    backgroundColor: "#efefef",
    fontFamily: "Helvetica-Bold",
    padding: 4,
    fontSize: 8,
    borderRightWidth: 1,
    borderRightColor: "#cccccc",
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
  },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: "#e5e5e5" },
  bold: { fontFamily: "Helvetica-Bold" },
  right: { textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#1a1a1a", marginTop: 2 },
  grandRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#1a1a1a", marginTop: 6, paddingTop: 4 },
});

const W = {
  billNo: 66,
  date: 62,
  wot: 74,
  vat: 58,
  tdl: 58,
  other: 74,
  packing: 58,
  vatTdl: 74,
};

export default function TaxVatPdfDocument({
  title,
  printDate,
  printTime,
  from,
  to,
  data,
}: {
  title: string;
  printDate: string;
  printTime: string;
  from: string;
  to: string;
  data: TaxVatData;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Print Date</Text>
          <Text>: {printDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Print Time</Text>
          <Text>: {printTime}</Text>
        </View>
        <Text style={styles.range}>From {from}  To {to}</Text>

        {data.locationGroups.map((loc) => (
          <View key={loc.locCode}>
            <Text style={styles.location}>
              {loc.locCode}   {loc.locName}
            </Text>

            <View style={styles.row}>
              <Text style={[styles.th, { width: W.billNo }]}>BillNo</Text>
              <Text style={[styles.th, { width: W.date }]}>Date</Text>
              <Text style={[styles.th, { width: W.wot }, styles.right]}>SalesWOT</Text>
              <Text style={[styles.th, { width: W.vat }, styles.right]}>VAT</Text>
              <Text style={[styles.th, { width: W.tdl }, styles.right]}>TDL</Text>
              <Text style={[styles.th, { width: W.other }, styles.right]}>OtherVAT</Text>
              <Text style={[styles.th, { width: W.packing }, styles.right]}>Packing</Text>
              <Text style={[styles.th, { width: W.vatTdl }, styles.right]}>VAT+TDL</Text>
            </View>

            {loc.rows.map((r, i) => (
              <View style={styles.row} key={`${r.billNo}-${i}`}>
                <Text style={[styles.td, { width: W.billNo }]}>{r.billNo}</Text>
                <Text style={[styles.td, { width: W.date }]}>{r.date}</Text>
                <Text style={[styles.td, { width: W.wot }, styles.right]}>{fmt(r.salesWOT)}</Text>
                <Text style={[styles.td, { width: W.vat }, styles.right]}>{fmt(r.vat)}</Text>
                <Text style={[styles.td, { width: W.tdl }, styles.right]}>{fmt(r.tdl)}</Text>
                <Text style={[styles.td, { width: W.other }, styles.right]}>{fmt(r.otherVat)}</Text>
                <Text style={[styles.td, { width: W.packing }, styles.right]}>{fmt(r.packing)}</Text>
                <Text style={[styles.td, { width: W.vatTdl }, styles.right]}>{fmt(r.vatTdl)}</Text>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={[styles.td, { width: W.billNo }]} />
              <Text style={[styles.td, { width: W.date }, styles.bold]}>
                Total - {loc.locName}
              </Text>
              <Text style={[styles.td, { width: W.wot }, styles.right, styles.bold]}>
                {fmt(loc.totals.salesWOT)}
              </Text>
              <Text style={[styles.td, { width: W.vat }, styles.right, styles.bold]}>
                {fmt(loc.totals.vat)}
              </Text>
              <Text style={[styles.td, { width: W.tdl }, styles.right, styles.bold]}>
                {fmt(loc.totals.tdl)}
              </Text>
              <Text style={[styles.td, { width: W.other }, styles.right, styles.bold]}>
                {fmt(loc.totals.otherVat)}
              </Text>
              <Text style={[styles.td, { width: W.packing }, styles.right, styles.bold]}>
                {fmt(loc.totals.packing)}
              </Text>
              <Text style={[styles.td, { width: W.vatTdl }, styles.right, styles.bold]}>
                {fmt(loc.totals.vatTdl)}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.grandRow}>
          <Text style={[styles.td, { width: W.billNo + W.date }, styles.bold]}>Grand Total</Text>
          <Text style={[styles.td, { width: W.wot }, styles.right, styles.bold]}>
            {fmt(data.grand.salesWOT)}
          </Text>
          <Text style={[styles.td, { width: W.vat }, styles.right, styles.bold]}>
            {fmt(data.grand.vat)}
          </Text>
          <Text style={[styles.td, { width: W.tdl }, styles.right, styles.bold]}>
            {fmt(data.grand.tdl)}
          </Text>
          <Text style={[styles.td, { width: W.other }, styles.right, styles.bold]}>
            {fmt(data.grand.otherVat)}
          </Text>
          <Text style={[styles.td, { width: W.packing }, styles.right, styles.bold]}>
            {fmt(data.grand.packing)}
          </Text>
          <Text style={[styles.td, { width: W.vatTdl }, styles.right, styles.bold]}>
            {fmt(data.grand.vatTdl)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
