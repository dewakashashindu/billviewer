import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ColumnConfig } from "@/config/reports.config";

const styles = StyleSheet.create({
  page: { padding: 20, orientation: "landscape", fontSize: 8 },
  header: { textAlign: "center", marginBottom: 10 },
  title: { fontSize: 14, fontWeight: "bold" },
  table: { width: "100%", borderStyle: "solid", borderWidth: 1, borderColor: "#cbd5e1" },
  tableRow: { flexDirection: "row" },
  tableHeaderCell: { backgroundColor: "#bfdbfe", padding: 4, fontWeight: "bold", borderRightWidth: 1, borderRightColor: "#93c5fd" },
  tableCell: { padding: 4, borderRightWidth: 1, borderRightColor: "#e2e8f0", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
});

interface PdfProps {
  title: string;
  columns: ColumnConfig[];
  data: Record<string, any>[];
}

export default function ReportPdfDocument({ title, columns, data }: PdfProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            {columns.map((col, idx) => (
              <View key={idx} style={[styles.tableHeaderCell, { flex: 1 }]}>
                <Text>{col.header}</Text>
              </View>
            ))}
          </View>

          {data.map((row, rIdx) => (
            <View key={rIdx} style={styles.tableRow}>
              {columns.map((col, cIdx) => (
                <View key={cIdx} style={[styles.tableCell, { flex: 1 }]}>
                  <Text>{row[col.accessorKey] ?? ""}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}