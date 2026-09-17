// ============================================================
// LOCATION: components/reports/PaymentGridPdfDocument.tsx
// 2.3 PDF - "Bills By Pay Mode Wise" pivot grid (landscape A4):
// rows = bills, columns = pay modes, right col = bill total,
// bottom row = per-mode totals, then grand total.
// ============================================================
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { BillPayModeGridData } from "./PaymentGridReports";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: "Helvetica", fontSize: 8, color: "#1a1a1a" },
  title: { textAlign: "center", fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  infoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  range: { marginBottom: 4 },
  locBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  head: {
    flexDirection: "row",
    padding: "3 6",
    backgroundColor: "#efefef",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
  },
  row: { flexDirection: "row", padding: "1.5 6", borderBottom: 0.4, borderColor: "#e3e3e3" },
  totRow: {
    flexDirection: "row",
    padding: "3 6",
    fontFamily: "Helvetica-Bold",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    marginTop: 2,
  },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "4 6",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    borderTopWidth: 2,
    borderTopColor: "#1a1a1a",
    marginTop: 6,
    paddingTop: 4,
  },
  billNo: { width: 70 },
  modeCell: { flex: 1, textAlign: "right" },
  total: { width: 75, textAlign: "right", fontFamily: "Helvetica-Bold" },
});

export default function BillPayModeGridPdfDocument({
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
  data: BillPayModeGridData;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.infoRow}><Text>Print Date : {printDate}</Text></View>
        <View style={styles.infoRow}><Text>Print Time : {printTime}</Text></View>
        <View style={styles.range}><Text>From : {from}  To : {to}</Text></View>

        {data.locationGroups.map((loc) => (
          <View key={loc.locCode}>
            <View style={styles.locBar}>
              <Text>{loc.locCode}  {loc.locName}</Text>
              <Text>{fmt(loc.locTotal)}</Text>
            </View>
            <View style={styles.head}>
              <Text style={styles.billNo}>Bill No</Text>
              {loc.payModes.map((m) => (
                <Text key={m} style={styles.modeCell}>{m}</Text>
              ))}
              <Text style={styles.total}>Total</Text>
            </View>
            {loc.bills.map((b) => (
              <View style={styles.row} key={b.billNo}>
                <Text style={styles.billNo}>{b.billNo}</Text>
                {loc.payModes.map((m) => (
                  <Text key={m} style={styles.modeCell}>
                    {b.cells[m] !== undefined ? fmt(b.cells[m]) : ""}
                  </Text>
                ))}
                <Text style={styles.total}>{fmt(b.total)}</Text>
              </View>
            ))}
            <View style={styles.totRow}>
              <Text style={styles.billNo}>Total</Text>
              {loc.payModes.map((m) => (
                <Text key={m} style={styles.modeCell}>{fmt(loc.modeTotals[m] ?? 0)}</Text>
              ))}
              <Text style={styles.total}>{fmt(loc.locTotal)}</Text>
            </View>
          </View>
        ))}
        <View style={styles.grand}>
          <Text>Grand Total</Text>
          <Text>{fmt(data.grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
