"use client";

// ============================================================
// Table QR Codes — /table-qr
// Data: Tbl_TableGroup + Tbl_Tables (app/actions/tables.ts).
// Flow: select group -> select table(s) from dropdown or the
// checkbox list (or add a custom table name) ->
// set the QR URL -> Create QR Codes ->
// download single PNGs or a bulk PDF (one QR per page).
// The restaurant logo sits in the centre of each QR and the
// table number is printed underneath.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  getTablesDataAction,
  type TableGroupRow,
  type TableRowData,
} from "@/app/actions/tables";
import { RESTAURANT_INFO } from "@/lib/billFormat";

/* ── theme (Sample A — Cream Classic) ── */
const BROWN = "#684830";
const DARK = "#45301D";
const MID = "#907860";
const FAINT = "#6B543E";
const BORDER = "#E4D6BF";
const PALE = "#F0E8D8";
const CREAM = "#FCF7F3";

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
      format: string;
    }) => {
      addImage: (...args: unknown[]) => void;
      addPage: () => void;
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

const keyOf = (t: TableRowData) => `${t.tableGroup}||${t.tableNo}`;
const QR_SIZE = 200;

export default function TableQrPage() {
  const [groups, setGroups] = useState<TableGroupRow[]>([]);
  const [tables, setTables] = useState<TableRowData[]>([]);
  const [source, setSource] = useState<"database" | "mock" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [group, setGroup] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customTables, setCustomTables] = useState<TableRowData[]>([]);
  const [customName, setCustomName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [created, setCreated] = useState<TableRowData[]>([]);

  const [urlTemplate, setUrlTemplate] = useState("");
  const [showLogo, setShowLogo] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  /** tableKey → signed customer URL (built on the server) */
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  /** tableKey → does the table exist in the POS (Tbl_Tables)? */
  const [tableExists, setTableExists] = useState<Record<string, boolean>>({});

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const createdRef = useRef<HTMLDivElement>(null);

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
    try {
      const savedUrl = localStorage.getItem("tableqr-url");
      // Default target = the customer QR ordering flow, so a scanned
      // QR opens /order with the table (and its signed token) filled in.
      setUrlTemplate(
        savedUrl ||
          `${window.location.origin}/order?table={table}&group={group}&t={token}`
      );
    } catch { /* ignore */ }
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("tableqr-url", urlTemplate);
    } catch { /* ignore */ }
  }, [urlTemplate]);

  /* ── signed customer links ──────────────────────────────────────
     The HMAC token is generated on the server (the secret must
     never reach the browser). Re-run when the template or the
     table list changes. */
  useEffect(() => {
    const list = [...tables, ...customTables];
    if (!urlTemplate.trim() || !list.length) return;
    let alive = true;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/order/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: urlTemplate.trim(),
            tables: list.map((t) => ({
              tableNo: t.tableNo,
              tableGroup: t.tableGroup,
            })),
          }),
        });
        const json = await res.json().catch(() => null);
        if (!alive || !res.ok || !json?.ok) return;
        const map: Record<string, string> = {};
        const exists: Record<string, boolean> = {};
        for (const u of json.data?.urls ?? []) {
          map[keyOf(u as TableRowData)] = u.url;
          if (typeof u.exists === "boolean") exists[keyOf(u as TableRowData)] = u.exists;
        }
        setSignedUrls(map);
        setTableExists(exists);
      } catch {
        /* fall back to the unsigned template */
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [urlTemplate, tables, customTables]);

  const allTables = useMemo(
    () => [...tables, ...customTables],
    [tables, customTables]
  );
  const visible = useMemo(
    () =>
      allTables.filter((t) => group === "ALL" || t.tableGroup === group),
    [allTables, group]
  );

  const selectedTables = useMemo(
    () => allTables.filter((t) => selected.has(keyOf(t))),
    [allTables, selected]
  );
  const allVisibleSelected =
    visible.length > 0 && visible.every((t) => selected.has(keyOf(t)));

  // The scanned URL always carries BOTH the table number and the
  // table group, plus a signed token (t=) that the ordering API
  // verifies — that is what stops a guest from ordering into
  // another table's bill.
  //
  // The signed links are built on the server (POST /api/order/qr)
  // because the HMAC secret must never reach the browser.
  function buildUrl(t: TableRowData): string {
    const signed = signedUrls[keyOf(t)];
    if (signed) return signed;

    const base = urlTemplate.trim();
    if (!base) return t.tableNo;
    // The {id} placeholder is filled server-side (encrypted table
    // id — the key never reaches the browser). If we are here the
    // signing request failed; show the raw template so the problem
    // is visible instead of silently building a broken link.
    if (base.includes("{id}")) return base;
    const hasTable = base.includes("{table}");
    const hasGroup = base.includes("{group}");
    let url = base
      .replaceAll("{table}", encodeURIComponent(t.tableNo))
      .replaceAll("{group}", encodeURIComponent(t.tableGroup));
    const appendParam = (u: string, key: string, value: string) => {
      if (!value) return u;
      const [beforeHash, hash] = u.split("#", 2);
      const sep = beforeHash.includes("?") ? "&" : "?";
      return `${beforeHash}${sep}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
    };
    if (!hasTable) url = appendParam(url, "table", t.tableNo);
    if (!hasGroup) url = appendParam(url, "group", t.tableGroup);
    return url;
  }

  function toggle(t: TableRowData, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(keyOf(t)); else next.delete(keyOf(t));
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

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    const existing = allTables.find(
      (t) => t.tableNo.toUpperCase() === name.toUpperCase()
    );
    if (existing) {
      toggle(existing, true);
      setMsg(`"${name}" already exists — it has been selected.`);
    } else {
      const entry: TableRowData = {
        tableNo: name,
        tableGroup: group !== "ALL" ? group : "",
        vacant: true,
        listingOrder: 9999,
      };
      setCustomTables((p) => [...p, entry]);
      setSelected((p) => new Set(p).add(keyOf(entry)));
      setMsg(
        `"${name}" added and selected — if the POS (Tbl_Tables) doesn't have this table, its QR will be flagged “Not in POS” and orders will fail.`
      );
    }
    setCustomName("");
  }
  function createQrs() {
    setCreated(selectedTables);
    setMsg(
      selectedTables.length
        ? `${selectedTables.length} QR code(s) created.`
        : "No tables selected."
    );
    setTimeout(
      () => createdRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60
    );
  }

  /* ── downloads (operate on the created QR codes) ── */
  async function downloadPng(t: TableRowData) {
    const el = cardRefs.current.get(keyOf(t));
    if (!el) return;
    setBusy(t.tableNo);
    try {
      const w = await getVendors();
      const canvas = await w.html2canvas!(el, {
        scale: 3, backgroundColor: "#ffffff", useCORS: true, logging: false,
      });
      canvas.toBlob((b) => b && saveBlob(b, `QR-${fileSafe(t.tableNo)}.png`), "image/png");
    } catch { alert("PNG download failed. Please try again."); }
    finally { setBusy(null); }
  }
  async function downloadPdf() {
    if (!created.length) return;
    setBusy("pdf");
    try {
      const w = await getVendors();
      const pdf = new w.jspdf!.jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      // One QR code per page, centred on an A4 page.
      const PAGE_W = 595, PAGE_H = 842;
      const cardW = 320;
      let first = true;
      for (const t of created) {
        const el = cardRefs.current.get(keyOf(t));
        if (!el) continue;
        const canvas = await w.html2canvas!(el, {
          scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false,
        });
        const h = (canvas.height / canvas.width) * cardW;
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(
          canvas.toDataURL("image/png"), "PNG",
          (PAGE_W - cardW) / 2, (PAGE_H - h) / 2, cardW, h
        );
      }
      pdf.save("table-qr-codes.pdf");
    } catch { alert("PDF download failed. Please try again."); }
    finally { setBusy(null); }
  }

  /* ── shared styles ── */
  const input: React.CSSProperties = {
    padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 9,
    fontSize: 13, fontFamily: "Inter, sans-serif", color: DARK,
    background: "#fff", outline: "none", width: "100%",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
    textTransform: "uppercase", color: MID, marginBottom: 6,
    fontFamily: "Inter, sans-serif",
  };
  const card: React.CSSProperties = {
    marginTop: 18, background: "#fff", border: `1px solid ${BORDER}`,
    borderRadius: 14, padding: "18px",
  };
  const btnBrown: React.CSSProperties = {
    padding: "10px 18px", background: BROWN, color: "#fff", border: "none",
    borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
    fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
  };
  const btnGhost: React.CSSProperties = {
    padding: "10px 18px", background: "#fff", color: BROWN,
    border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13,
    fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ padding: "22px 24px 32px", fontFamily: "Inter, sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: DARK }}>Table QR Codes</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: FAINT }}>
            Select a table group and tables, set your URL, then create QR codes.
            {source === "mock" && (
              <span style={{ color: BROWN, fontWeight: 700 }}> (Mock data — database not configured)</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={{ ...btnBrown, opacity: created.length ? 1 : 0.5 }} disabled={!created.length || busy != null} onClick={downloadPdf}>
            {busy === "pdf" ? "Preparing..." : `Download PDF (${created.length})`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
          {error} — you can still create QR codes using the Custom Table Name field below.
        </div>
      )}

      {/* ── 1) Table selection ── */}
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
          <div>
            <label style={lbl}>Table Group</label>
            <select style={input} value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="ALL">All Groups ({tables.length} tables)</option>
              {groups.map((g) => (
                <option key={g.groupName} value={g.groupName}>
                  {g.groupName} ({g.tableCount})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Table (filtered by group)</label>
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
              <option value="">Select a table...</option>
              {visible.map((t) => (
                <option key={keyOf(t)} value={keyOf(t)}>
                  {t.tableNo}{t.tableGroup ? ` — ${t.tableGroup}` : ""}
                </option>
              ))}
            </select>
          </div>
                  </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginTop: 14 }}>
          <div>
            <label style={lbl}>Custom Table Name</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={input}
                placeholder="e.g. T-99 or Patio-01"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
              />
              <button style={btnBrown} onClick={addCustom}>Add</button>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: FAINT }}>
              Must match a table in the POS (Tbl_Tables, enabled) — otherwise the QR is
              flagged “Not in POS” and guest orders from it will fail.
            </p>
          </div>
                  </div>

        {/* checkbox list */}
        <div style={{ marginTop: 16, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 13px",
            background: PALE, borderBottom: `1px solid ${BORDER}`,
            fontSize: 12.5, fontWeight: 700, color: DARK,
          }}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => toggleAllVisible(e.target.checked)}
            />
            <span>Select All</span>
            <span style={{ color: FAINT, fontWeight: 600 }}>
              {visible.length} tables · {selectedTables.length} selected
            </span>
            <span style={{ flex: 1 }} />
            <button
              style={{ ...btnGhost, padding: "5px 10px", fontSize: 11.5 }}
              onClick={() => setSelected(new Set())}
            >
              Clear Selection
            </button>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {loading ? (
              <p style={{ padding: "14px", margin: 0, color: FAINT, fontSize: 13 }}>Loading tables...</p>
            ) : visible.length === 0 ? (
              <p style={{ padding: "14px", margin: 0, color: FAINT, fontSize: 13 }}>
                No tables found. Change the group, or add a name using Custom Table Name above.
              </p>
            ) : (
              visible.map((t) => {
                const checked = selected.has(keyOf(t));
                return (
                  <label
                    key={keyOf(t)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 13px", cursor: "pointer", fontSize: 13,
                      background: checked ? "#FBF6EC" : "#fff",
                      borderBottom: `1px solid ${CREAM}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggle(t, e.target.checked)}
                    />
                    <span style={{ fontWeight: 800, color: DARK, minWidth: 80 }}>{t.tableNo}</span>
                    <span style={{ color: FAINT }}>{t.tableGroup || "—"}</span>
                    <span style={{ flex: 1 }} />
                    {source === "database" && tableExists[keyOf(t)] === false && (
                      <span
                        title="This table number is not in the POS (Tbl_Tables, Enable=1). Orders from its QR will fail with 'Table not found'."
                        style={{
                          fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 99,
                          background: "#fef3c7", color: "#b45309",
                        }}
                      >
                        ⚠ Not in POS
                      </span>
                    )}
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                      background: t.vacant ? "#dcfce7" : "#fee2e2",
                      color: t.vacant ? "#15803d" : "#b91c1c",
                    }}>
                      {t.vacant ? "Vacant" : "Occupied"}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {msg && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: BROWN, fontWeight: 600 }}>{msg}</p>}

        {source === "database" &&
          selectedTables.some((t) => tableExists[keyOf(t)] === false) && (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#b45309", fontWeight: 700 }}>
              ⚠ Some selected tables are not in the POS (Tbl_Tables) — guests scanning those
              QRs will see “Table not found”. Add the tables in the POS or remove them here.
            </p>
          )}

              </div>

      {/* ── 2) QR output settings (separate) ── */}
      <div style={card}>
        <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MID }}>
          QR Output Settings
        </p>
        <div>
          <label style={lbl}>QR URL (opened when the code is scanned)</label>
          <input
            style={input}
            placeholder="https://example.com/menu?id={id}  —  use the {id} placeholder (encrypted table id)"
            value={urlTemplate}
            onChange={(e) => setUrlTemplate(e.target.value)}
          />
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: FAINT }}>
            {urlTemplate.trim()
              ? <>Preview: <b style={{ color: BROWN }}>{buildUrl({ tableNo: "T-01", tableGroup: group !== "ALL" ? group : "Main Dining Area", vacant: true, listingOrder: 0 })}</b> — the link carries only the encrypted table id; the table number is decrypted on the menu page and shown on the welcome screen.</>
              : "If no URL is entered, the QR code contains the table number only."}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: FAINT }}>
            Placeholders: <b>{'{id}'}</b> = encrypted table id (recommended — nothing readable in the link) · <b>{'{table}'}</b> / <b>{'{group}'}</b> / <b>{'{token}'}</b> = legacy format (plain table + group + signed token).
          </p>
          <button
            type="button"
            onClick={() =>
              setUrlTemplate(
                `${window.location.origin}/menu?id={id}`
              )
            }
            style={{
              marginTop: 8,
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 12,
              fontWeight: 700,
              color: BROWN,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Use the customer menu page (/menu?id=&#123;id&#125; — encrypted table id only)
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18, marginTop: 16 }}>
                    <div>
            <label style={lbl}>Logo in QR centre</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: DARK, paddingTop: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />
              Show the Mila Mirissa logo in the centre of the QR code
            </label>
          </div>
        </div>
      </div>

      
      {/* Create — after the QR URL / output settings */}
      <button
          style={{ ...btnBrown, width: "100%", marginTop: 14, padding: "12px 18px", fontSize: 14, opacity: selectedTables.length ? 1 : 0.5 }}
          disabled={!selectedTables.length}
          onClick={createQrs}
        >
          Create QR Codes ({selectedTables.length} selected)
        </button>

      {/* ── 3) Generated QR codes ── */}
      <div ref={createdRef} style={{ marginTop: 26 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MID }}>
          Generated QR Codes — {created.length}
        </p>
        {created.length === 0 ? (
          <div style={{ background: "#fff", border: `1px dashed ${BORDER}`, borderRadius: 14, padding: "36px 20px", textAlign: "center", color: FAINT, fontSize: 13 }}>
            Select one or more tables above and click <b>Create QR Codes</b>.
          </div>
        ) : (
          <div style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
              {created.map((t) => {
                const url = buildUrl(t);
                const logoSize = Math.round(QR_SIZE * 0.22);
                return (
                  <div key={keyOf(t)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div
                      ref={(el) => {
                        if (el) cardRefs.current.set(keyOf(t), el);
                        else cardRefs.current.delete(keyOf(t));
                      }}
                      style={{
                        background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16,
                        padding: "18px 14px 14px", textAlign: "center",
                      }}
                    >
                      {/* Fixed-size, centred QR box. (width:100% caused
                          the QR to stretch/shift when captured to PNG,
                          and the logo inside the SVG did not render in
                          downloads — so the logo is also overlaid as a
                          normal image in the exact centre.) */}
                      <div
                        style={{
                          position: "relative",
                          width: QR_SIZE,
                          height: QR_SIZE,
                          margin: "0 auto",
                        }}
                      >
                        <QRCodeSVG
                          value={url}
                          size={QR_SIZE}
                          level="H"
                          bgColor="#ffffff"
                          fgColor={DARK}
                          style={{ display: "block" }}
                          imageSettings={
                            showLogo
                              ? { src: RESTAURANT_INFO.logoPath, height: logoSize, width: logoSize, excavate: true }
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
                              left: (QR_SIZE - logoSize) / 2,
                              top: (QR_SIZE - logoSize) / 2,
                              width: logoSize,
                              height: logoSize,
                              borderRadius: "50%",
                              objectFit: "contain",
                              background: "#ffffff",
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800, color: DARK, letterSpacing: 0.4 }}>
                        {t.tableNo}
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MID }}>
                        {RESTAURANT_INFO.name}
                        {t.tableGroup ? ` · ${t.tableGroup}` : ""}
                      </div>
                    </div>
                    <span
                      title={url}
                      style={{
                        fontSize: 10, color: FAINT, textAlign: "center",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {url}
                    </span>
                    <button
                      style={{ ...btnGhost, padding: "8px 10px", fontSize: 12 }}
                      disabled={busy != null}
                      onClick={() => downloadPng(t)}
                    >
                      {busy === t.tableNo ? "Preparing..." : `Download ${t.tableNo} PNG`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
