// ============================================================
// LOCATION: components/reports/SalesSummaryPdfDocument.tsx
// ALUTH FILE — mekamama create karanna (PDF eka POS report eka wage)
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

interface Props {
  title: string;
  printDate: string;
  printTime: string;
  from: string;
  to: string;
  location: string;
  dateGroups: SummaryGroup[];
  grandTotal: number;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Courier", fontSize: 9, color: "#1a1a1a" },
  title: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Courier-Bold",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  infoLabel: { width: 80 },
  range: {
    fontFamily: "Courier-Bold",
    fontSize: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  location: {
    fontFamily: "Courier-Bold",
    fontSize: 11,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  groupDate: {
    fontFamily: "Courier-Bold",
    fontSize: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  row: { flexDirection: "row" },
  th: {
    backgroundColor: "#efefef",
    fontFamily: "Courier-Bold",
    padding: 4,
    fontSize: 8,
    borderRightWidth: 1,
    borderRightColor: "#cccccc",
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
  },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: "#e5e5e5" },
  bold: { fontFamily: "Courier-Bold" },
  right: { textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    marginTop: 2,
  },
  grandRow: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: "#1a1a1a",
    marginTop: 6,
    paddingTop: 4,
  },
});

const W = {
  billNo: 62,
  netTotal: 62,
  steward: 108,
  billType: 58,
  orderMode: 62,
  txnTime: 74,
  casher: 60,
};

export default function SalesSummaryPdfDocument({
  title,
  printDate,
  printTime,
  from,
  to,
  location,
  dateGroups,
  grandTotal,
}: Props) {
  return (
    <Document title={title} author="MICROECHEF">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>

        {/* Print info — right aligned like POS report */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Print Date   :</Text>
          <Text>{printDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Print Time   :</Text>
          <Text>{printTime}</Text>
        </View>

        <Text style={styles.range}>
          From {from} To {to}
        </Text>

        {location ? <Text style={styles.location}>{location}</Text> : null}

        {dateGroups.map((g) => (
          <View key={g.date}>
            <Text style={styles.groupDate}>{g.date}</Text>

            {/* Header */}
            <View style={styles.row}>
              <Text style={[styles.th, { width: W.billNo }]}>BillNo</Text>
              <Text style={[styles.th, { width: W.netTotal }]}>NetTotal</Text>
              <Text style={[styles.th, { width: W.steward }]}>Steward</Text>
              <Text style={[styles.th, { width: W.billType }]}>BillType</Text>
              <Text style={[styles.th, { width: W.orderMode }]}>OrderMode</Text>
              <Text style={[styles.th, { width: W.txnTime }]}>TxnTime</Text>
              <Text style={[styles.th, { width: W.casher }]}>Casher</Text>
            </View>

            {/* Bill rows */}
            {g.rows.map((r, i) => (
              <View style={styles.row} key={`${r.billNo}-${i}`}>
                <Text style={[styles.td, { width: W.billNo }]}>{r.billNo}</Text>
                <Text
                  style={[styles.td, { width: W.netTotal }, styles.right]}
                >
                  {fmt(r.netTotal)}
                </Text>
                <Text style={[styles.td, { width: W.steward }]}>
                  {r.steward}
                </Text>
                <Text style={[styles.td, { width: W.billType }]}>
                  {r.billType}
                </Text>
                <Text style={[styles.td, { width: W.orderMode }]}>
                  {r.orderMode}
                </Text>
                <Text style={[styles.td, { width: W.txnTime }]}>
                  {r.txnTime}
                </Text>
                <Text style={[styles.td, { width: W.casher }]}>{r.casher}</Text>
              </View>
            ))}

            {/* Daily collection */}
            <View style={styles.totalRow}>
              <Text style={[styles.td, { width: W.billNo }]} />
              <Text
                style={[
                  styles.td,
                  { width: W.netTotal },
                  styles.right,
                  styles.bold,
                ]}
              >
                {fmt(g.dayTotal)}
              </Text>
              <Text
                style={[
                  styles.td,
                  { width: W.steward + W.billType + W.orderMode + W.txnTime + W.casher },
                  styles.bold,
                ]}
              >
                Daily Collection
              </Text>
            </View>
          </View>
        ))}

        {/* Grand total */}
        <View style={styles.grandRow}>
          <Text style={[styles.td, { width: W.billNo }]} />
          <Text
            style={[
              styles.td,
              { width: W.netTotal },
              styles.right,
              styles.bold,
            ]}
          >
            {fmt(grandTotal)}
          </Text>
          <Text
            style={[
              styles.td,
              {
                width:
                  W.steward + W.billType + W.orderMode + W.txnTime + W.casher,
              },
              styles.bold,
            ]}
          >
            Grand Total
          </Text>
        </View>
      </Page>
    </Document>
  );
}
