import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

interface BillItem {
  name: string;
  price: number;
}

interface Bill {
  billNumber: string;
  tableName: string;
  serverName: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  tip: number;
  grandTotal: number;
  status: "PAID" | "PENDING" | "CANCELLED";
}

// Styles
const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontFamily: "Helvetica",
  },

  // Top accent bar
  accentBar: {
    height: 5,
    backgroundColor: "#003D9B",
    marginBottom: 32,
    borderRadius: 2,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 28,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    borderBottomStyle: "solid",
  },
  restaurantName: {
    color: "#003D9B",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  billTitle: {
    color: "#191C1E",
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  billMeta: {
    color: "#434654",
    fontSize: 10,
    fontFamily: "Helvetica",
  },

  // Status badge
  statusBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#DCFCE7",
    borderRadius: 99,
  },
  statusText: {
    color: "#16a34a",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },

  // Bill number row
  billNumberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0F4FF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  billNumberLabel: {
    color: "#434654",
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  billNumberValue: {
    color: "#003D9B",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },

  // Items section
  sectionTitle: {
    color: "#191C1E",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    borderBottomStyle: "solid",
  },
  itemName: {
    color: "#191C1E",
    fontSize: 11,
    fontFamily: "Helvetica",
    flex: 1,
  },
  itemPrice: {
    color: "#191C1E",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "#DDDDDD",
    marginVertical: 20,
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#DDDDDD",
    borderBottomStyle: "dashed",
    marginVertical: 20,
  },

  // Totals
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totalLabel: {
    color: "#434654",
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  totalValue: {
    color: "#434654",
    fontSize: 11,
    fontFamily: "Helvetica",
  },

  // Grand Total
  grandTotalBox: {
    backgroundColor: "#F0F4FF",
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(0,61,155,0.1)",
    borderStyle: "solid",
  },
  grandTotalLabel: {
    color: "#191C1E",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  grandTotalValue: {
    color: "#003D9B",
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },

  // Footer
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    borderTopStyle: "solid",
    alignItems: "center",
  },
  footerText: {
    color: "#9496A1",
    fontSize: 9,
    fontFamily: "Helvetica",
    marginBottom: 4,
    textAlign: "center",
  },
  footerBrand: {
    color: "#003D9B",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },

  // Promo section
  promoBox: {
    marginTop: 24,
    backgroundColor: "#FFF8F0",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,140,0,0.25)",
    borderStyle: "solid",
  },
  promoTitle: {
    color: "#FF8C00",
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  promoDesc: {
    color: "#434654",
    fontSize: 9,
    fontFamily: "Helvetica",
    marginBottom: 8,
    lineHeight: 1.5,
  },
  promoCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  promoCodeLabel: {
    color: "#434654",
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  promoCode: {
    color: "#003D9B",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
  },
});

// PDF Document Component
export function BillPDFDocument({ bill }: { bill: Bill }) {
  return (
    <Document
      title={`MICROECHEF Bill - ${bill.billNumber}`}
      author="MICROECHEF"
      subject="Digital Bill"
    >
      <Page size="A4" style={styles.page}>
        {/* Accent Bar */}
        <View style={styles.accentBar} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.restaurantName}>MICROECHEF</Text>
          <Text style={styles.billTitle}>Your Bill</Text>
          <Text style={styles.billMeta}>
            {bill.tableName} • Server: {bill.serverName} • {bill.date}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  bill.status === "PAID" ? "#DCFCE7" : "#FEF9C3",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: bill.status === "PAID" ? "#16a34a" : "#ca8a04" },
              ]}
            >
              {bill.status === "PAID" ? "✓ PAID" : "⏳ PENDING"}
            </Text>
          </View>
        </View>

        {/* Bill Number Row */}
        <View style={styles.billNumberRow}>
          <Text style={styles.billNumberLabel}>Bill Number</Text>
          <Text style={styles.billNumberValue}>#{bill.billNumber}</Text>
        </View>

        {/* Items Section */}
        <Text style={styles.sectionTitle}>Order Items</Text>
        {bill.items.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>
              Rs.{" "}
              {item.price.toLocaleString("en-LK", {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        ))}

        {/* Dashed Divider */}
        <View style={styles.dashedDivider} />

        {/* Totals */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>
            Rs.{" "}
            {bill.subtotal.toLocaleString("en-LK", {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax (8%)</Text>
          <Text style={styles.totalValue}>
            Rs.{" "}
            {bill.tax.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tip</Text>
          <Text style={styles.totalValue}>
            Rs.{" "}
            {bill.tip.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
          </Text>
        </View>

        {/* Grand Total */}
        <View style={styles.grandTotalBox}>
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalValue}>
            Rs.{" "}
            {bill.grandTotal.toLocaleString("en-LK", {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        {/* Promo Box */}
        <View style={styles.promoBox}>
          <Text style={styles.promoTitle}>🎁 15% OFF on your next visit!</Text>
          <Text style={styles.promoDesc}>
            Get an exclusive discount on your next dine-in. Valid for 30 days.
          </Text>
          <View style={styles.promoCodeRow}>
            <Text style={styles.promoCodeLabel}>Use Code:</Text>
            <Text style={styles.promoCode}>CHEF15</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>MICROECHEF</Text>
          <Text style={styles.footerText}>
            Thank you for dining with us! We look forward to serving you again.
          </Text>
          <Text style={styles.footerText}>
            © 2026 MICROECHEF. All rights reserved.
          </Text>
        </View>
      </Page>
    </Document>
  );
}