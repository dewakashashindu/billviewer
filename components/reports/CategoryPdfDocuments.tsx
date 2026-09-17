// ============================================================
// LOCATION: components/reports/CategoryPdfDocuments.tsx
// ✅ 1.3.1 / 1.3.2 PDFs — POS print eke wage location-wise:
//    category sections + sub categories + totals + grand total.
// ============================================================
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CatSummaryData, CatDetailData } from "./CategoryReports";

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
  cat: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#efefef",
    padding: "3 6",
    marginTop: 6,
    fontFamily: "Helvetica-Bold",
  },
  sub: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "2 6 2 14",
    fontFamily: "Helvetica-Bold",
    color: "#333",
  },
  row: { flexDirection: "row", justifyContent: "space-between", padding: "1.5 6 1.5 22" },
  dRow: { flexDirection: "row", padding: "1.5 6", borderBottom: 0.4, borderColor: "#e3e3e3" },
  dHead: {
    flexDirection: "row",
    padding: "3 6",
    backgroundColor: "#efefef",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
  },
  tot: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "2 6",
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
});

interface BaseProps {
  title: string;
  printDate: string;
  printTime: string;
  from: string;
  to: string;
}

export function CategorySummaryPdfDocument({
  title,
  printDate,
  printTime,
  from,
  to,
  data,
}: BaseProps & { data: CatSummaryData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.infoRow}>
          <Text>Print Date : {printDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text>Print Time : {printTime}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text>From : {from}  To : {to}</Text>
        </View>

        {data.locationGroups.map((loc) => (
          <View key={loc.locCode}>
            <View style={styles.locBar}>
              <Text>{loc.locCode}  {loc.locName}</Text>
              <Text>{fmt(loc.locTotal)}</Text>
            </View>
            {loc.cats.map((c) => (
              <View key={c.level1}>
                <View style={styles.cat}>
                  <Text>{c.level1}</Text>
                  <Text>{fmt(c.total)}</Text>
                </View>
                {c.subs.map((s, si) => (
                  <View key={si}>
                    {(s.level2 || s.level3) && (
                      <View style={styles.sub}>
                        <Text>{[s.level2, s.level3].filter(Boolean).join(" / ")}</Text>
                        <Text>{fmt(s.total)}</Text>
                      </View>
                    )}
                    {s.items.map((it, ii) => (
                      <View style={styles.row} key={ii}>
                        <Text>{it.name}</Text>
                        <Text>{fmt(it.total)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
                <View style={styles.tot}>
                  <Text>Category Total</Text>
                  <Text>{fmt(c.total)}</Text>
                </View>
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

export function CategoryDetailPdfDocument({
  title,
  printDate,
  printTime,
  from,
  to,
  data,
}: BaseProps & { data: CatDetailData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.infoRow}>
          <Text>Print Date : {printDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text>Print Time : {printTime}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text>From : {from}  To : {to}</Text>
        </View>

        {data.locationGroups.map((loc) => (
          <View key={loc.locCode}>
            <View style={styles.locBar}>
              <Text>{loc.locCode}  {loc.locName}</Text>
              <Text>{fmt(loc.locTotal)}</Text>
            </View>
            <View style={styles.dHead}>
              <Text style={{ width: 70 }}>BillNO</Text>
              <Text style={{ width: 150 }}>MenuitemNM</Text>
              <Text style={{ width: 70, textAlign: "right" }}>SaleTotal</Text>
              <Text style={{ width: 70, paddingLeft: 8 }}>OrderMode</Text>
              <Text style={{ width: 120, paddingLeft: 8 }}>TxnTime</Text>
              <Text style={{ paddingLeft: 8 }}>Steward</Text>
            </View>
            {loc.cats.map((c) => (
              <View key={c.level1}>
                <View style={styles.cat}>
                  <Text>{c.level1}</Text>
                  <Text>{fmt(c.total)}</Text>
                </View>
                {c.subs.map((s, si) => (
                  <View key={si}>
                    <View style={styles.sub}>
                      <Text>{[s.level2, s.level3].filter(Boolean).join(" / ") || "—"}</Text>
                      <Text>{fmt(s.total)}</Text>
                    </View>
                    {s.rows.map((r, ri) => (
                      <View style={styles.dRow} key={ri}>
                        <Text style={{ width: 70 }}>{r.billNo}</Text>
                        <Text style={{ width: 150 }}>{r.item}</Text>
                        <Text style={{ width: 70, textAlign: "right" }}>{fmt(r.saleTotal)}</Text>
                        <Text style={{ width: 70, paddingLeft: 8 }}>{r.orderMode}</Text>
                        <Text style={{ width: 120, paddingLeft: 8 }}>{r.txnDate} {r.txnTime}</Text>
                        <Text style={{ paddingLeft: 8 }}>{r.steward}</Text>
                      </View>
                    ))}
                  </View>
                ))}
                <View style={styles.tot}>
                  <Text>Main Category Total</Text>
                  <Text>{fmt(c.total)}</Text>
                </View>
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
