"use client";

// ============================================================
// LOCATION: app/(main)/table-qr/page.tsx
// Printed table QR cards.
//
// Flow:
//   1. filter tables by table group (Tbl_TableGroup.GroupID)
//   2. tick the tables you want (or add a custom name for a
//      table that has no group)
//   3. design the card — width / height in INCHES
//   4. Create QR Codes → download PNG / print / bulk PDF
//
// The scanned link is ALWAYS
//     <QR_MENU_BASE_URL>?id=<encrypted table no + group>
// The base URL is hardcoded in config/qr.config.ts — it is never
// shown or editable here, and nothing readable is in the URL.
// The encryption happens server-side (POST /api/order/qr), so the
// key never reaches the browser.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  getTablesDataAction,
  type TableGroupRow,
  type TableRowData,
} from "@/app/actions/tables";
import { RESTAURANT_INFO } from "@/lib/billFormat";
import {
  QR_CARD_PRESETS,
  QR_CARD_SIZE,
  QR_EXPORT_DPI,
} from "@/config/qr.config";

/* ── theme (Sample A — Cream Classic) ── */
const BROWN = "#684830";
const DARK = "#45301D";
const MID = "#907860";
const FAINT = "#6B543E";
const BORDER = "#E4D6BF";
const PALE = "#F0E8D8";
const CREAM = "#FCF7F3";

const NO_GROUP = "__NO_GROUP__";

/* ── vendored PDF/PNG libraries (same pattern as the bill page) ── */
interface WindowWithVendors extends Window {
  html2canvas?: (
    el: HTMLElement,
    opts?: Record<string, unknown>
  ) => Promise<HTMLCanvasElement>;
  jspdf?: {
    jsPDF: new (opts: {
      orientation: string;
      unit: string;
      format: [number, number] | string;
    }) => {
      addImage: (...args: unknown[]) => void;
      addPage: (format?: [number, number], orientation?: string) => void;
      save: (name: string) => void;
    };
  };
}
function loadVendorScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}
async function getVendors() {
  const w = window as WindowWithVendors;
  if (!w.html2canvas) await loadVendorScript("/vendor/html2canvas.min.js");
  if (!w.jspdf) await loadVendorScript("/vendor/jspdf.umd.min.js");
  if (!w.html2canvas || !w.jspdf) throw new Error("vendor libs unavailable");
  return w;
}
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
const fileSafe = (s: string) => s.replace(/[^a-zA-Z0-9-_]+/g, "-");

const keyOf = (t: TableRowData) => `${t.groupId || t.tableGroup}||${t.tableNo}`;

/* ══════════════════════════════════════════════════════════
   THE CARD — one component used by the preview, the grid and
   the hidden export layer, so what you see is what prints.
   Every measurement is derived from the inch size (96 CSS px
   per inch), so any width/height stays proportional.
   ══════════════════════════════════════════════════════════ */
function QrCard({
  tableNo,
  name,
  group,
  url,
  widthIn,
  heightIn,
  showLogo,
  showGroup,
}: {
  tableNo: string;
  name: string;
  group: string;
  url: string;
  widthIn: number;
  heightIn: number;
  showLogo: boolean;
  showGroup: boolean;
}) {
  const W = Math.round(widthIn * 96);
  const H = Math.round(heightIn * 96);
  const horizontal = W / H >= 1.25;
  const unit = Math.min(W, H);

  const pad = Math.round(Math.max(6, unit * 0.055));
  const border = Math.max(1.5, Math.round(unit * 0.011));
  const radius = Math.round(unit * 0.055);

  const qr = horizontal
    ? Math.round(Math.min(H - pad * 2.4, W * 0.44))
    : Math.round(Math.min(W - pad * 2.4, H * 0.5));

  /* Long names (e.g. "Takeaway", "Garden Patio") shrink instead of
     wrapping mid-word. 7 characters fit at full size. */
  const displayName = name || tableNo;
  const nameFit = Math.max(0.52, Math.min(1, 7 / Math.max(4, displayName.length)));
  const namePx = Math.round(
    Math.max(
      9,
      (horizontal ? Math.min(W * 0.1, H * 0.19) : Math.min(W * 0.115, H * 0.15)) * nameFit
    )
  );
  const subPx = Math.max(6, Math.round(namePx * 0.38));
  const brandPx = Math.max(5, Math.round(namePx * 0.33));
  const logoPx = Math.round(qr * 0.22);

  /* footer — always printed on every card */
  const footerPx = Math.max(6, Math.round(unit * 0.042));
  const footerSpace = Math.round(footerPx * 2.3);

  const qrBlock: ReactNode = url ? (
    <div
      style={{
        position: "relative",
        width: qr,
        height: qr,
        flexShrink: 0,
        background: "#fff",
      }}
    >
      <QRCodeSVG
        value={url}
        size={qr}
        level="H"
        bgColor="#ffffff"
        fgColor={DARK}
        style={{ display: "block" }}
        imageSettings={
          showLogo
            ? {
                src: RESTAURANT_INFO.logoPath,
                height: logoPx,
                width: logoPx,
                excavate: true,
              }
            : undefined
        }
      />
      {showLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={RESTAURANT_INFO.logoPath}
          alt=""
          style={{
            position: "absolute",
            left: (qr - logoPx) / 2,
            top: (qr - logoPx) / 2,
            width: logoPx,
            height: logoPx,
            borderRadius: "50%",
            objectFit: "contain",
            background: "#ffffff",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  ) : (
    <div
      style={{
        width: qr,
        height: qr,
        flexShrink: 0,
        border: `1px dashed ${BORDER}`,
        borderRadius: Math.round(qr * 0.06),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: MID,
        fontSize: Math.max(8, Math.round(qr * 0.12)),
      }}
    >
      …
    </div>
  );

  const textBlock = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: horizontal ? "flex-start" : "center",
        justifyContent: "center",
        textAlign: horizontal ? "left" : "center",
        minWidth: 0,
        flex: horizontal ? 1 : "initial",
        gap: Math.max(1, Math.round(subPx * 0.4)),
      }}
    >
      <div
        style={{
          fontSize: brandPx,
          fontWeight: 700,
          letterSpacing: Math.max(0.4, brandPx * 0.18),
          textTransform: "uppercase",
          color: MID,
          lineHeight: 1.2,
        }}
      >
        {RESTAURANT_INFO.name}
      </div>

      <div
        style={{
          fontSize: namePx,
          fontWeight: 800,
          letterSpacing: 0.2,
          color: DARK,
          lineHeight: 1.12,
          maxWidth: "100%",
          overflowWrap: "anywhere",
        }}
      >
        {name || tableNo}
      </div>

      {showGroup && group ? (
        <div
          style={{
            fontSize: subPx,
            fontWeight: 600,
            letterSpacing: Math.max(0.3, subPx * 0.12),
            textTransform: "uppercase",
            color: BROWN,
            lineHeight: 1.25,
            maxWidth: "100%",
            overflowWrap: "anywhere",
          }}
        >
          {group}
        </div>
      ) : null}

      <div
        style={{
          width: Math.round(unit * 0.16),
          height: Math.max(1, Math.round(unit * 0.008)),
          borderRadius: 99,
          background: `linear-gradient(90deg, ${BROWN}, ${PALE})`,
          marginTop: Math.max(1, Math.round(subPx * 0.3)),
        }}
      />

      <div
        style={{
          fontSize: subPx,
          fontWeight: 600,
          letterSpacing: Math.max(0.3, subPx * 0.1),
          textTransform: "uppercase",
          color: MID,
          lineHeight: 1.25,
        }}
      >
        Scan to order
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        background: "#ffffff",
        border: `${border}px solid ${BROWN}`,
        borderRadius: radius,
        padding: `${pad}px ${pad}px ${pad + footerSpace}px`,
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: Math.round(pad * 0.9),
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        color: DARK,
      }}
    >
      {/* hairline inner frame */}
      <div
        style={{
          position: "absolute",
          inset: Math.max(3, Math.round(pad * 0.5)),
          border: `1px solid ${PALE}`,
          borderRadius: Math.max(2, radius - 4),
          pointerEvents: "none",
        }}
      />
      {/* footer — Powered by MicroE-Chef */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: Math.max(3, Math.round(pad * 0.55)),
          textAlign: "center",
          fontSize: footerPx,
          fontWeight: 600,
          letterSpacing: Math.max(0.2, footerPx * 0.06),
          color: MID,
          lineHeight: 1.2,
          pointerEvents: "none",
        }}
      >
        Powered by MicroE-Chef
      </div>
      {horizontal ? (
        <>
          {qrBlock}
          {textBlock}
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: brandPx,
              fontWeight: 700,
              letterSpacing: Math.max(0.4, brandPx * 0.18),
              textTransform: "uppercase",
              color: MID,
              lineHeight: 1.2,
            }}
          >
            {RESTAURANT_INFO.name}
          </div>
          {qrBlock}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: Math.max(1, Math.round(subPx * 0.4)),
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: namePx,
                fontWeight: 800,
                letterSpacing: 0.2,
                color: DARK,
                lineHeight: 1.12,
                maxWidth: "100%",
                overflowWrap: "anywhere",
              }}
            >
              {name || tableNo}
            </div>
            {showGroup && group ? (
              <div
                style={{
                  fontSize: subPx,
                  fontWeight: 600,
                  letterSpacing: Math.max(0.3, subPx * 0.12),
                  textTransform: "uppercase",
                  color: BROWN,
                  lineHeight: 1.25,
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                }}
              >
                {group}
              </div>
            ) : null}
            <div
              style={{
                fontSize: subPx,
                fontWeight: 600,
                letterSpacing: Math.max(0.3, subPx * 0.1),
                textTransform: "uppercase",
                color: MID,
                lineHeight: 1.25,
              }}
            >
              Scan to order
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── scales a fixed-size card down to fit the available width ── */
function ScaleBox({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setAvail(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const k = avail > 0 ? Math.min(1, avail / width) : 1;

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <div style={{ width: width * k, height: height * k, margin: "0 auto" }}>
        <div
          style={{
            width,
            height,
            transform: `scale(${k})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function TableQrPage() {
  const [groups, setGroups] = useState<TableGroupRow[]>([]);
  const [tables, setTables] = useState<TableRowData[]>([]);
  const [source, setSource] = useState<"database" | "mock" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customTables, setCustomTables] = useState<TableRowData[]>([]);
  const [customName, setCustomName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [created, setCreated] = useState<TableRowData[]>([]);

  /* card design */
  const [widthInput, setWidthInput] = useState(String(QR_CARD_SIZE.defaultWidth));
  const [heightInput, setHeightInput] = useState(String(QR_CARD_SIZE.defaultHeight));
  const [showLogo, setShowLogo] = useState(true);
  const [showGroup, setShowGroup] = useState(true);

  /* optional per-table card names (name + group printed on the card).
     Read lazily from localStorage so no state is set from an effect. */
  const [cardNames, setCardNames] = useState<
    Record<string, { name: string; group: string }>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("tableqr-card-names");
      return raw ? (JSON.parse(raw) as Record<string, { name: string; group: string }>) : {};
    } catch {
      return {};
    }
  });

  const [busy, setBusy] = useState<string | null>(null);

  /** tableKey → encrypted customer URL (built on the server) */
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  /** tableKey → does the table exist in the POS (Tbl_Tables)? */
  const [tableExists, setTableExists] = useState<Record<string, boolean>>({});
  const [signing, setSigning] = useState(false);

  const exportRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const createdRef = useRef<HTMLDivElement>(null);

  const clampIn = useCallback((raw: string, fallback: number) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(QR_CARD_SIZE.max, Math.max(QR_CARD_SIZE.min, Math.round(n * 20) / 20));
  }, []);
  const widthIn = clampIn(widthInput, QR_CARD_SIZE.defaultWidth);
  const heightIn = clampIn(heightInput, QR_CARD_SIZE.defaultHeight);

  /* ── load data ── */
  useEffect(() => {
    let alive = true;
    getTablesDataAction()
      .then((r) => {
        if (!alive) return;
        if (r.success && r.data) {
          setGroups(r.data.groups);
          setTables(r.data.tables);
          setSource(r.data.source);
        } else {
          setError(r.error || "Failed to load tables");
        }
      })
      .catch(() => alive && setError("Failed to load tables"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  /* ── persist card names ── */
  useEffect(() => {
    try {
      localStorage.setItem("tableqr-card-names", JSON.stringify(cardNames));
    } catch {
      /* ignore */
    }
  }, [cardNames]);

  const allTables = useMemo(() => [...tables, ...customTables], [tables, customTables]);

  const hasUngrouped = useMemo(() => allTables.some((t) => !t.groupId), [allTables]);

  const taEntry = useMemo(() => allTables.find((t) => t.takeaway) ?? null, [allTables]);

  const visible = useMemo(
    () =>
      allTables.filter((t) => {
        if (t.takeaway) return false; // shown in its own Takeaway row
        if (groupFilter === "ALL") return true;
        if (groupFilter === NO_GROUP) return !t.groupId;
        return t.groupId === groupFilter;
      }),
    [allTables, groupFilter]
  );

  const selectedTables = useMemo(
    () => allTables.filter((t) => selected.has(keyOf(t))),
    [allTables, selected]
  );
  const allVisibleSelected =
    visible.length > 0 && visible.every((t) => selected.has(keyOf(t)));

  /* ── encrypted customer links (server-side key) ──
     The URL is never shown in the UI — it is only encoded into the
     QR SVG. Re-run when the table list changes. */
  useEffect(() => {
    const list = [...tables, ...customTables];
    if (!list.length) return;
    let alive = true;
    const handle = setTimeout(async () => {
      if (alive) setSigning(true);
      try {
        const res = await fetch("/api/order/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tables: list.map((t) => ({
              tableNo: t.tableNo,
              tableGroup: t.groupId || t.tableGroup,
              takeaway: t.takeaway === true,
            })),
          }),
        });
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok || !json?.ok) {
          setSigning(false);
          return;
        }
        const urls: Record<string, string> = {};
        const exists: Record<string, boolean> = {};
        for (const u of (json.data?.urls ?? []) as (TableRowData & {
          url: string;
          exists?: boolean;
        })[]) {
          const key = keyOf({
            ...u,
            groupId: u.tableGroup,
          } as TableRowData);
          urls[key] = u.url;
          if (typeof u.exists === "boolean") exists[key] = u.exists;
        }
        setQrUrls(urls);
        setTableExists(exists);
      } catch {
        /* cards will show a placeholder instead of a broken QR */
      } finally {
        if (alive) setSigning(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [tables, customTables]);

  function toggle(t: TableRowData, on: boolean) {
    setSelected((prev) => {
      /* The takeaway QR is exclusive — one card only, never mixed
         with table cards (and vice versa). */
      const next = on && t.takeaway ? new Set<string>() : new Set(prev);
      if (on) {
        if (!t.takeaway) {
          allTables.forEach((x) => x.takeaway && next.delete(keyOf(x)));
        }
        next.add(keyOf(t));
      } else {
        next.delete(keyOf(t));
      }
      return next;
    });
  }
  function toggleAllVisible(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((t) => (on ? next.add(keyOf(t)) : next.delete(keyOf(t))));
      return next;
    });
  }

  function addTakeaway() {
    if (taEntry) {
      toggle(taEntry, true);
      setMsg("Only one Takeaway (TA) QR exists — it has been selected (all table cards cleared).");
      return;
    }
    const entry: TableRowData = {
      tableNo: "TA",
      tableGroup: "",
      groupId: "",
      groupName: "Takeaway",
      vacant: true,
      listingOrder: 0,
      inDb: false,
      takeaway: true,
    };
    setCustomTables((prev) => [...prev.filter((t) => !t.takeaway), entry]);
    setSelected(new Set([keyOf(entry)]));
    setMsg("Takeaway (TA) QR selected — one card only. Orders from it are saved with Order Type TA.");
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    if (name.toUpperCase() === "TA") {
      addTakeaway();
      setCustomName("");
      return;
    }
    const existing = allTables.find(
      (t) => t.tableNo.toUpperCase() === name.toUpperCase()
    );
    if (existing) {
      toggle(existing, true);
      setMsg(`"${name}" already exists — it has been selected.`);
      setCustomName("");
      return;
    }
    const entry: TableRowData = {
      tableNo: name,
      tableGroup: "",
      groupId: "",
      groupName: "",
      vacant: true,
      listingOrder: 9999,
      inDb: false,
    };
    setCustomTables((prev) => [...prev, entry]);
    setSelected((prev) => new Set(prev).add(keyOf(entry)));
    setMsg(
      `"${name}" added and selected. If this table is not in the POS (Tbl_Tables) its QR will be marked “Not in POS” and orders from it will fail.`
    );
    setCustomName("");
  }

  function createQrs() {
    setCreated(selectedTables);
    setMsg(
      selectedTables.length
        ? selectedTables[0].takeaway
          ? `Takeaway (TA) card ready — ${widthIn}″ × ${heightIn}″.`
          : `${selectedTables.length} card(s) ready — ${widthIn}″ × ${heightIn}″.`
        : "No tables selected."
    );
    setTimeout(
      () => createdRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60
    );
  }

  /* ── export helpers ── */
  async function capture(key: string) {
    const el = exportRefs.current.get(key);
    if (!el) return null;
    const w = await getVendors();
    return w.html2canvas!(el, {
      scale: QR_EXPORT_DPI / 96,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
  }

  async function downloadPng(t: TableRowData) {
    const key = keyOf(t);
    setBusy(key);
    try {
      const canvas = await capture(key);
      if (!canvas) throw new Error("card not found");
      canvas.toBlob(
        (b) => b && saveBlob(b, `QR-${fileSafe(t.tableNo)}.png`),
        "image/png"
      );
    } catch {
      alert("PNG download failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function printCard(t: TableRowData) {
    const key = keyOf(t);
    setBusy(key);
    try {
      const canvas = await capture(key);
      if (!canvas) throw new Error("card not found");
      const dataUrl = canvas.toDataURL("image/png");
      const win = window.open("", "_blank", "width=640,height=640");
      if (!win) {
        alert("Allow pop-ups for this site to print the card.");
        return;
      }
      win.document.write(`<!doctype html><html><head><title>QR ${t.tableNo}</title>
        <style>
          @page { size: ${widthIn}in ${heightIn}in; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          img { width: ${widthIn}in; height: ${heightIn}in; display: block; }
        </style></head>
        <body><img src="${dataUrl}" alt="" onload="window.focus();window.print();"></body></html>`);
      win.document.close();
    } catch {
      alert("Print failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    if (!created.length) return;
    setBusy("pdf");
    try {
      const w = await getVendors();
      const orientation = widthIn >= heightIn ? "landscape" : "portrait";
      const pdf = new w.jspdf!.jsPDF({
        orientation,
        unit: "in",
        format: [widthIn, heightIn],
      });
      let first = true;
      for (const t of created) {
        const canvas = await capture(keyOf(t));
        if (!canvas) continue;
        if (!first) {
          pdf.addPage([widthIn, heightIn], orientation);
        }
        first = false;
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthIn, heightIn);
      }
      pdf.save(`table-qr-cards-${widthIn}x${heightIn}in.pdf`);
    } catch {
      alert("PDF download failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  /* ── card name helpers ──
     An empty field falls back to the POS values, so typing a name
     never wipes the group (and vice versa). */
  const nameOf = (t: TableRowData) => {
    if (t.takeaway) return (cardNames[keyOf(t)]?.name ?? "").trim() || "Takeaway";
    return (cardNames[keyOf(t)]?.name ?? "").trim() || (t.inDb ? "" : t.tableNo);
  };
  const groupOf = (t: TableRowData) => {
    if (t.takeaway)
      return (cardNames[keyOf(t)]?.group ?? "").trim() || "Order type · TA";
    return (cardNames[keyOf(t)]?.group ?? "").trim() || t.groupName || t.tableGroup || "";
  };

  function setName(t: TableRowData, field: "name" | "group", value: string) {
    const key = keyOf(t);
    setCardNames((prev) => ({
      ...prev,
      [key]: {
        name: field === "name" ? value : prev[key]?.name ?? "",
        group: field === "group" ? value : prev[key]?.group ?? "",
      },
    }));
  }

  /* ── shared styles ── */
  const input: CSSProperties = {
    padding: "9px 12px",
    border: `1px solid ${BORDER}`,
    borderRadius: 9,
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    color: DARK,
    background: "#fff",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };
  const lbl: CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: MID,
    marginBottom: 6,
    fontFamily: "Inter, sans-serif",
  };
  const card: CSSProperties = {
    marginTop: 18,
    background: "#fff",
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    padding: 18,
  };
  const btnBrown: CSSProperties = {
    padding: "10px 18px",
    background: BROWN,
    color: "#fff",
    border: "none",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    whiteSpace: "nowrap",
  };
  const btnGhost: CSSProperties = {
    padding: "10px 18px",
    background: "#fff",
    color: BROWN,
    border: `1px solid ${BORDER}`,
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    whiteSpace: "nowrap",
  };
  const sectionTitle: CSSProperties = {
    margin: "0 0 12px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: MID,
  };

  /* preview: the first selected table, otherwise the first table in
     the list, so the designer always shows a real QR */
  const previewKey = selectedTables[0] ?? allTables[0] ?? null;
  const previewUrl = previewKey ? qrUrls[keyOf(previewKey)] ?? "" : "";
  const qrTooSmall = Math.min(widthIn, heightIn) < 2;

  return (
    <div style={{ padding: "22px 24px 40px", fontFamily: "Inter, sans-serif" }}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: DARK }}>
            Table QR Cards
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: FAINT, maxWidth: 640 }}>
            Pick the tables, design the card (size in inches), then download or print.
            Each QR opens the customer menu with an encrypted table id — nothing readable
            is in the link.
            {source === "mock" && (
              <span style={{ color: BROWN, fontWeight: 700 }}>
                {" "}
                (Mock data — database not configured)
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={{ ...btnBrown, opacity: created.length ? 1 : 0.5 }}
            disabled={!created.length || busy != null}
            onClick={downloadPdf}
          >
            {busy === "pdf" ? "Preparing…" : `Download all PDF (${created.length})`}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
          }}
        >
          {error} — you can still build cards from the Custom Name field below.
        </div>
      )}

      {/* ── 1) Tables ── */}
      <div style={card}>
        <p style={sectionTitle}>1 · Tables</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
            gap: 14,
          }}
        >
          <div>
            <label style={lbl}>Table Group</label>
            <select
              style={input}
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="ALL">All groups ({allTables.length} tables)</option>
              {groups.map((g) => (
                <option key={g.groupId || g.groupName} value={g.groupId}>
                  {g.groupName}
                  {g.groupId && g.groupId !== g.groupName ? ` (${g.groupId})` : ""} ·{" "}
                  {g.tableCount}
                </option>
              ))}
              {hasUngrouped && <option value={NO_GROUP}>No group</option>}
            </select>
          </div>
          <div>
            <label style={lbl}>Quick add a table</label>
            <select
              style={input}
              value=""
              onChange={(e) => {
                const t = visible.find((v) => keyOf(v) === e.target.value);
                if (t) {
                  toggle(t, true);
                  setMsg(`"${t.tableNo}" selected.`);
                }
              }}
            >
              <option value="">Select a table…</option>
              {visible.map((t) => (
                <option key={keyOf(t)} value={keyOf(t)}>
                  {t.tableNo}
                  {t.groupName ? ` — ${t.groupName}` : t.tableGroup ? ` — ${t.tableGroup}` : " — no group"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* list */}
        <div
          style={{
            marginTop: 16,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 13px",
              background: PALE,
              borderBottom: `1px solid ${BORDER}`,
              fontSize: 12.5,
              fontWeight: 700,
              color: DARK,
            }}
          >
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => toggleAllVisible(e.target.checked)}
            />
            <span>Select all</span>
            <span style={{ color: FAINT, fontWeight: 600 }}>
              {visible.length} tables · {selectedTables.length} selected
            </span>
            <span style={{ flex: 1 }} />
            <button
              style={{ ...btnGhost, padding: "5px 10px", fontSize: 11.5 }}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {loading ? (
              <p style={{ padding: 14, margin: 0, color: FAINT, fontSize: 13 }}>
                Loading tables…
              </p>
            ) : visible.length === 0 ? (
              <p style={{ padding: 14, margin: 0, color: FAINT, fontSize: 13 }}>
                No tables in this group. Use “Custom table name” below to add one.
              </p>
            ) : (
              visible.map((t) => {
                const checked = selected.has(keyOf(t));
                return (
                  <label
                    key={keyOf(t)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 13px",
                      cursor: "pointer",
                      fontSize: 13,
                      background: checked ? "#FBF6EC" : "#fff",
                      borderBottom: `1px solid ${CREAM}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggle(t, e.target.checked)}
                    />
                    <span style={{ fontWeight: 800, color: DARK, minWidth: 80 }}>
                      {t.tableNo}
                    </span>
                    <span style={{ color: FAINT }}>
                      {t.groupName || t.tableGroup || "no group"}
                    </span>
                    <span style={{ flex: 1 }} />
                    {source === "database" && !t.takeaway && tableExists[keyOf(t)] === false && (
                      <span
                        title="This table number is not in the POS (Tbl_Tables, Enable=1). Orders from its QR will fail with 'Table not found'."
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: 99,
                          background: "#fef3c7",
                          color: "#b45309",
                        }}
                      >
                        ⚠ Not in POS
                      </span>
                    )}
                    {!t.groupId && (
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: 99,
                          background: "#eef2ff",
                          color: "#4338ca",
                        }}
                      >
                        no group
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 99,
                        background: t.vacant ? "#dcfce7" : "#fee2e2",
                        color: t.vacant ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {t.vacant ? "Vacant" : "Occupied"}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* the takeaway card row */}
        {taEntry && (
          <label
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 13px",
              borderRadius: 10,
              border: `1px solid ${BROWN}`,
              background: selected.has(keyOf(taEntry)) ? "#FBF6EC" : "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(keyOf(taEntry))}
              onChange={(e) => toggle(taEntry, e.target.checked)}
            />
            <span style={{ fontWeight: 800, color: DARK }}>TA</span>
            <span style={{ color: FAINT }}>Takeaway — one QR only · Order Type TA</span>
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                padding: "2px 7px",
                borderRadius: 99,
                background: "#eef2ff",
                color: "#4338ca",
              }}
            >
              Takeaway
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setCustomTables((prev) => prev.filter((t) => !t.takeaway));
                setSelected((prev) => {
                  const next = new Set(prev);
                  next.delete(keyOf(taEntry));
                  return next;
                });
              }}
              style={{
                border: "none",
                background: "none",
                color: "#b91c1c",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Remove
            </button>
          </label>
        )}

        {/* custom table name (no group field) */}
        <div style={{ marginTop: 14 }}>
          <label style={lbl}>Custom table name</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(160px,1fr) auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              style={input}
              placeholder="Table name — e.g. PATIO 1"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <button style={btnBrown} onClick={addCustom}>
              Add table
            </button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: FAINT }}>
            For tables that are not in the POS table list. The card prints this name; the QR
            still carries the real table number, so orders only reach the kitchen if that
            table exists in the POS.
          </p>

          {/* Takeaway note + one-tap TA card */}
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              background: "#FBF6EC",
              border: `1px dashed ${BORDER}`,
              borderRadius: 10,
              padding: "9px 12px",
            }}
          >
            <span style={{ fontSize: 12, color: FAINT, lineHeight: 1.55 }}>
              <b style={{ color: BROWN }}>Takeaway:</b> type <b>TA</b> above (or press the
              button) — only <b>one</b> Takeaway QR can be created. Orders from it are saved
              with Order Type <b>TA</b> and a takeaway number from <b>Tbl_Serials</b>.
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              style={{ ...btnGhost, padding: "7px 12px", fontSize: 12 }}
              onClick={addTakeaway}
            >
              + Takeaway (TA) QR
            </button>
          </div>
        </div>

        {msg && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: BROWN, fontWeight: 600 }}>
            {msg}
          </p>
        )}
      </div>

      {/* ── 2) Card design ── */}
      <div style={card}>
        <p style={sectionTitle}>2 · Card design &amp; size (inches)</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: 22,
          }}
        >
          <div>
            <label style={lbl}>Presets</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {QR_CARD_PRESETS.map((p) => {
                const active = widthIn === p.width && heightIn === p.height;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setWidthInput(String(p.width));
                      setHeightInput(String(p.height));
                    }}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                      border: `1px solid ${active ? BROWN : BORDER}`,
                      background: active ? BROWN : "#fff",
                      color: active ? "#fff" : BROWN,
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Width (in)</label>
                <input
                  style={input}
                  type="number"
                  min={QR_CARD_SIZE.min}
                  max={QR_CARD_SIZE.max}
                  step={0.1}
                  value={widthInput}
                  onChange={(e) => setWidthInput(e.target.value)}
                  onBlur={() => setWidthInput(String(widthIn))}
                />
              </div>
              <div>
                <label style={lbl}>Height (in)</label>
                <input
                  style={input}
                  type="number"
                  min={QR_CARD_SIZE.min}
                  max={QR_CARD_SIZE.max}
                  step={0.1}
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  onBlur={() => setHeightInput(String(heightIn))}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: DARK,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={showLogo}
                  onChange={(e) => setShowLogo(e.target.checked)}
                />
                Logo in QR centre
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: DARK,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={showGroup}
                  onChange={(e) => setShowGroup(e.target.checked)}
                />
                Print the group name
              </label>
            </div>

            <p style={{ margin: "12px 0 0", fontSize: 11.5, color: FAINT, lineHeight: 1.6 }}>
              {widthIn}″ × {heightIn}″ ({Math.round(widthIn * 25.4)} × {Math.round(heightIn * 25.4)} mm)
              · exported at {QR_EXPORT_DPI} DPI.
              {qrTooSmall && (
                <span style={{ color: "#b45309", fontWeight: 700 }}>
                  {" "}
                  ⚠ Under 2″ the QR gets tight — test one print before the full batch.
                </span>
              )}
            </p>
          </div>

          {/* live preview */}
          <div>
            <label style={lbl}>Live preview</label>
            <div
              style={{
                background: CREAM,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <ScaleBox
                width={Math.round(widthIn * 96)}
                height={Math.round(heightIn * 96)}
              >
                <QrCard
                  tableNo={previewKey?.tableNo ?? "TABLE"}
                  name={previewKey ? nameOf(previewKey) || previewKey.tableNo : "TABLE 01"}
                  group={
                    previewKey
                      ? groupOf(previewKey)
                      : groups[0]?.groupName ?? "Main Dining"
                  }
                  url={previewUrl}
                  widthIn={widthIn}
                  heightIn={heightIn}
                  showLogo={showLogo}
                  showGroup={showGroup}
                />
              </ScaleBox>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3) Card names ── */}
      {selectedTables.length > 0 && (
        <div style={card}>
          <p style={sectionTitle}>3 · Names printed on the cards (optional)</p>
          <p style={{ margin: "-4px 0 12px", fontSize: 11.5, color: FAINT }}>
            Leave blank to print the POS table number. Handy for tables that have no group
            in the POS.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedTables.map((t) => (
              <div
                key={keyOf(t)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px minmax(120px,1fr) minmax(120px,1fr)",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: DARK,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={t.tableNo}
                >
                  {t.tableNo}
                </span>
                <input
                  style={input}
                  placeholder={`Card name — default ${t.tableNo}`}
                  value={cardNames[keyOf(t)]?.name ?? ""}
                  onChange={(e) => setName(t, "name", e.target.value)}
                />
                <input
                  style={input}
                  placeholder={`Group on card — default ${
                    t.groupName || t.tableGroup || "none"
                  }`}
                  value={cardNames[keyOf(t)]?.group ?? ""}
                  onChange={(e) => setName(t, "group", e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create ── */}
      <button
        style={{
          ...btnBrown,
          width: "100%",
          marginTop: 14,
          padding: "12px 18px",
          fontSize: 14,
          opacity: selectedTables.length && !signing ? 1 : 0.55,
        }}
        disabled={!selectedTables.length || signing}
        onClick={createQrs}
      >
        {signing
          ? "Preparing links…"
          : `Create QR cards (${selectedTables.length} selected · ${widthIn}″ × ${heightIn}″)`}
      </button>

      {/* ── 4) Generated cards ── */}
      <div ref={createdRef} style={{ marginTop: 26 }}>
        <p style={sectionTitle}>4 · Generated cards — {created.length}</p>
        {created.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: `1px dashed ${BORDER}`,
              borderRadius: 14,
              padding: "36px 20px",
              textAlign: "center",
              color: FAINT,
              fontSize: 13,
            }}
          >
            Select tables above and click <b>Create QR cards</b>.
          </div>
        ) : (
          <div
            style={{
              background: CREAM,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                gap: 18,
              }}
            >
              {created.map((t) => {
                const key = keyOf(t);
                return (
                  <div
                    key={key}
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <ScaleBox
                      width={Math.round(widthIn * 96)}
                      height={Math.round(heightIn * 96)}
                    >
                      <QrCard
                        tableNo={t.tableNo}
                        name={nameOf(t) || t.tableNo}
                        group={groupOf(t)}
                        url={qrUrls[key] ?? ""}
                        widthIn={widthIn}
                        heightIn={heightIn}
                        showLogo={showLogo}
                        showGroup={showGroup}
                      />
                    </ScaleBox>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        style={{ ...btnGhost, flex: 1, padding: "8px 10px", fontSize: 12 }}
                        disabled={busy != null}
                        onClick={() => downloadPng(t)}
                      >
                        {busy === key ? "…" : "Download PNG"}
                      </button>
                      <button
                        style={{ ...btnGhost, flex: 1, padding: "8px 10px", fontSize: 12 }}
                        disabled={busy != null}
                        onClick={() => printCard(t)}
                      >
                        {busy === key ? "…" : "Print"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── hidden export layer — real-size cards at 96 CSS px / inch ── */}
      {created.length > 0 && (
        <div
          aria-hidden
          style={{ position: "fixed", top: 0, left: -20000, pointerEvents: "none" }}
        >
          {created.map((t) => {
            const key = keyOf(t);
            return (
              <div
                key={`export-${key}`}
                ref={(el) => {
                  if (el) exportRefs.current.set(key, el);
                  else exportRefs.current.delete(key);
                }}
                style={{ marginBottom: 10 }}
              >
                <QrCard
                  tableNo={t.tableNo}
                  name={nameOf(t) || t.tableNo}
                  group={groupOf(t)}
                  url={qrUrls[key] ?? ""}
                  widthIn={widthIn}
                  heightIn={heightIn}
                  showLogo={showLogo}
                  showGroup={showGroup}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
