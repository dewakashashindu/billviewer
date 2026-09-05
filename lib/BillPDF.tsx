import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import {
  getBillTotalRows,
  RESTAURANT_INFO,
  statusReceiptWord,
  type Bill,
} from "./billFormat";

// Built-in Courier / Courier-Bold / Times-Bold families are used (no external fonts)

const INK = "#1a1a1a";
const SOFT = "#555555";

const fmt = (n: number) =>
  n.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    padding: 36,
    fontFamily: "Courier",
    color: INK,
    fontSize: 10.5,
  },
  header: { alignItems: "center", marginBottom: 6 },
  logo: { width: 110, height: 55, objectFit: "contain", marginBottom: 8 },
  restaurantName: {
    fontSize: 17,
    fontFamily: "Times-Bold",
    color: INK,
    marginBottom: 3,
  },
  addressLine: { fontSize: 9.5, color: INK, marginTop: 1 },
  dashed: {
    borderTopWidth: 1,
    borderTopColor: "#2b2b2b",
    borderTopStyle: "dashed",
    marginVertical: 10,
  },
  tblBox: {
    borderWidth: 1,
    borderColor: "#2b2b2b",
    borderStyle: "dashed",
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    textAlign: "center",
    fontFamily: "Courier-Bold",
    fontSize: 12,
    letterSpacing: 1,
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  metaLine: { marginBottom: 3 },
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Courier-Bold",
    fontSize: 10,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  itemBlock: { marginBottom: 7 },
  itemRow: { flexDirection: "row", justifyContent: "space-between" },
  itemName: { fontFamily: "Courier-Bold", fontSize: 10.5, maxWidth: 280 },
  itemAmt: { fontSize: 10.5 },
  itemSub: { fontSize: 8.5, color: SOFT, marginTop: 1 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Courier-Bold",
    fontSize: 12.5,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2b2b2b",
    borderTopStyle: "dashed",
  },
  center: { textAlign: "center", fontSize: 9, color: SOFT },
});

export function BillPDFDocument({ bill }: { bill: Bill }) {
  const isTakeaway = bill.orderMode?.toUpperCase() === "TA";
  const boxLabel = isTakeaway
    ? (bill.orderModeDes || "TAKE AWAY").toUpperCase()
    : `TBL : ${bill.tableName}`;
  const showModeLine =
    bill.orderModeDes && !isTakeaway ? bill.orderModeDes : null;

  return (
    <Document
      title={`eReceipt - ${bill.billNumber}`}
      author={RESTAURANT_INFO.name}
      subject="Digital eReceipt"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image style={styles.logo} src={RESTAURANT_INFO.logoPath} />
          <Text style={styles.restaurantName}>{RESTAURANT_INFO.name}</Text>
          {RESTAURANT_INFO.city ? (
            <Text style={styles.addressLine}>{RESTAURANT_INFO.city}</Text>
          ) : null}
          {RESTAURANT_INFO.addressLines.map((l) => (
            <Text key={l} style={styles.addressLine}>
              {l}
            </Text>
          ))}
          {bill.locationName ? (
            <Text
              style={{
                fontSize: 11,
                marginTop: 5,
                fontFamily: "Courier-Bold",
                color: INK,
              }}
            >
              {bill.locationName}
            </Text>
          ) : null}
        </View>

        <View style={styles.dashed} />

        {/* TBL / TAKEAWAY */}
        <View style={styles.tblBox}>
          <Text>{boxLabel}</Text>
        </View>

        <View style={styles.dashed} />

        {/* Meta */}
        <View style={styles.metaRow}>
          <Text>
            <Text style={{ fontFamily: "Courier-Bold" }}>INV: </Text>
            {bill.billNumber}
          </Text>
          <Text>
            <Text style={{ fontFamily: "Courier-Bold" }}>STS: </Text>
            {statusReceiptWord(bill.status)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text>
            <Text style={{ fontFamily: "Courier-Bold" }}>DAT: </Text>
            {bill.date}
          </Text>
          {bill.time ? (
            <Text>
              <Text style={{ fontFamily: "Courier-Bold" }}>TIM: </Text>
              {bill.time}
            </Text>
          ) : null}
        </View>
        {bill.noOfPax != null && bill.noOfPax > 0 ? (
          <View style={styles.metaLine}>
            <Text>
              <Text style={{ fontFamily: "Courier-Bold" }}>PAX: </Text>
              {bill.noOfPax}
            </Text>
          </View>
        ) : null}
        {showModeLine ? (
          <View style={styles.metaLine}>
            <Text>
              <Text style={{ fontFamily: "Courier-Bold" }}>Mode: </Text>
              {showModeLine}
            </Text>
          </View>
        ) : null}
        {bill.stewardName ? (
          <View style={styles.metaLine}>
            <Text>
              <Text style={{ fontFamily: "Courier-Bold" }}>Steward: </Text>
              {bill.stewardName}
            </Text>
          </View>
        ) : null}
        {bill.cashierName ? (
          <View style={styles.metaLine}>
            <Text>
              <Text style={{ fontFamily: "Courier-Bold" }}>Cashier: </Text>
              {bill.cashierName}
            </Text>
          </View>
        ) : null}
        {!bill.stewardName && !bill.cashierName && bill.serverName ? (
          <View style={styles.metaLine}>
            <Text>
              <Text style={{ fontFamily: "Courier-Bold" }}>Server: </Text>
              {bill.serverName}
            </Text>
          </View>
        ) : null}
        {bill.customerName || bill.customerPhone ? (
          <View style={styles.metaLine}>
            <Text>
              <Text style={{ fontFamily: "Courier-Bold" }}>Customer: </Text>
              {bill.customerName ? `${bill.customerName} ` : ""}
              {bill.customerPhone ? `(${bill.customerPhone})` : ""}
            </Text>
          </View>
        ) : null}

        <View style={styles.dashed} />

        {/* Items */}
        <View style={styles.itemsHeader}>
          <Text>DESCRIPTION</Text>
          <Text>AMOUNT</Text>
        </View>
        {bill.items.map((item, idx) => (
          <View key={idx} style={styles.itemBlock}>
            <View style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemAmt}>{fmt(item.price)}</Text>
            </View>
            {item.unitPrice != null && item.qty != null ? (
              <Text style={styles.itemSub}>
                {item.qty} x Rs. {fmt(item.unitPrice)}
              </Text>
            ) : null}
          </View>
        ))}

        <View style={styles.dashed} />

        {/* Totals */}
        {getBillTotalRows(bill).map((row) => (
          <View key={row.label} style={styles.totalRow}>
            <Text>{row.label}</Text>
            <Text>{fmt(row.value)}</Text>
          </View>
        ))}

        {/* Grand total */}
        <View style={styles.grandRow}>
          <Text>GRAND TOTAL</Text>
          <Text>Rs. {fmt(bill.grandTotal)}</Text>
        </View>

        {/* Payments */}
        {bill.payments && bill.payments.length > 0 ? (
          <Text style={[styles.center, { marginTop: 10 }]}>
            Paid via{" "}
            {bill.payments.map((p) => `${p.method} (Rs. ${fmt(p.amount)})`).join(", ")}
          </Text>
        ) : null}

        <Text style={[styles.center, { marginTop: 12 }]}>
          Thank you for dining with {RESTAURANT_INFO.name}!
        </Text>
      </Page>
    </Document>
  );
}
