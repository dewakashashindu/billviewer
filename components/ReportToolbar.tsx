"use client";

// ============================================================
// LOCATION: components/ReportToolbar.tsx
// FULL REPLACE — professional toolbar (SVG icons, no emoji):
//
//   Row 1: [icon] Report Title + subtitle      [Download PDF]
//   Row 2: Search | From/To dates | Zoom | Chart | Share
//   Row 3: quick range chips (Today/Yesterday/...)
//
//   Zoom    — report content ONLY (#report-zoom-area, 70-150%)
//   Share   — PDF blob -> WhatsApp / Email / Device / Copy link
//   Chart   — toggle chart view (chartSupported=true only)
// ============================================================
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  IconSearch,
  IconCalendar,
  IconMinus,
  IconPlus,
  IconBarChart,
  IconShare,
  IconTable,
  IconDownload,
  IconFileText,
  IconChat,
  IconMail,
  IconPhone,
  IconLink,
  IconCheck,
} from "./reports/ReportIcons";

// PDFDownloadLink — SSR crash avoid karanna (web-only API -> client-only load)
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m: any) => m.PDFDownloadLink),
  { ssr: false }
) as any;

// local date (toISOString UTC nisa Sri Lanka +5:30 wala day shift wela
// 31/Dec wage wenna) — me nisa local parts use karanawa
const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export interface QuickRange {
  label: string;
  get: () => [string, string];
}

const QUICK_RANGES: QuickRange[] = [
  { label: "Today", get: () => [iso(new Date()), iso(new Date())] },
  {
    label: "Yesterday",
    get: () => {
      const y = new Date(Date.now() - 86400000);
      return [iso(y), iso(y)];
    },
  },
  {
    label: "This Week",
    get: () => {
      const d = new Date();
      const day = d.getDay() || 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - day + 1);
      return [iso(mon), iso(d)];
    },
  },
  {
    label: "This Month",
    get: () => {
      const n = new Date();
      return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(n)];
    },
  },
  {
    label: "This Year",
    get: () => {
      const n = new Date();
      return [iso(new Date(n.getFullYear(), 0, 1)), iso(n)];
    },
  },
  {
    label: "Last 30 Days",
    get: () => [iso(new Date(Date.now() - 30 * 86400000)), iso(new Date())],
  },
];

export interface ReportToolbarProps {
  title: string;
  subtitle?: string;
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;

  /** Search value — report component ekata pass wenawa */
  search: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;

  /** PDF document React element (undefined nam share + PDF buttons hidden) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDocument?: React.ReactElement<any>;
  pdfFileName?: string;

  /** Chart toggle — supported reports walata witharak */
  chartSupported?: boolean;
  chartMode?: boolean;
  onChartToggle?: () => void;

  /** Search box eka pennanawada? (default: true) */
  searchable?: boolean;
}

// ── shared control styles ──
const CONTROL_H = 36;
const grad = "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)";

const ghostBtn: React.CSSProperties = {
  height: CONTROL_H,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 9,
  cursor: "pointer",
  flexShrink: 0,
};

const dateInput: React.CSSProperties = {
  height: CONTROL_H,
  border: "1px solid #e2e8f0",
  borderRadius: 9,
  padding: "0 10px",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#0f172a",
  background: "#ffffff",
  outline: "none",
  fontFamily: "inherit",
};

export default function ReportToolbar({
  title,
  subtitle,
  from,
  to,
  onRangeChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  pdfDocument,
  pdfFileName = "report.pdf",
  chartSupported = false,
  chartMode = false,
  onChartToggle,
  searchable = true,
}: ReportToolbarProps) {
  const [zoom, setZoom] = useState(100);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement | null>(null);

  // zoom — report content container ekatama (CSS zoom)
  useEffect(() => {
    const el = document.getElementById("report-zoom-area");
    if (el) {
      el.style.zoom = `${zoom}%`;
    }
  }, [zoom]);

  // outside click — share menu close
  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareOpen]);

  const shareUrl = () =>
    typeof window !== "undefined" ? window.location.href : "";

  async function buildPdfBlob(): Promise<Blob | null> {
    if (!pdfDocument) return null;
    try {
      const ReactPDF = await import("@react-pdf/renderer");
      const { pdf } = ReactPDF as any;
      const el = pdfDocument as any;
      const blob = await (pdf as (el: any) => { toBlob: () => Promise<Blob> })(
        el
      ).toBlob();
      return blob;
    } catch (e) {
      console.error("PDF build failed:", e);
      return null;
    }
  }

  async function shareTo(target: "whatsapp" | "email" | "copy" | "native") {
    setShareMsg(null);
    const url = shareUrl();
    const text = `${title} (${from} to ${to})`;

    if (target === "native") {
      const blob = await buildPdfBlob();
      const nav = navigator as any;
      if (blob && nav.canShare?.({ files: [new File([blob], pdfFileName, { type: "application/pdf" })] })) {
        const file = new File([blob], pdfFileName, { type: "application/pdf" });
        try {
          await nav.share({ title, text, files: [file] });
          setShareOpen(false);
          return;
        } catch {
          /* user cancelled */
        }
      }
      setShareMsg("Direct share not supported — use WhatsApp or Email");
      return;
    }

    if (target === "whatsapp") {
      const blob = await buildPdfBlob();
      if (blob) {
        const file = new File([blob], pdfFileName, { type: "application/pdf" });
        const nav = navigator as any;
        if (nav.canShare?.({ files: [file] })) {
          try {
            await nav.share({ files: [file], title, text });
            setShareOpen(false);
            return;
          } catch {
            /* cancelled */
          }
        }
      }
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${title} (${from} to ${to}) — ${url}`)}`,
        "_blank"
      );
      setShareOpen(false);
      return;
    }

    if (target === "email") {
      const blob = await buildPdfBlob();
      let attachmentNote = "";
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        attachmentNote = " (PDF downloaded — attach it to this email)";
      }
      window.location.href = `mailto:?subject=${encodeURIComponent(
        title
      )}&body=${encodeURIComponent(`${text}\n${url}${attachmentNote}`)}`;
      setShareOpen(false);
      return;
    }

    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setShareMsg("Link copied");
      } catch {
        setShareMsg("Copy failed");
      }
      return;
    }
  }

  const shareItems: {
    key: "whatsapp" | "email" | "native" | "copy";
    label: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
  }[] = [
    {
      key: "whatsapp",
      label: "Share via WhatsApp",
      icon: <IconChat size={14} />,
      iconBg: "#e8f9ef",
      iconColor: "#16a34a",
    },
    {
      key: "email",
      label: "Share via Email",
      icon: <IconMail size={14} />,
      iconBg: "#eef2ff",
      iconColor: "#4f46e5",
    },
    {
      key: "native",
      label: "Share (device) with PDF",
      icon: <IconPhone size={14} />,
      iconBg: "#f0f9ff",
      iconColor: "#0284c7",
    },
    {
      key: "copy",
      label: "Copy link",
      icon: <IconLink size={14} />,
      iconBg: "#f1f5f9",
      iconColor: "#475569",
    },
  ];

  return (
    <div
      style={{
        padding: "14px 22px 12px",
        borderBottom: "1px solid #e2e8f0",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 11,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* ── ROW 1: title + subtitle + Download PDF ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: grad,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 2px 6px rgba(15,23,42,0.25)",
          }}
        >
          <IconFileText size={18} strokeWidth={1.8} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 15.5,
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: -0.2,
              lineHeight: 1.25,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                color: "#64748b",
                lineHeight: 1.35,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {pdfDocument && (
          <PDFDownloadLink
            document={pdfDocument as any}
            fileName={pdfFileName}
            style={{
              ...ghostBtn,
              background: grad,
              border: "none",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 12,
              padding: "0 15px",
              whiteSpace: "nowrap",
              textDecoration: "none",
              boxShadow: "0 2px 6px rgba(15,23,42,0.25)",
            }}
          >
            {({ loading: pdfLoading }: any) =>
              pdfLoading ? (
                "Preparing PDF..."
              ) : (
                <>
                  <IconDownload size={14} strokeWidth={2.2} />
                  Download PDF
                </>
              )
            }
          </PDFDownloadLink>
        )}
      </div>

      {/* ── ROW 2: search + dates + zoom + chart + share ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {searchable && (
          <div style={{ position: "relative", flex: "1 1 210px", maxWidth: 300, minWidth: 180 }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                display: "flex",
              }}
            >
              <IconSearch size={15} />
            </span>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: CONTROL_H,
                border: "1px solid #e2e8f0",
                borderRadius: 9,
                padding: "0 10px 0 32px",
                fontSize: 12.5,
                color: "#0f172a",
                background: "#f8fafc",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        )}

        {/* From / To */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid #e2e8f0",
            borderRadius: 9,
            padding: "0 8px",
            height: CONTROL_H,
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <IconCalendar size={14} style={{ color: "#64748b" }} />
          <input
            type="date"
            value={from}
            onChange={(e) => onRangeChange(e.target.value, to)}
            style={{ ...dateInput, border: "none", padding: 0, width: 118 }}
          />
          <span style={{ color: "#cbd5e1", fontSize: 11 }}>to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => onRangeChange(from, e.target.value)}
            style={{ ...dateInput, border: "none", padding: 0, width: 118 }}
          />
        </div>

        {/* Zoom */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: CONTROL_H,
            border: "1px solid #e2e8f0",
            borderRadius: 9,
            overflow: "hidden",
            flexShrink: 0,
            background: "#ffffff",
          }}
        >
          <button
            onClick={() => setZoom((z) => Math.max(70, z - 10))}
            disabled={zoom <= 70}
            title="Zoom out"
            style={{
              width: 32,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "transparent",
              color: "#334155",
              cursor: zoom <= 70 ? "default" : "pointer",
              opacity: zoom <= 70 ? 0.35 : 1,
            }}
          >
            <IconMinus size={14} strokeWidth={2.2} />
          </button>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#0f172a",
              minWidth: 42,
              textAlign: "center",
              borderLeft: "1px solid #e2e8f0",
              borderRight: "1px solid #e2e8f0",
              alignSelf: "stretch",
              lineHeight: `${CONTROL_H - 2}px`,
              background: "#f8fafc",
            }}
          >
            {zoom}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(150, z + 10))}
            disabled={zoom >= 150}
            title="Zoom in"
            style={{
              width: 32,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "transparent",
              color: "#334155",
              cursor: zoom >= 150 ? "default" : "pointer",
              opacity: zoom >= 150 ? 0.35 : 1,
            }}
          >
            <IconPlus size={14} strokeWidth={2.2} />
          </button>
        </div>

        {/* Chart toggle */}
        {chartSupported && (
          <button
            onClick={onChartToggle}
            title={chartMode ? "Table view" : "Chart view"}
            style={{
              ...ghostBtn,
              width: CONTROL_H,
              padding: 0,
              background: chartMode ? grad : "#ffffff",
              color: chartMode ? "#ffffff" : "#334155",
              borderColor: chartMode ? "transparent" : "#e2e8f0",
            }}
          >
            {chartMode ? (
              <IconTable size={15} />
            ) : (
              <IconBarChart size={15} />
            )}
          </button>
        )}

        {/* Share */}
        {pdfDocument && (
          <div style={{ position: "relative" }} ref={shareRef}>
            <button
              onClick={() => setShareOpen((o) => !o)}
              title="Share"
              style={{
                ...ghostBtn,
                width: CONTROL_H,
                padding: 0,
                gap: 0,
              }}
            >
              <IconShare size={15} />
            </button>
            {shareOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: CONTROL_H + 6,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  boxShadow:
                    "0 4px 12px rgba(15,23,42,0.08), 0 16px 40px rgba(15,23,42,0.14)",
                  minWidth: 224,
                  zIndex: 200,
                  overflow: "hidden",
                  padding: 5,
                }}
              >
                {shareItems.map((it) => (
                  <button
                    key={it.key}
                    onClick={() => shareTo(it.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      padding: "9px 10px",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#0f172a",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: it.iconBg,
                        color: it.iconColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {it.icon}
                    </span>
                    {it.label}
                  </button>
                ))}
                {shareMsg && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      padding: "8px 10px 5px",
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: "#059669",
                      borderTop: "1px solid #f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <IconCheck size={13} strokeWidth={2.4} />
                    {shareMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ROW 3: quick range chips ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {QUICK_RANGES.map((r) => {
          const [f, t] = r.get();
          const active = f === from && t === to;
          return (
            <button
              key={r.label}
              onClick={() => onRangeChange(f, t)}
              style={{
                border: "1px solid",
                borderColor: active ? "transparent" : "#e2e8f0",
                background: active ? grad : "#ffffff",
                color: active ? "#ffffff" : "#475569",
                fontSize: 11.5,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 999,
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
                boxShadow: active ? "0 2px 6px rgba(15,23,42,0.25)" : "none",
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
