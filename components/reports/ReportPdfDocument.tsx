// ============================================================
// LOCATION: components/reports/ReportPdfDocument.tsx
// FULL REPLACE — generic report PDF (pro look, table-alike):
//   centered title + From/To line + dark header row + zebra
//   rows + right-aligned numbers + totals footer
// ============================================================
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ColumnConfig } from "@/config/reports.config";

const styles = StyleSheet.create({
  page: { padding: 24, orientation: "landscape", fontSize: 8, color: "#0f172a" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center", marginBottom: 4 },
  range: { fontSize: 9, fontWeight: "bold", textAlign: "center", marginBottom: 10 },
  table: {
    width: "100%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  row: { flexDirection: "row" },
  th: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    padding: 5,
    fontWeight: "bold",
    fontSize: 7.5,
    borderRightWidth: 1,
    borderRightColor: "#334155",
  },
  td: {
    padding: 4,
    fontSize: 7.5,
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  zebra: { backgroundColor: "#f8fafc" },
  bold: { fontWeight: "bold", backgroundColor: "#f1f5f9" },
  right: { textAlign: "right" },
});

interface PdfProps {
  title: string;
  from?: string;
  to?: string;
  columns: ColumnConfig[];
  data: Record<string, any>[];
}

const isNum = (t?: string) => t === "currency" || t === "number";
const fmt = (v: any, type?: string) => {
  if (v === undefined || v === null || v === "") return "";
  if (type === "number") return Number(v).toLocaleString("en-US");
  if (type === "currency")
    return Number(v).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return String(v);
};

export default function ReportPdfDocument({
  title,
  from,
  to,
  columns,
  data,
}: PdfProps) {
  const totals: Record<string, number> = {};
  if (data.length > 1) {
    for (const col of columns) {
      if (isNum(col.type)) {
        totals[col.accessorKey] = data.reduce(
          (s, r) => s + (Number(r[col.accessorKey]) || 0),
          0
        );
      }
    }
  }

  return (
    <Document title={title} author="MICROECHEF">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {from && to ? (
          <Text style={styles.range}>
            From {from} To {to}
          </Text>
        ) : null}

        <View style={styles.table}>
          {/* header */}
          <View style={styles.row}>
            {columns.map((col, idx) => (
              <View
                key={idx}
                style={[
                  styles.th,
                  { flex: 1 },
                  isNum(col.type) ? styles.right : undefined,
                ]}
              >
                <Text>{col.header}</Text>
              </View>
            ))}
          </View>

          {/* rows */}
          {data.map((row, rIdx) => (
            <View
              key={rIdx}
              style={[styles.row, rIdx % 2 === 1 ? styles.zebra : undefined]}
            >
              {columns.map((col, cIdx) => (
                <View
                  key={cIdx}
                  style={[
                    styles.td,
                    { flex: 1 },
                    isNum(col.type) ? styles.right : undefined,
                  ]}
                >
                  <Text>{fmt(row[col.accessorKey], col.type)}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* totals footer */}
          {data.length > 1 && Object.keys(totals).length > 0 && (
            <View style={styles.row}>
              {columns.map((col, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.td,
                    { flex: 1 },
                    styles.bold,
                    isNum(col.type) ? styles.right : undefined,
                  ]}
                >
                  <Text>
                    {idx === 0
                      ? `TOTAL (${data.length})`
                      : totals[col.accessorKey] != null
                      ? fmt(totals[col.accessorKey], col.type)
                      : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
