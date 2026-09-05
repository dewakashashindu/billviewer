"use client";

import { ColumnConfig } from "@/config/reports.config";

interface DynamicTableProps {
  columns: ColumnConfig[];
  data: Record<string, any>[];
}

export default function DynamicReportTable({ columns, data }: DynamicTableProps) {
  const formatCell = (value: any, type?: string) => {
    if (value === undefined || value === null) return "-";
    if (type === "currency") {
      return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return value;
  };

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-blue-100 text-blue-900 uppercase font-bold border-b border-blue-200">
          <tr>
            {columns.map((col: ColumnConfig) => (
              <th
                key={col.accessorKey}
                className={`p-2.5 border-r border-blue-200 ${
                  col.type === "currency" || col.type === "number" ? "text-right" : "text-left"
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center p-4 text-slate-500">
                No report data available.
              </td>
            </tr>
          ) : (
            data.map((row: Record<string, any>, idx: number) => (
              <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                {columns.map((col: ColumnConfig) => (
                  <td
                    key={col.accessorKey}
                    className={`p-2 border-r border-slate-100 ${
                      col.type === "currency" || col.type === "number" ? "text-right" : "text-left"
                    }`}
                  >
                    {formatCell(row[col.accessorKey], col.type)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}