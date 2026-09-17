// ============================================================
// LOCATION: components/reports/PaymentPdfDocument.tsx
// ✅ 2.1/2.2 PDF — POS print eke wage location → date → bill payments
// ============================================================
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PaymentSummaryData } from "./PaymentReports";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a" },
  title: { textAlign: "center", fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  infoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
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
  dateBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  head: {
    flexDirection: "row",
    padding: "3 6",
    backgroundColor: "#efefef",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    marginTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
  },
  row: { flexDirection: "row", padding: "1.2 6", borderBottom: 0.4, borderColor: "#e3e3e3" },
  btot: { flexDirection: "row", justifyContent: "flex-end", padding: "1.2 6", fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: "#1a1a1a", marginTop: 2 },
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
});

export default function PaymentSummaryPdfDocument({
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
  data: PaymentSummaryData;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.infoRow}><Text>Print Date : {printDate}</Text></View>
        <View style={styles.infoRow}><Text>Print Time : {printTime}</Text></View>
        <View style={styles.infoRow}><Text>From : {from}  To : {to}</Text></View>

        {data.locationGroups.map((loc) => (
          <View key={loc.locCode}>
            <View style={styles.locBar}>
              <Text>{loc.locCode}  {loc.locName}</Text>
              <Text>{fmt(loc.locTotal)}</Text>
            </View>
            {loc.dateGroups.map((g) => (
              <View key={g.date}>
                <View style={styles.dateBar}>
                  <Text>{g.date}</Text>
                  <Text>Daily Total  {fmt(g.dailyTotal)}</Text>
                </View>
                <View style={styles.head}>
                  <Text style={{ width: 80 }}>BillNo</Text>
                  <Text style={{ width: 140 }}>Payment Description</Text>
                  <Text style={{ width: 80, textAlign: "right" }}>Amount</Text>
                  <Text style={{ width: 90, paddingLeft: 8 }}>Remarks</Text>
                  <Text style={{ paddingLeft: 8 }}>Casher Name</Text>
                </View>
                {g.bills.map((b) => (
                  <View key={b.billNo}>
                    {b.payments.map((p, pi) => (
                      <View style={styles.row} key={pi}>
                        <Text style={{ width: 80 }}>{pi === 0 ? b.billNo : ""}</Text>
                        <Text style={{ width: 140 }}>{p.desc}</Text>
                        <Text style={{ width: 80, textAlign: "right" }}>{fmt(p.amount)}</Text>
                        <Text style={{ width: 90, paddingLeft: 8 }}>{pi === 0 ? b.remarks : ""}</Text>
                        <Text style={{ paddingLeft: 8 }}>{pi === 0 ? b.casher : ""}</Text>
                      </View>
                    ))}
                    <View style={styles.btot}>
                      <Text>{fmt(b.billTotal)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
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
