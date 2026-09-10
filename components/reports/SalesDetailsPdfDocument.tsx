// ============================================================
// LOCATION: components/reports/SalesDetailsPdfDocument.tsx
// ALUTH FILE — mekamama create karanna
// Sales Details PDF — POS "Sales Details" print eka wage:
//   centered title + Print Date/Time + From/To + date bands
//   + bill item rows + per-bill totals box (Net Total bold)
// ============================================================
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  SalesDetailsData,
  DetBill,
} from "./SalesDetailsReport";

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtQty = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, color: "#1a1a1a" },
  title: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
  },
  infoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  infoLabel: { width: 70 },
  range: { fontWeight: "bold", fontSize: 9, marginTop: 6, marginBottom: 8 },
  locBand: {
    backgroundColor: "#1e3a5f",
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 9.5,
    padding: "4px 6px",
    marginTop: 10,
    marginBottom: 2,
  },
  dateBand: {
    backgroundColor: "#e5e5e5",
    fontWeight: "bold",
    fontSize: 9,
    padding: "3px 6px",
    marginTop: 6,
    marginBottom: 4,
  },
  billNo: { fontWeight: "bold", fontSize: 8.5, marginBottom: 2 },
  itemRow: { flexDirection: "row", marginBottom: 1, paddingLeft: 14 },
  cName: { flex: 1, paddingRight: 6 },
  cQty: { width: 44, textAlign: "right" },
  cPrice: { width: 62, textAlign: "right" },
  cTot: { width: 70, textAlign: "right" },
  boxWrap: { flexDirection: "row", justifyContent: "flex-end", marginVertical: 4 },
  box: {
    width: 200,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    padding: 5,
  },
  boxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1.5,
  },
  boxNet: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: "bold",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    paddingTop: 2,
    marginTop: 1,
  },
  billSep: { borderBottomWidth: 0.7, borderBottomColor: "#cccccc", marginVertical: 5 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: "bold",
    fontSize: 10,
    borderTopWidth: 1.5,
    borderTopColor: "#1a1a1a",
    marginTop: 10,
    paddingTop: 4,
  },
});

interface Props {
  title: string;
  printDate: string;
  printTime: string;
  from: string;
  to: string;
  locationGroups: SalesDetailsData["locationGroups"];
}

function BillBlock({ bill }: { bill: DetBill }) {
  const t = bill.totals;
  const boxRows: { label: string; value: number }[] = [
    { label: "Gross", value: t.gross },
    {
      label: t.discountPre
        ? `Discount (${fmtQty(t.discountPre)} %)`
        : "Discount",
      value: t.discount,
    },
    { label: "Gross After Dis.", value: t.grossAfterDis },
    { label: "Service Charge", value: t.serviceCharge },
    { label: "Other Service Charge", value: t.otherServiceCharge },
    { label: "VAT", value: t.vat },
    { label: "Other Vat", value: t.otherVat },
    { label: "TDL", value: t.tdl },
    { label: "Packing Charge", value: t.packingCharge },
    { label: "Delivery Charge", value: t.deliveryCharge },
  ];
  return (
    <View>
      <Text style={styles.billNo}>{bill.billNo}</Text>
      {bill.items.map((it, i) => (
        <View style={styles.itemRow} key={i}>
          <Text style={styles.cName}>{it.name}</Text>
          <Text style={styles.cQty}>{fmtQty(it.qty)}</Text>
          <Text style={styles.cPrice}>{fmt(it.salesPrice)}</Text>
          <Text style={styles.cTot}>{fmt(it.totItemPrice)}</Text>
        </View>
      ))}
      <View style={styles.boxWrap}>
        <View style={styles.box}>
          {boxRows.map((r) => (
            <View style={styles.boxRow} key={r.label}>
              <Text>{r.label}</Text>
              <Text>{fmt(r.value)}</Text>
            </View>
          ))}
          <View style={styles.boxNet}>
            <Text>Net Total</Text>
            <Text>{fmt(t.netTotal)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.billSep} />
    </View>
  );
}

export default function SalesDetailsPdfDocument({
  title,
  printDate,
  printTime,
  from,
  to,
  locationGroups,
}: Props) {
  const grandTotal = locationGroups.reduce((s, l) => s + l.locNetTotal, 0);
  return (
    <Document title={title} author="MICROECHEF">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>

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

        {locationGroups.map((loc) => (
          <View key={loc.locCode}>
            <Text style={styles.locBand}>
              {loc.locName}  —  Location Total {fmt(loc.locNetTotal)}
            </Text>
            {loc.dateGroups.map((g) => (
              <View key={g.date}>
                <Text style={styles.dateBand}>{g.date}</Text>
                {g.bills.map((b) => (
                  <BillBlock bill={b} key={b.billNo} />
                ))}
              </View>
            ))}
          </View>
        ))}

        <View style={styles.grandRow}>
          <Text>Grand Total</Text>
          <Text>{fmt(grandTotal)}</Text>
        </View>
      </Page>
    </Document>
  );
}
