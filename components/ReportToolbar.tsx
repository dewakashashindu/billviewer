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

  /** Single date mode (e.g. Performance Report Business Date — no From/To range) */
  singleDate?: boolean;
  singleDateLabel?: string;
}

// ── shared control styles ──
const CONTROL_H = 36;
const grad = "linear-gradient(135deg,#45301D 0%,#684830 100%)";

const ghostBtn: React.CSSProperties = {
  height: CONTROL_H,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: "1px solid #E4D6BF",
  background: "#ffffff",
  color: "#684830",
  borderRadius: 9,
  cursor: "pointer",
  flexShrink: 0,
};

const dateInput: React.CSSProperties = {
  height: CONTROL_H,
  border: "1px solid #E4D6BF",
  borderRadius: 9,
  padding: "0 10px",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#45301D",
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
  singleDate = false,
  singleDateLabel = "Business Date",
}: ReportToolbarProps) {
  const [zoom, setZoom] = useState(100);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [pdfPrep, setPdfPrep] = useState<{
    status: "idle" | "building" | "ready" | "error";
    blob: Blob | null;
    file: File | null;
  }>({ status: "idle", blob: null, file: null });
  const shareRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<React.ReactElement | undefined>(pdfDocument);
  pdfDocRef.current = pdfDocument;

  // zoom — report content container ekatama (CSS zoom)
  useEffect(() => {
    const el = document.getElementById("report-zoom-area");
    if (el) {
      el.style.zoom = `${zoom}%`;
    }
  }, [zoom]);

  // Close share menu automatically if pdfDocument disappears (e.g. empty data)
  useEffect(() => {
    if (!pdfDocument && shareOpen) {
      setShareOpen(false);
    }
  }, [pdfDocument, shareOpen]);

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

  // Pre-generate the actual PDF File as soon as Share popover opens so
  // navigator.share({ files }) & window.open run SYNCHRONOUSLY inside
  // the user click gesture (prevents NotAllowedError & popup blocking).
  useEffect(() => {
    if (!shareOpen) return;
    const docEl = pdfDocRef.current;
    if (!docEl) {
      setPdfPrep({ status: "error", blob: null, file: null });
      return;
    }
    let alive = true;
    setShareMsg(null);
    setPdfPrep({ status: "building", blob: null, file: null });

    (async () => {
      try {
        const ReactPDF = await import("@react-pdf/renderer");
        const { pdf } = ReactPDF as any;
        const rawBlob: Blob = await (
          pdf as (el: any) => { toBlob: () => Promise<Blob> }
        )(docEl).toBlob();
        const pdfBlob =
          rawBlob.type === "application/pdf"
            ? rawBlob
            : new Blob([rawBlob], { type: "application/pdf" });
        const safeName = pdfFileName.toLowerCase().endsWith(".pdf")
          ? pdfFileName
          : `${pdfFileName}.pdf`;
        const file = new File([pdfBlob], safeName, {
          type: "application/pdf",
          lastModified: Date.now(),
        });
        if (alive) {
          setPdfPrep({ status: "ready", blob: pdfBlob, file });
        }
      } catch (e) {
        console.error("PDF build failed:", e);
        if (alive) {
          setPdfPrep({ status: "error", blob: null, file: null });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [shareOpen, pdfFileName, from, to, search]);

  function downloadPdfBlob(blob: Blob, filename: string) {
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 20_000);
  }

  function openPdfInTab(blob: Blob) {
    const objUrl = URL.createObjectURL(blob);
    window.open(objUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
  }

  function canNativeSharePdf(file: File): boolean {
    try {
      const nav =
        typeof navigator !== "undefined" ? (navigator as any) : null;
      if (!nav || typeof nav.share !== "function") return false;
      if (typeof nav.canShare === "function") {
        return Boolean(nav.canShare({ files: [file] }));
      }
      return true;
    } catch {
      return false;
    }
  }

  function shareTo(target: "native" | "whatsapp" | "email" | "save") {
    setShareMsg(null);
    const { blob, file, status } = pdfPrep;
    if (status !== "ready" || !blob || !file) {
      setShareMsg(
        status === "building"
          ? "Please wait a moment — generating PDF..."
          : "Unable to build PDF for this report"
      );
      return;
    }

    const reportLabel = `${title} (${from} to ${to})`;
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);

    if (target === "native") {
      if (canNativeSharePdf(file)) {
        nav
          .share({ files: [file], title: reportLabel })
          .then(() => setShareOpen(false))
          .catch((err: any) => {
            if (err?.name === "AbortError") return;
            downloadPdfBlob(blob, file.name);
            setShareMsg(`PDF downloaded (${file.name}) — ready to send`);
          });
        return;
      }
      downloadPdfBlob(blob, file.name);
      openPdfInTab(blob);
      setShareMsg(`PDF ready (${file.name}) — downloaded & opened`);
      return;
    }

    if (target === "whatsapp") {
      // On mobile / OSes that support Web Share API with files, invoke native
      // share sheet synchronously so WhatsApp receives the actual .pdf file!
      if (canNativeSharePdf(file) && isMobile) {
        nav
          .share({ files: [file], title: reportLabel })
          .then(() => setShareOpen(false))
          .catch((err: any) => {
            if (err?.name === "AbortError") return;
            downloadPdfBlob(blob, file.name);
            setShareMsg(`PDF saved (${file.name}) — attach in WhatsApp`);
          });
        return;
      }
      if (canNativeSharePdf(file)) {
        // Desktop browser with OS file-share support (e.g. Windows Share / macOS Safari)
        nav
          .share({ files: [file], title: reportLabel })
          .then(() => setShareOpen(false))
          .catch((err: any) => {
            if (err?.name === "AbortError") return;
            downloadPdfBlob(blob, file.name);
            window.open(
              `https://wa.me/?text=${encodeURIComponent(`*${title}* (${from} to ${to})\nPDF Report: ${file.name}`)}`,
              "_blank",
              "noopener,noreferrer"
            );
            setShareMsg(`PDF saved (${file.name}) — attach it in WhatsApp`);
          });
        return;
      }
      // Desktop fallback where browser disables navigator.share (e.g. LAN HTTP):
      // synchronously open WhatsApp AND save the PDF file ready to drag/attach.
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`*${title}* (${from} to ${to})\nPDF Report: ${file.name}`)}`,
        "_blank",
        "noopener,noreferrer"
      );
      downloadPdfBlob(blob, file.name);
      setShareMsg(`PDF saved (${file.name}) — attach/drop into WhatsApp`);
      return;
    }

    if (target === "email") {
      if (canNativeSharePdf(file) && isMobile) {
        nav
          .share({
            files: [file],
            title: reportLabel,
            text: `Please find attached the PDF report: ${file.name}`,
          })
          .then(() => setShareOpen(false))
          .catch((err: any) => {
            if (err?.name === "AbortError") return;
            downloadPdfBlob(blob, file.name);
          });
        return;
      }
      // Download PDF first, then launch mail client after 450ms so Chrome
      // does not cancel the pending blob download when handling mailto:
      downloadPdfBlob(blob, file.name);
      const subject = encodeURIComponent(`${title} (${from} to ${to})`);
      const body = encodeURIComponent(
        `Please find attached the PDF report: ${file.name}\n\nReport: ${title}\nPeriod: ${from} to ${to}`
      );
      setTimeout(() => {
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }, 450);
      setShareMsg(`PDF downloaded (${file.name}) — attach to email`);
      return;
    }

    if (target === "save") {
      downloadPdfBlob(blob, file.name);
      openPdfInTab(blob);
      setShareMsg(`PDF downloaded & opened (${file.name})`);
      return;
    }
  }

  const shareItems: {
    key: "native" | "whatsapp" | "email" | "save";
    label: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
  }[] = [
    {
      key: "native",
      label: "Share PDF (Apps / Device)",
      icon: <IconPhone size={14} />,
      iconBg: "#F0E8D8",
      iconColor: "#684830",
    },
    {
      key: "whatsapp",
      label: "Share PDF via WhatsApp",
      icon: <IconChat size={14} />,
      iconBg: "#e8f9ef",
      iconColor: "#16a34a",
    },
    {
      key: "email",
      label: "Share PDF via Email",
      icon: <IconMail size={14} />,
      iconBg: "#F0E8D8",
      iconColor: "#684830",
    },
    {
      key: "save",
      label: "View & Save PDF",
      icon: <IconDownload size={14} />,
      iconBg: "#FCF7F3",
      iconColor: "#6B543E",
    },
  ];

  return (
    <div
      style={{
        padding: "14px 22px 12px",
        borderBottom: "1px solid #E4D6BF",
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
            boxShadow: "0 2px 6px rgba(114,86,60,0.25)",
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
              color: "#45301D",
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
                color: "#6B543E",
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
              boxShadow: "0 2px 6px rgba(114,86,60,0.25)",
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
                color: "#907860",
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
                border: "1px solid #E4D6BF",
                borderRadius: 9,
                padding: "0 10px 0 32px",
                fontSize: 12.5,
                color: "#45301D",
                background: "#FCF7F3",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        )}

        {/* Single Business Date OR From / To */}
        {singleDate ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid #E4D6BF",
              borderRadius: 9,
              padding: "0 10px",
              height: CONTROL_H,
              background: "#ffffff",
              flexShrink: 0,
            }}
          >
            <IconCalendar size={14} style={{ color: "#6B543E" }} />
            <span
              style={{
                color: "#6B543E",
                fontSize: 11.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {singleDateLabel}
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                if (e.target.value) onRangeChange(e.target.value, e.target.value);
              }}
              style={{ ...dateInput, border: "none", padding: 0, width: 122 }}
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #E4D6BF",
              borderRadius: 9,
              padding: "0 8px",
              height: CONTROL_H,
              background: "#ffffff",
              flexShrink: 0,
            }}
          >
            <IconCalendar size={14} style={{ color: "#6B543E" }} />
            <input
              type="date"
              value={from}
              onChange={(e) => onRangeChange(e.target.value, to)}
              style={{ ...dateInput, border: "none", padding: 0, width: 118 }}
            />
            <span style={{ color: "#C8B8A8", fontSize: 11 }}>to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => onRangeChange(from, e.target.value)}
              style={{ ...dateInput, border: "none", padding: 0, width: 118 }}
            />
          </div>
        )}

        {/* Zoom */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: CONTROL_H,
            border: "1px solid #E4D6BF",
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
              color: "#684830",
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
              color: "#45301D",
              minWidth: 42,
              textAlign: "center",
              borderLeft: "1px solid #E4D6BF",
              borderRight: "1px solid #E4D6BF",
              alignSelf: "stretch",
              lineHeight: `${CONTROL_H - 2}px`,
              background: "#FCF7F3",
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
              color: "#684830",
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
              color: chartMode ? "#ffffff" : "#684830",
              borderColor: chartMode ? "transparent" : "#E4D6BF",
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
                  border: "1px solid #E4D6BF",
                  borderRadius: 12,
                  boxShadow:
                    "0 4px 12px rgba(114,86,60,0.08), 0 16px 40px rgba(114,86,60,0.14)",
                  minWidth: 256,
                  zIndex: 200,
                  overflow: "hidden",
                  padding: 6,
                }}
              >
                {/* PDF File Status Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 9px",
                    marginBottom: 4,
                    borderRadius: 8,
                    background: "#FCF7F3",
                    border: "1px solid #E4D6BF",
                    fontSize: 11,
                    color: "#684830",
                  }}
                >
                  <IconFileText size={14} strokeWidth={2} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#45301D",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={pdfFileName}
                    >
                      {pdfFileName}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#907860" }}>
                      {pdfPrep.status === "building"
                        ? "Generating PDF..."
                        : pdfPrep.status === "ready" && pdfPrep.blob
                          ? `PDF Ready • ${Math.max(1, Math.round(pdfPrep.blob.size / 1024))} KB`
                          : "PDF unavailable"}
                    </div>
                  </div>
                </div>

                {shareItems.map((it) => {
                  const disabled = pdfPrep.status !== "ready";
                  return (
                    <button
                      key={it.key}
                      disabled={disabled}
                      onClick={() => shareTo(it.key)}
                      onMouseEnter={(e) => {
                        if (!disabled) {
                          e.currentTarget.style.background = "#FCF7F3";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
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
                        color: "#45301D",
                        cursor: disabled ? "wait" : "pointer",
                        opacity: disabled ? 0.55 : 1,
                        textAlign: "left",
                        borderRadius: 8,
                        transition: "background 0.12s",
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
                  );
                })}
                {shareMsg && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      padding: "8px 10px 5px",
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: "#059669",
                      borderTop: "1px solid #FCF7F3",
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
        {(singleDate ? QUICK_RANGES.slice(0, 2) : QUICK_RANGES).map((r) => {
          const [f, t] = r.get();
          const active = singleDate ? f === from : f === from && t === to;
          return (
            <button
              key={r.label}
              onClick={() => onRangeChange(f, singleDate ? f : t)}
              style={{
                border: "1px solid",
                borderColor: active ? "transparent" : "#E4D6BF",
                background: active ? grad : "#ffffff",
                color: active ? "#ffffff" : "#6B543E",
                fontSize: 11.5,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 999,
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
                boxShadow: active ? "0 2px 6px rgba(114,86,60,0.25)" : "none",
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
