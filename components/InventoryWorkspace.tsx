"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from "react";

type Row = { code: string; name: string; values: Record<string, string | boolean> };
type Values = Record<string, string | boolean>;
const initial: Record<string, Row[]> = {
  locations: [
    { code: "BR02", name: "KANDY BRANCH", values: { code: "BR02", name: "KANDY BRANCH", address: "No 5, Peradeniya Road", enabled: true, main: true, sub: false, parent: "" } },
    { code: "HO", name: "HEAD OFFICE", values: { code: "HO", name: "HEAD OFFICE", address: "Colombo", enabled: true, main: true, sub: false, parent: "" } },
    { code: "BR01", name: "COLOMBO 03 BRANCH", values: { code: "BR01", name: "COLOMBO 03 BRANCH", address: "Colombo 03", enabled: true, main: false, sub: true, parent: "HO" } },
  ],
  categories: [
    { code: "BEV", name: "Beverages", values: { code: "BEV", name: "Beverages", enabled: true } },
    { code: "SVC", name: "Services", values: { code: "SVC", name: "Services", enabled: true } },
  ],
  items: [
    { code: "ITM000001", name: "Drinking Water 500ml", values: { code: "ITM000001", name: "Drinking Water 500ml", print: "Drinking Water", enabled: true, service: false, semi: false, wholesale: false, expiry: false, packing: false, rawCost: "800", markup: "0", cost: "800", margin: "50", retail: "1200", duration: "0", category: "Beverages", unit: "BOTTLE", supplier: "Lanka Beverage Suppliers", location: "HO" } },
    { code: "SVC000001", name: "Delivery Service", values: { code: "SVC000001", name: "Delivery Service", print: "Delivery", enabled: true, service: true, semi: false, wholesale: false, expiry: false, packing: false, rawCost: "0", markup: "0", cost: "0", margin: "0", retail: "2500", duration: "45", category: "Services", unit: "EACH", supplier: "", location: "HO" } },
  ],
  units: [
    { code: "UNT01", name: "BOTTLE", values: { code: "UNT01", name: "BOTTLE", enabled: true } },
    { code: "UNT02", name: "BOX", values: { code: "UNT02", name: "BOX", enabled: true } },
    { code: "UNT03", name: "EACH", values: { code: "UNT03", name: "EACH", enabled: true } },
  ],
  modes: [
    { code: "PM01", name: "Cash", values: { code: "PM01", name: "Cash", enabled: true, group: "Standard", cash: true, card: false, credit: false, zero: false, advance: false, complimentary: false, voucher: false, remarks: false } },
    { code: "PM02", name: "Credit Card", values: { code: "PM02", name: "Credit Card", enabled: true, group: "Standard", cash: false, card: true, credit: false, zero: false, advance: false, complimentary: false, voucher: false, remarks: false } },
  ],
  suppliers: [
    { code: "SUP001", name: "Lanka Beverage Suppliers", values: { code: "SUP001", name: "Lanka Beverage Suppliers", address: "No 1, Main St, Colombo", phone: "0112345678", email: "info@example.com", website: "www.example.com", debt: "15000", remarks: "Preferred supplier", enabled: true } },
    { code: "SUP002", name: "Fresh Foods Distributors", values: { code: "SUP002", name: "Fresh Foods Distributors", address: "No 8, Kandy Road", phone: "0772223344", email: "", website: "", debt: "0", remarks: "", enabled: true } },
  ],
};
const titles: Record<string, string> = { locations: "Location Master", categories: "Categories", items: "Item Master", units: "Unit Master", modes: "Modes", suppliers: "Supplier Master" };
const defaultValues: Record<string, Values> = {
  locations: { code: "", name: "", address: "", enabled: true, main: false, sub: false, parent: "" },
  categories: { code: "", name: "", enabled: true },
  items: { code: "", name: "", print: "", enabled: true, service: false, semi: false, wholesale: false, expiry: false, packing: false, rawCost: "0", markup: "0", cost: "0", margin: "0", retail: "0", duration: "0", category: "", unit: "", supplier: "", location: "HO", reorder: "0", min: "0", max: "0", wsQty: "0", wsPrice: "0", packSize: "0", packPrice: "0" },
  units: { code: "", name: "", enabled: true },
  modes: { code: "", name: "", enabled: true, group: "", cash: false, card: false, credit: false, zero: false, advance: false, complimentary: false, voucher: false, remarks: false },
  suppliers: { code: "", name: "", address: "", phone: "", email: "", website: "", debt: "0", remarks: "", enabled: true },
};
const labels: Record<string, [string, string][]> = {
  locations: [["code", "Location Code"], ["name", "Location Description"], ["address", "Address"]],
  categories: [["code", "Category Code"], ["name", "Category Description"]],
  units: [["code", "Unit Code"], ["name", "Unit Description"]],
  modes: [["code", "Code"], ["name", "Description"]],
  suppliers: [["code", "Supplier ID"], ["name", "Supplier Name"], ["address", "Address"], ["phone", "Contact Number"], ["email", "Email(s)"], ["website", "Website"], ["debt", "Debt / Outstanding Amount (LKR)"], ["remarks", "Remarks"]],
};
const colors = { ink: "#45301D", brown: "#684830", muted: "#806B56", border: "#E4D6BF", pale: "#F4EAD9", bg: "#FCF7F3" };
declare global { interface Window { __inventoryCanLeave?: (message?: string) => boolean } }

export default function InventoryWorkspace() {
  const pathname = usePathname();
  const route = pathname.split("/").filter(Boolean).at(-1) || "locations";
  const screen = ["locations", "categories", "items", "units", "modes", "suppliers"].includes(route) ? route : "locations";
  const [rows, setRows] = useState<Record<string, Row[]>>(initial);
  const [unitRows, setUnitRows] = useState<Record<string, Row[]>>({ master: initial.units, sub: [{ code: "SUB01", name: "ML", values: { code: "SUB01", name: "ML", enabled: true } }], conversion: [{ code: "CV01", name: "BOTTLE → ML", values: { code: "CV01", name: "BOTTLE → ML", master: "BOTTLE", sub: "ML", ratio: "500", enabled: true } }] });
  const [modeRows, setModeRows] = useState<Record<string, Row[]>>({ booking: [], payment: initial.modes, groups: [{ code: "PG01", name: "Standard", values: { code: "PG01", name: "Standard", enabled: true } }] });
  const [categoryRows, setCategoryRows] = useState<Record<number, Row[]>>({ 1: initial.categories, 2: [{ code: "COLD", name: "Cold Drinks", values: { code: "COLD", name: "Cold Drinks", enabled: true } }, { code: "HOT", name: "Hot Drinks", values: { code: "HOT", name: "Hot Drinks", enabled: true } }], 3: [{ code: "DINING", name: "Dine-in", values: { code: "DINING", name: "Dine-in", enabled: true } }] });
  const [categoryLevel, setCategoryLevel] = useState(1);
  const [unitTab, setUnitTab] = useState("master");
  const [modeTab, setModeTab] = useState("booking");
  const [form, setForm] = useState<Values>(defaultValues[screen]);
  const [loaded, setLoaded] = useState<Row | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [browse, setBrowse] = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseType, setBrowseType] = useState("All Types");
  const [browseLocation, setBrowseLocation] = useState("All Locations");
  const [browseCategory, setBrowseCategory] = useState("All Categories");
  const [browseStatus, setBrowseStatus] = useState("All Status");
  const [batchView, setBatchView] = useState<{ code: string; name: string } | null>(null);
  const [image, setImage] = useState("");
  const [recipeTab, setRecipeTab] = useState("details");
  const [dirtyGuardOn, setDirtyGuardOn] = useState(true);
  const [focusField, setFocusField] = useState(0);
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [locs, setLocs] = useState([{ code: "HO", name: "Head Office", enabled: true, stock: 0, margin: 50, retail: 1200, ws: 0 }, { code: "BR02", name: "Kandy Branch", enabled: true, stock: 0, margin: 50, retail: 1200, ws: 0 }]);

  const activeTab = screen === "units" ? unitTab : screen === "modes" ? modeTab : "";
  const getRows = () => screen === "categories" ? categoryRows[categoryLevel] : screen === "units" ? unitRows[unitTab] : screen === "modes" ? modeRows[modeTab] : rows[screen];
  const visibleRows = useMemo(() => (getRows() ?? []).filter(r => `${r.code} ${r.name}`.toLowerCase().includes(search.toLowerCase())), [rows, unitRows, modeRows, categoryRows, screen, categoryLevel, unitTab, modeTab, search]);
  const filteredBrowseItems = useMemo(() => rows.items.filter(r => {
    const textMatch = `${r.code} ${r.name}`.toLowerCase().includes(browseSearch.toLowerCase());
    const typeMatch = browseType === "All Types" || (browseType === "Service") === Boolean(r.values.service);
    const categoryMatch = browseCategory === "All Categories" || r.values.category === browseCategory;
    const statusMatch = browseStatus === "All Status" || (browseStatus === "Enabled" ? Boolean(r.values.enabled) : !r.values.enabled);
    const locationMatch = browseLocation === "All Locations" || r.values.location === browseLocation;
    return textMatch && typeMatch && categoryMatch && statusMatch && locationMatch;
  }), [rows.items, browseSearch, browseType, browseCategory, browseStatus, browseLocation]);
  const dirty = useMemo(() => {
    if (!loaded) return isNew && Object.entries(form).some(([k, v]) => k === "code" || k === "name" ? String(v ?? "") !== "" : false);
    return JSON.stringify(form) !== JSON.stringify(loaded.values);
  }, [form, isNew, loaded]);

  useEffect(() => {
    setForm(defaultValues[screen]); setLoaded(null); setIsNew(false); setSearch(""); setRecipeTab("details"); setImage("");
    if (screen === "categories") setCategoryLevel(1);
    if (screen === "units") setUnitTab("master");
    if (screen === "modes") setModeTab("booking");
  }, [screen]);
  useEffect(() => { if (toast) { const t = window.setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { window.__inventoryCanLeave = (message = "Leave page without saving?") => !(dirty && (screen === "categories" || screen === "suppliers")) || window.confirm(message); return () => { delete window.__inventoryCanLeave; }; }, [dirty, screen]);
  useEffect(() => { const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirty && (screen === "categories" || screen === "suppliers")) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", onBeforeUnload); return () => window.removeEventListener("beforeunload", onBeforeUnload); }, [dirty, screen]);
  useEffect(() => { if (isNew && screen === "locations") codeRef.current?.focus(); }, [isNew, screen]);

  const set = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const currentName = String(form.name ?? "");
  const currentCode = String(form.code ?? "");
  const isDirtyProtected = screen === "categories" || screen === "suppliers";
  const confirmDiscard = (message: string) => !dirty || !isDirtyProtected || window.confirm(message);
  function selectRow(row: Row) {
    if (loaded?.code === row.code && !isNew) return;
    if (!confirmDiscard(screen === "suppliers" ? "Discard unsaved changes and switch supplier?" : "Discard unsaved changes?")) return;
    setLoaded(row); setForm({ ...defaultValues[screen], ...row.values }); setIsNew(false); setRecipeTab("details"); setSearch(search); detailRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }
  function newRecord() {
    if (!confirmDiscard(`Discard unsaved changes and create a new ${screen === "suppliers" ? "supplier" : "category"}?`)) return;
    setLoaded(null); setIsNew(true); setForm({ ...defaultValues[screen] }); setRecipeTab("details"); setImage("");
    if (screen === "modes") set("code", nextCode(getRows() ?? [], modeTab === "payment" ? "PM" : modeTab === "booking" ? "BT" : "PG"));
    if (screen === "items") { setLocs(locs.map(l => ({ ...l, enabled: true, stock: 0, margin: 0, retail: 0, ws: 0 }))); setTimeout(() => codeRef.current?.focus(), 60); }
    if (screen === "suppliers") setTimeout(() => codeRef.current?.focus(), 60);
  }
  function clearForm() {
    if (loaded) setForm({ ...defaultValues[screen], ...loaded.values }); else setForm({ ...defaultValues[screen] });
    if (screen === "items") setImage("");
  }
  function doSave() {
    if (loading) return;
    const code = currentCode.trim(); const name = currentName.trim();
    if (screen === "locations") {
      if (isNew && !code) return notify("Location code is required");
      if (code.length > 10) return notify("Location code is too long");
      if (!name) return notify("Location description is required");
      if (name.length > 50) return notify("Location description must be 50 characters or less");
      if (String(form.address).length > 300) return notify("Address must be 300 characters or less");
      if (form.main && form.sub) return notify("Main and Sub cannot both be selected");
      if (form.sub && !form.parent) return notify("Choose a Main Location");
    } else if (screen === "categories") { if (!code) return notify("Category Code is required"); if (!name) return notify("Category Description is required"); }
    else if (screen === "items") { if (isNew && !code) return notify("Item Code is required"); if (!name) return notify("Item Description is required"); }
    else if (screen === "suppliers") { if (!name) return notify("Supplier Name is required"); if (isNew && !code) return notify("Supplier ID is required"); }
    else { if (!name) return notify(`${screen === "units" ? "Unit" : modeTab === "booking" ? "Booking Type" : modeTab === "payment" ? "Payment Mode" : "Payment Group"} Description is required`); if (isNew && !code) return notify("Code is required"); }
    setLoading(true);
    window.setTimeout(() => {
      const saved: Row = { code: code || nextCode(getRows() ?? [], screen === "suppliers" ? "SUP" : screen === "categories" ? `CAT${categoryLevel}` : screen === "items" ? "ITM" : screen === "units" ? "UNT" : "LOC"), name, values: { ...form, code: code || nextCode(getRows() ?? [], "NEW"), name } };
      if (screen === "categories") setCategoryRows(p => ({ ...p, [categoryLevel]: upsert(p[categoryLevel], saved) }));
      else if (screen === "units") setUnitRows(p => ({ ...p, [unitTab]: upsert(p[unitTab], saved) }));
      else if (screen === "modes") setModeRows(p => ({ ...p, [modeTab]: upsert(p[modeTab], saved) }));
      else setRows(p => ({ ...p, [screen]: upsert(p[screen], saved) }));
      const blankAfter = screen === "items" || screen === "units" || screen === "modes";
      if (blankAfter) { setLoaded(null); setIsNew(true); setForm({ ...defaultValues[screen] }); if (screen === "items") setImage(""); }
      else { setLoaded(saved); setIsNew(false); setForm(saved.values); }
      setLoading(false); notify(`${screen === "locations" ? "Location" : screen === "categories" ? isNew ? "Category created ✓" : "Saved successfully ✓" : screen === "items" ? "Item saved ✓" : screen === "units" ? "Unit saved ✓" : screen === "modes" ? "Mode saved ✓" : "Supplier saved ✓"}${screen === "locations" ? ` saved: ${name}` : ""}`);
    }, 220);
  }
  function doDelete() {
    if (!loaded || isNew || loading) return;
    const msg = screen === "locations" ? `Delete location "${loaded.name}" (${loaded.code})?` : screen === "suppliers" ? `Delete supplier "${loaded.name}" (${loaded.code})?` : screen === "items" ? `Delete "${loaded.name}" (${loaded.code})?\nAn item that is still used by bookings, recipes or bills cannot be deleted — you will be offered to deactivate it instead.` : screen === "modes" ? `Delete ${modeTab === "booking" ? "booking type" : modeTab === "payment" ? "payment mode" : "payment group"} "${loaded.name}" (${loaded.code})?` : `Delete "${loaded.name}" (${loaded.code})?`;
    if (!window.confirm(`${msg}\nThis cannot be undone.`)) return;
    if (screen === "items" && Boolean(loaded.values.service)) {
      if (!window.confirm("This service item is still referenced by recipes or bookings.\nDeactivate it instead?\nThe item disappears from pickers while historical records keep its name.")) return;
      const deactivated = { ...loaded, values: { ...loaded.values, enabled: false } };
      setRows(p => ({ ...p, items: upsert(p.items, deactivated) }));
      setLoaded(deactivated); setForm(deactivated.values); notify("Item deactivated"); return;
    }
    if (screen === "modes" && loaded.code === "PM01" && !window.confirm("This payment mode is in use by existing transactions. Delete it anyway?")) return;
    const list = getRows() ?? []; const remaining = list.filter(r => r.code !== loaded.code);
    if (screen === "categories") setCategoryRows(p => ({ ...p, [categoryLevel]: remaining })); else if (screen === "units") setUnitRows(p => ({ ...p, [unitTab]: remaining })); else if (screen === "modes") setModeRows(p => ({ ...p, [modeTab]: remaining })); else setRows(p => ({ ...p, [screen]: remaining }));
    setLoaded(null); setIsNew(remaining.length === 0); setForm(remaining.length ? { ...defaultValues[screen], ...remaining[0].values } : { ...defaultValues[screen] }); setLoaded(remaining.length ? remaining[0] : null); notify(screen === "locations" ? "Location deleted" : screen === "categories" ? "Deleted successfully." : "Deleted successfully.");
  }
  function notify(text: string) { setToast(text); }
  function switchContext(fn: () => void, message = "Discard unsaved changes?") { if (confirmDiscard(message)) fn(); }
  function onEnter(e: KeyboardEvent<HTMLElement>, id: string) { if (e.key !== "Enter" || e.shiftKey) return; e.preventDefault(); const order = screen === "locations" ? ["code", "name", "address", "enabled"] : screen === "categories" ? ["code", "name", "enabled"] : screen === "suppliers" ? ["code", "name", "address", "phone", "email", "website", "debt", "remarks", "enabled"] : ["code", "name", "print"]; const i = order.indexOf(id); if (screen === "items" && id === "name" && !currentName.trim()) return notify("Item Description is required"); const next = order[i + 1]; if (next) document.getElementById(`field-${next}`)?.focus(); else document.getElementById("inventory-save")?.focus(); }
  useEffect(() => { const handler = (e: globalThis.KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); doSave(); } if (e.key === "Escape") setBrowse(false); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); });

  const pageTitle = screen === "categories" ? "Category Master" : titles[screen];
  const tabs = screen === "categories" ? [1, 2, 3].map(n => [`Category ${n}`, String(n)]) : screen === "units" ? [["Master Units", "master"], ["Sub Units", "sub"], ["Unit Conversion", "conversion"]] : screen === "modes" ? [["Booking Types", "booking"], ["Payment Modes", "payment"], ["Payment Groups", "groups"]] : [];
  const tabValue = screen === "categories" ? String(categoryLevel) : activeTab;
  const doSwitchTab = (key: string) => switchContext(() => {
    if (screen === "categories") { setCategoryLevel(Number(key)); setSearch(""); setLoaded(null); setIsNew(true); setForm({ ...defaultValues.categories }); }
    if (screen === "units") { setUnitTab(key); setSearch(""); setLoaded(null); setIsNew(true); setForm({ ...defaultValues.units }); }
    if (screen === "modes") { setModeTab(key); setSearch(""); setLoaded(null); setIsNew(true); setForm({ ...defaultValues.modes }); }
  }, "Discard unsaved changes?");

  function itemField(key: string, label: string, value: string | boolean, options?: { type?: string; readOnly?: boolean; list?: string; onChange?: (v: string) => void }) {
    return <Field key={key} label={label} id={key} value={String(value ?? "")} inputRef={key === "code" ? codeRef : undefined} list={screen === "items" && key === "code" ? "inventory-item-codes" : undefined} onKeyDown={e => onEnter(e, key)} type={options?.type ?? "text"} readOnly={options?.readOnly} onChange={options?.onChange ?? (v => set(key, key === "code" ? v.toUpperCase() : v))} />;
  }
  function box(title: string, content: ReactNode, id?: string) { return <section id={id} style={panel}><div style={panelHead}>{title}</div><div style={{ padding: 16 }}>{content}</div></section>; }
  function check(label: string, key: string, onChange?: (v: boolean) => void) { return <label style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13 }}><input id={`field-${key}`} type="checkbox" checked={Boolean(form[key])} onChange={e => onChange ? onChange(e.target.checked) : set(key, e.target.checked)} />{label}</label>; }

  return <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "18px clamp(14px, 2vw, 24px) 90px", color: colors.ink, fontFamily: "Inter, sans-serif" }}>
    <div style={{ maxWidth: 1700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 18 }}><div><small style={eyebrow}>RESTAURANT · INVENTORY</small><h1 style={{ margin: "5px 0", fontSize: 23 }}>{pageTitle}</h1><p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{descFor(screen)}</p></div><div style={{ display: "flex", gap: 8 }}>{screen === "items" && <button style={btn(false)} onClick={() => setBrowse(true)}>▦　Browse</button>}<button style={btn(true)} onClick={newRecord}>＋　New {screen === "items" ? "Item" : screen === "suppliers" ? "Supplier" : screen === "locations" ? "Location" : screen === "categories" ? "Category" : "Record"}</button></div></div>
      {tabs.length > 0 && <div style={segment}>{tabs.map(([label, key]) => <button key={key} onClick={() => doSwitchTab(key)} style={{ ...segmentBtn, ...(tabValue === key ? segmentActive : {}) }}>{label}</button>)}</div>}
      {screen === "items" && <div style={{ display: "flex", gap: 6, padding: "7px 10px", border: `1px solid ${colors.border}`, borderRadius: 10, overflowX: "auto", marginBottom: 14, background: "#fff" }}>{["Identification", "Categories", "Flags", "Cost & Margin", "Reorder & Stock", "Locations", "Image"].map(t => <button key={t} onClick={() => document.getElementById(`item-${t.toLowerCase().replaceAll(" & ", "-").replaceAll(" ", "-")}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} style={quickNav}>{t}</button>)}</div>}
      <div style={layout} className="inventory-columns">
        <aside style={listCard}><div style={{ padding: 16, borderBottom: `1px solid ${colors.border}` }}><div style={{ display: "flex", justifyContent: "space-between", fontWeight: 750, marginBottom: 11 }}><span>{screen === "categories" ? `Category ${categoryLevel}` : screen === "units" ? unitTab === "master" ? "Master Units" : unitTab === "sub" ? "Sub Units" : "Conversions" : screen === "modes" ? modeTab === "booking" ? "Booking Types" : modeTab === "payment" ? "Payment Modes" : "Payment Groups" : pageTitle}</span><span style={{ color: colors.muted, fontSize: 12, fontWeight: 500 }}>{visibleRows.length} total</span></div><input aria-label="Search" placeholder={`⌕  Search ${pageTitle.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} style={{ ...input, width: "100%" }} /><button style={{ ...btn(true), width: "100%", marginTop: 10 }} onClick={newRecord}>＋　New {screen === "items" ? "Item" : screen === "suppliers" ? "Supplier" : screen === "locations" ? "Location" : screen === "categories" ? "Category" : "Record"}</button>{screen === "categories" && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: colors.muted }}><span>Active <b>{getRows().filter(r => r.values.enabled).length}</b></span><span>Inactive <b>{getRows().filter(r => !r.values.enabled).length}</b></span></div>}</div>
          <div style={{ maxHeight: screen === "items" ? "calc(100vh - 360px)" : "60vh", overflow: "auto" }}>{visibleRows.length ? visibleRows.map(row => <button key={row.code} onClick={() => selectRow(row)} style={{ ...rowButton, ...(loaded?.code === row.code ? rowActive : {}) }}><span style={tile}>{screen === "locations" ? "⌖" : screen === "items" ? "◇" : screen === "suppliers" ? "♧" : "◈"}</span><span style={{ textAlign: "left", minWidth: 0 }}><b style={{ display: "block", fontSize: 13 }}>{row.name}</b><small style={{ display: "block", color: colors.muted, marginTop: 4 }}>{row.code}{screen === "items" ? ` · ${row.values.service ? "Service" : "Raw Item"} · ${row.values.category}` : screen === "suppliers" ? ` · ${row.values.address ? String(row.values.address).split(",").at(-1)?.trim() : ""}` : ""}</small><i style={statusPill(Boolean(row.values.enabled))}>{row.values.enabled ? "Active" : "Inactive"}</i></span></button>) : <div style={{ padding: 24, color: colors.muted, textAlign: "center" }}>No records found</div>}</div>
        </aside>
        <section style={detailCard} ref={detailRef}>
          <header style={detailHeader}><small style={{ color: "#DDCBB3", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>{isNew ? `NEW ${pageTitle.toUpperCase()}` : loaded ? `EDIT ${pageTitle.toUpperCase()}` : "NO RECORD SELECTED"}</small><h2 style={{ margin: "5px 0", fontSize: 18 }}>{screen === "locations" ? "LOCATION DETAIL" : screen === "categories" ? "CATEGORY MASTER DETAIL" : screen === "items" ? "ITEM MASTER DETAIL" : screen === "units" ? "UNIT MASTER DETAIL" : screen === "modes" ? "MODE DETAIL" : "SUPPLIER MASTER DETAIL"}{screen === "locations" && (form.main || form.sub) && <span style={badge}>{form.main ? "MAIN" : "SUB"}</span>}</h2><div style={{ color: "#E4D6BF", fontSize: 11 }}>{!loaded && !isNew ? "Select a record from the list, or click New." : isNew ? `New ${screen === "items" ? "Item" : pageTitle}` : `Editing ${currentCode}`}{dirty && screen === "suppliers" && <b style={{ color: "#FFD0A1", marginLeft: 12 }}>• Unsaved changes</b>}</div></header>
          <div style={{ padding: 16, overflow: "visible" }}>
            {screen === "items" ? <>
              <div style={{ display: "flex", gap: 8, marginBottom: 15 }}><button style={btn(recipeTab === "details")} onClick={() => setRecipeTab("details")}>Item Details</button><button style={btn(recipeTab === "recipe")} onClick={() => isNew ? notify("Save item first to manage recipe") : setRecipeTab("recipe")}>Recipe Management {isNew && <small>(save first)</small>}</button></div>
              {recipeTab === "recipe" ? box("RECIPE INGREDIENTS", <><p style={{ color: colors.muted }}>Recipe ingredients for {loaded?.name} · Primary location: {form.location}</p><div style={{ ...input, width: "100%" }}>No recipe ingredients configured in this UI preview.</div></>) : <>
                {box("◇　ITEM IDENTIFICATION", <div style={formGrid}>{itemField("code", "Item Code", form.code, { readOnly: !isNew && Boolean(loaded), onChange: v => { const code = v.toUpperCase(); set("code", code); const match = rows.items.find(r => r.code.toUpperCase() === code); if (match) selectRow(match); } })}<datalist id="inventory-item-codes">{rows.items.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</datalist>{itemField("name", "Item Description *", form.name, { onChange: v => set("name", v) })}{itemField("print", "Print Description", form.print)}{selectField("Master Unit", "unit", ["BOTTLE", "BOX", "EACH"])}{selectField("Supplier", "supplier", ["", "Lanka Beverage Suppliers", "Fresh Foods Distributors"])}</div>, "item-identification")}
                {box("▤　ITEM CATEGORIES", <div style={formGrid}>{selectField("Category 1", "category", ["", "Beverages", "Services"])}{selectField("Sub Category 1", "subcat1", ["", "Cold Drinks", "Hot Drinks"])}{selectField("Sub Category 2", "subcat2", ["", "Hot Drinks"])}{selectField("Sub Category 3", "subcat3", ["", "Dine-in"] )}</div>, "item-categories")}
                {box(`⚑　FLAGS　 ·　${["service", "semi", "wholesale", "expiry", "packing"].filter(k => form[k]).length} / 5 active`, <div style={flagGrid}>{flagCard("Service Item", "Non-physical / service-based", "service", "#8656c9", () => { const on = !form.service; setForm(p => ({ ...p, service: on, semi: on ? false : p.semi, duration: on ? p.duration : "0" })); })}{flagCard("Semi-Finished Prod", "Intermediate production item", "semi", "#c34c7a", () => { const on = !form.semi; setForm(p => ({ ...p, semi: on, service: on ? false : p.service })); })}{flagCard("Wholesale Pricing", "Wholesale rate applicable", "wholesale", "#5583b5", () => set("wholesale", !form.wholesale), <div style={{ display: "flex", gap: 8 }}><MiniNumber label="WS Qty" disabled={!form.wholesale} value={String(form.wsQty)} onChange={v => set("wsQty", v)} /><MiniNumber label="WS Price" disabled={!form.wholesale} value={String(form.wsPrice)} onChange={v => set("wsPrice", v)} /></div>)}{flagCard("Expiry Tracking", "Track expiration dates", "expiry", "#d0803e", () => set("expiry", !form.expiry))}{flagCard("Packing Details", "Has pack size & price", "packing", "#298c7e", () => set("packing", !form.packing), <div style={{ display: "flex", gap: 8 }}><MiniNumber label="Pack Size" disabled={!form.packing} value={String(form.packSize)} onChange={v => set("packSize", v)} /><MiniNumber label="Pack Price" disabled={!form.packing} value={String(form.packPrice)} onChange={v => set("packPrice", v)} /></div>)}</div>, "item-flags")}
                {box("＄　COST & MARGIN", <div style={formGrid}>{numberField("Raw Cost", "rawCost")}{numberField("Cost Markup %", "markup")}{<div style={fieldWrap}><label>Overall Cost (calculated)</label><input style={input} readOnly value={String(form.cost ?? "")} /></div>}{numberField("Sales Margin %", "margin")}{numberField("Retail Price", "retail")}</div>, "item-cost-margin")}
                {box("▣　REORDER & STOCK", <div style={formGrid}>{numberField("Re-Order Level", "reorder")}{numberField("Minimum Quantity", "min")}{numberField("Maximum Quantity", "max")}</div>, "item-reorder-stock")}
                {box("⌖　LOCATIONS", <><div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Loc Code", "Location Name", "Enable", "Stock", "Sales Margin %", "Retail Price", "WS Price"].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{locs.map((l, i) => <tr key={l.code}><td>{l.code}</td><td>{l.name}</td><td><input type="checkbox" checked={l.enabled} onChange={e => { if (!e.target.checked && l.stock !== 0) return notify(`${l.name} cannot be disabled while stock is ${l.stock}`); setLocs(prev => prev.map((x, j) => i === j ? { ...x, enabled: e.target.checked } : x)); }} /></td><td>{l.stock}</td><td><input style={smallInput} type="number" value={l.margin} onChange={e => updateLocation(i, { margin: Number(e.target.value), retail: Number(form.cost || 0) * (1 + Number(e.target.value) / 100) })} /></td><td><input style={smallInput} type="number" value={l.retail} onChange={e => { const retail = Number(e.target.value), cost = Number(form.cost || 0); updateLocation(i, { retail, margin: cost ? (retail - cost) / cost * 100 : 0 }); }} /></td><td><input style={smallInput} type="number" value={l.ws} onChange={e => updateLocation(i, { ws: Number(e.target.value) })} /></td></tr>)}</tbody></table></div><div style={summaryGrid}>{locs.map(l => <div key={l.code} style={summaryCard}><b>{l.code} · {l.name}</b><i style={statusPill(l.enabled)}>{l.enabled ? "Active" : "Inactive"}</i><div>Stock <button style={linkBtn} onClick={() => setBatchView({ code: l.code, name: l.name })}>{l.stock} ▸ batches</button></div><div>Margin <b>{l.margin.toFixed(1)}%</b></div><div>Retail <b>{money(l.retail)}</b></div><div>WS Price <b>{money(l.ws)}</b></div></div>)}</div></>, "item-locations")}
                {box("▧　IMAGE", <div style={{ display: "flex", alignItems: "center", gap: 14 }}><div style={imageBox}>{image ? <img src={image} alt="Item preview" style={{ width: 96, height: 96, objectFit: "cover" }} /> : <span style={{ color: colors.muted }}>◇<br/>No Image</span>}</div><label style={btn(false)}>Upload<input hidden type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) setImage(URL.createObjectURL(file)); }} /></label>{image && <button style={btn(false)} onClick={() => setImage("")}>Remove</button>}</div>, "item-image")}
              </>}
            </> : screen === "locations" ? <>
              {box("⌖　LOCATION DETAILS", <div style={formGrid}>{itemField("code", "Location Code (LocCode) *", form.code, { readOnly: Boolean(loaded), onChange: v => set("code", v.toUpperCase()) })}{<div>{itemField("name", "Location Description *", form.name)}<small style={counter}>{String(form.name).length} / 50</small></div>}<div style={{ ...fieldWrap, gridColumn: "1/-1" }}><label>Address</label><textarea id="field-address" value={String(form.address)} maxLength={300} onKeyDown={e => onEnter(e, "address")} onChange={e => set("address", e.target.value)} style={{ ...input, height: 76, resize: "vertical" }} /><small style={counter}>{String(form.address).length} / 300</small></div></div>)}
              {box("▣　STATUS", <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>{check("Enable", "enabled")}{check("Main Location", "main", on => setForm(p => ({ ...p, main: on, sub: on ? false : p.sub, parent: on ? "" : p.parent })))}{check("Sub Location", "sub", on => { const first = rows.locations.find(x => x.values.main); setForm(p => ({ ...p, sub: on, main: on ? false : p.main, parent: on ? String(p.parent || first?.code || "") : "" })); })}</div>)}
              {form.sub && box("⌖　MAIN LOCATION", <div style={fieldWrap}><select style={input} value={String(form.parent)} onChange={e => set("parent", e.target.value)}><option value="">Select a main location</option>{rows.locations.filter(r => r.values.main && r.code !== loaded?.code).map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select><small style={{ color: rows.locations.some(r => r.values.main) ? colors.muted : "#aa6a16" }}>{rows.locations.some(r => r.values.main) ? `Linked to ${rows.locations.find(r => r.code === form.parent)?.name ?? "selected main location"}` : "No Main locations are available. Create one first."}</small></div>)}
            </> : screen === "categories" ? box(`▦　CATEGORY DETAILS LEVEL ${categoryLevel}`, <div style={formGrid}>{itemField("code", "Category Code", form.code, { onChange: v => set("code", v.toUpperCase()) })}{itemField("name", "Category Description", form.name)}{check("Enable", "enabled")}</div>) : screen === "units" ? <>
              {unitTab === "conversion" ? box("↔　UNIT CONVERSION", <div style={formGrid}><SelectField label="Master Unit" options={["BOTTLE", "BOX", "EACH"]} value={String(form.master ?? "")} onChange={v => set("master", v)} /><SelectField label="Sub Unit" options={["ML", "G"]} value={String(form.sub ?? "")} onChange={v => set("sub", v)} />{itemField("ratio", "Conversion Ratio", form.ratio ?? "1", { type: "number" })}</div>) : <>{box(unitTab === "master" ? "◇　MASTER UNIT IDENTIFICATION" : "◇　SUB UNIT IDENTIFICATION", <div style={formGrid}>{itemField("code", "Unit Code (MasterUnitID) *", form.code)}{itemField("name", "Unit Description (UnitDes) *", form.name)}{check("Enable", "enabled")}</div>)}{box("↔　USED IN CONVERSIONS", loaded ? <div>{unitRows.conversion.filter(r => String(r.values.master) === loaded.name || String(r.values.sub) === loaded.name).map(r => <div key={r.code} style={{ padding: 8 }}>{r.name} · Ratio {r.values.ratio}</div>)}{unitRows.conversion.every(r => String(r.values.master) !== loaded.name && String(r.values.sub) !== loaded.name) && <span style={{ color: colors.muted }}>No conversion mappings yet.</span>}</div> : <span style={{ color: colors.muted }}>Select a unit to see its conversion references.</span>)}</>}
            </> : screen === "modes" ? <>{box(modeTab === "payment" ? "▤　PAYMENT MODE IDENTIFICATION" : modeTab === "booking" ? "◇　BOOKING TYPE IDENTIFICATION" : "▦　PAYMENT GROUP IDENTIFICATION", <div style={formGrid}>{itemField("code", modeTab === "payment" ? "Code (PayCode)" : "Code", form.code)}{itemField("name", modeTab === "payment" ? "Payment Mode" : modeTab === "booking" ? "Booking Type Description" : "Payment Group", form.name)}{modeTab === "payment" && <SelectField label="Payment Group" options={["Standard", "Other"]} value={String(form.group)} onChange={v => set("group", v)} />}{check("Enable", "enabled")}</div>)}{modeTab === "payment" && <>{box("＄　WHAT KIND OF MONEY IS THIS", <div style={{ display: "grid", gap: 9 }}>{[["zero", "Zero Value"], ["cash", "Cash"], ["card", "Credit Card"], ["credit", "Credit (on account)"], ["advance", "Advance Payment"], ["complimentary", "Complementary"], ["voucher", "Voucher"]].map(([k, label]) => <label key={k}><input type="checkbox" checked={Boolean(form[k])} onChange={e => set(k, e.target.checked)} />　{label}</label>)}</div>)}{box("▤　SALES FIGURES & REMARKS", <div style={{ display: "flex", gap: 18 }}><label><input type="checkbox" checked={Boolean(form.remarks)} onChange={e => set("remarks", e.target.checked)} /> Remarks Needed</label><SelectField label="Sales treatment" options={["Add to Sales", "Deduct from Sales", "Do Not Show In Sales"]} value={String(form.sales ?? "Add to Sales")} onChange={v => set("sales", v)} /></div>)}</>}</> : <>
              {box("♧　SUPPLIER IDENTIFICATION", <div style={formGrid}>{itemField("code", "Supplier ID *", form.code, { readOnly: Boolean(loaded), onChange: v => set("code", v.toUpperCase()) })}{itemField("name", "Supplier Name *", form.name)}{check("Active", "enabled")}{itemField("address", "Address", form.address)}</div>)}
              {box("☎　CONTACT INFORMATION", <><div style={formGrid}>{itemField("phone", "Contact Number", form.phone)}{itemField("email", "Email", form.email)}{itemField("website", "Website", form.website)}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>{form.phone && <a style={chip} href={`tel:${form.phone}`}>☎ {form.phone}</a>}{form.email && <a style={chip} href={`mailto:${form.email}`}>✉ {form.email}</a>}{form.website && <a style={chip} href={`https://${String(form.website).replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">↗ {form.website}</a>}</div></>)}
              {box("＄　FINANCIAL", <div style={formGrid}>{itemField("debt", "Debt / Outstanding Amount (LKR)", form.debt, { type: "number" })}<div style={{ ...debtBanner, background: Number(form.debt) > 0 ? "#fff0ee" : "#e8f7ec", color: Number(form.debt) > 0 ? "#b33636" : "#32804c" }}>{Number(form.debt) > 0 ? `⚠ LKR ${money(Number(form.debt))} Outstanding` : "✓ Cleared"}</div></div>)}
              {box("▤　REMARKS & NOTES", <textarea id="field-remarks" value={String(form.remarks)} onKeyDown={e => onEnter(e, "remarks")} onChange={e => set("remarks", e.target.value)} style={{ ...input, width: "100%", minHeight: 68 }} />)}
              {box("◷　AUDIT INFORMATION", <div style={{ color: colors.muted, fontSize: 12 }}>Created by: {loaded ? "Administrator" : "New record"}　·　Created: {loaded ? "2025-01-15" : "—"}<br/>Last updated: {loaded ? "Administrator · 2025-01-15" : "—"}</div>)}
            </>}
          </div>
          <footer style={actionBar}><div style={{ display: "flex", gap: 8 }}><button style={btn(false)} disabled={loading} onClick={clearForm}>↶　Clear</button><button style={btn(false)} disabled={loading} onClick={() => window.print()}>▧　Print</button></div><span style={{ flex: 1 }} /><div style={{ display: "flex", gap: 8 }}>{loaded && !isNew && <button style={{ ...btn(false), color: "#b63e3e" }} disabled={loading} onClick={doDelete}>Delete</button>}<button id="inventory-save" style={btn(true)} disabled={loading} onClick={doSave}>{loading ? "Saving…" : "▣　Save"}</button></div></footer>
        </section>
      </div>
    </div>
    {browse && <div style={overlay} onClick={() => setBrowse(false)}><div style={browseModal} onClick={e => e.stopPropagation()}><header style={detailHeader}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><small style={{ color: "#DDCBB3" }}>ITEM MASTER</small><h2 style={{ margin: "4px 0" }}>All Items ({filteredBrowseItems.length} / {rows.items.length})</h2></div><button aria-label="Close" style={btn(false)} onClick={() => setBrowse(false)}>×</button></div></header><div style={{ padding: 14, display: "flex", gap: 8, flexWrap: "wrap" }}><input placeholder="Search code or name…" value={browseSearch} onChange={e => setBrowseSearch(e.target.value)} style={{ ...input, flex: 1, minWidth: 160 }} /><select style={input} value={browseLocation} onChange={e => setBrowseLocation(e.target.value)}><option>All Locations</option><option>HO</option><option>BR02</option></select><select style={input} value={browseCategory} onChange={e => setBrowseCategory(e.target.value)}><option>All Categories</option><option>Beverages</option><option>Services</option></select><select style={input} value={browseStatus} onChange={e => setBrowseStatus(e.target.value)}><option>All Status</option><option>Enabled</option><option>Disabled</option></select><select style={input} value={browseType} onChange={e => setBrowseType(e.target.value)}><option>All Types</option><option>Raw Item</option><option>Service</option></select></div><div style={{ padding: "0 14px 14px", maxHeight: "55vh", overflow: "auto" }}>{filteredBrowseItems.map(r => <button key={r.code} onClick={() => { selectRow(r); setBrowse(false); }} style={{ ...rowButton, border: `1px solid ${colors.border}`, borderRadius: 10, marginBottom: 8 }}><span style={tile}>◇</span><span style={{ textAlign: "left", flex: 1 }}><b>{r.name}</b><small style={{ display: "block", color: colors.muted }}>{r.code} · {r.values.service ? "Service" : "Raw Item"} · {r.values.category}</small></span><b>{money(Number(r.values.retail || 0))}</b></button>)}</div></div></div>}
    {batchView && <div style={overlay} onClick={() => setBatchView(null)}><section role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ ...browseModal, width: "min(620px,94vw)" }}><header style={detailHeader}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><small style={{ color: "#DDCBB3" }}>STOCK BATCHES</small><h2 style={{ margin: "4px 0" }}>{batchView.name} · {currentName}</h2></div><button style={btn(false)} onClick={() => setBatchView(null)}>×</button></div></header><div style={{ padding: 18 }}><p style={{ marginTop: 0, color: colors.muted }}>Batch and expiry details for {batchView.code}. No batch records are available in this UI sample.</p><table style={table}><thead><tr><th>Batch</th><th>Expiry Date</th><th>Quantity</th></tr></thead><tbody><tr><td colSpan={3} style={{ padding: 16, color: colors.muted, textAlign: "center" }}>No batches found · Total stock: {locs.find(l => l.code === batchView.code)?.stock ?? 0}</td></tr></tbody></table></div></section></div>}
    <div className="print-sheet" style={{ display: "none" }}><h1>{pageTitle} Detail</h1><p><b>Code:</b> {String(form.code ?? "—")}　 <b>Description:</b> {String(form.name ?? "—")}</p>{Object.entries(form).map(([k, v]) => <p key={k}><b>{k}:</b> {String(v)}</p>)}</div>
    {toast && <div role="status" style={toastStyle}>{toast}</div>}
    <style>{`@media(max-width:850px){.inventory-columns{grid-template-columns:1fr!important}} @media print{body *{visibility:hidden!important}.print-sheet,.print-sheet *{visibility:visible!important}.print-sheet{display:block!important;position:absolute;inset:20px;background:#fff;color:#222;padding:24px;font:12pt Arial,sans-serif}.print-sheet p{padding:6px 0;border-bottom:1px solid #ddd}}`}</style>
  </div>;

  function selectField(label: string, key: string, options: string[]) { return <SelectField key={key} label={label} options={options} value={String(form[key] ?? "")} onChange={v => set(key, v)} />; }
  function numberField(label: string, key: string) { return <div style={fieldWrap}><label>{label}</label><input type="number" style={input} value={String(form[key] ?? "0")} onChange={e => { const v = e.target.value; if (key === "rawCost" || key === "markup") { const raw = Number(key === "rawCost" ? v : form.rawCost || 0); const markup = Number(key === "markup" ? v : form.markup || 0); const cost = raw * (1 + markup / 100); setForm(p => ({ ...p, [key]: v, cost: cost.toFixed(2), ...locs.reduce((o, l, i) => ({ ...o, [`retail${i}`]: l.code === "SUB" ? 0 : cost * (1 + l.margin / 100) }), {}) })); setLocs(prev => prev.map(l => l.code === "SUB" ? { ...l, retail: 0 } : { ...l, retail: cost * (1 + l.margin / 100) })); } else set(key, v); }} /></div>; }
  function flagCard(title: string, subtitle: string, key: string, accent: string, toggle: () => void, extra?: ReactNode) { return <div role="button" tabIndex={0} onClick={toggle} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }} style={{ ...flagCardStyle, borderLeft: `3px solid ${accent}` }}><div style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ ...switchStyle, background: form[key] ? colors.brown : "#cbd2d3" }}><i style={{ left: form[key] ? 18 : 3 }} /></span><span><b>{title}</b><small style={{ display: "block", color: colors.muted }}>{subtitle}</small></span></div>{extra && <div onClick={e => e.stopPropagation()} style={{ marginTop: 10 }}>{extra}</div>}</div>; }
  function updateLocation(index: number, update: Partial<(typeof locs)[number]>) { setLocs(prev => prev.map((l, i) => i === index ? { ...l, ...update } : l)); }
}

function Field({ label, id, value, onChange, onKeyDown, type = "text", readOnly = false, inputRef, list }: { label: string; id: string; value: string; onChange: (v: string) => void; onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void; type?: string; readOnly?: boolean; inputRef?: RefObject<HTMLInputElement | null>; list?: string }) { return <div style={fieldWrap}><label htmlFor={`field-${id}`}>{label}</label><input id={`field-${id}`} ref={inputRef} list={list} style={{ ...input, ...(readOnly ? { background: "#F3F0EC", color: "#82786E" } : {}) }} value={value} readOnly={readOnly} type={type} onKeyDown={onKeyDown} onChange={e => onChange(e.target.value)} /></div>; }
function SelectField({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) { return <div style={fieldWrap}><label>{label}</label><select style={input} value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o} value={o}>{o || "— Select —"}</option>)}</select></div>; }
function MiniNumber({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) { return <label style={{ flex: 1, fontSize: 10, color: colors.muted }}>{label}<input type="number" disabled={disabled} value={value} onChange={e => onChange(e.target.value)} style={{ ...smallInput, width: "100%", opacity: disabled ? .55 : 1 }} /></label>; }
function descFor(screen: string) { return ({ locations: "Manage restaurant branches, kitchens and stock locations.", categories: "Organize menu items and ingredients into category levels.", items: "Manage menu items, ingredients and stock details.", units: "Manage master units, sub units and conversions.", modes: "Manage booking types, payment modes and groups.", suppliers: "Manage restaurant supplier contacts and account information." } as Record<string, string>)[screen]; }
function upsert(list: Row[], row: Row) { const rest = list.filter(r => r.code.toUpperCase() !== row.code.toUpperCase()); return [row, ...rest]; }
function nextCode(list: Row[], prefix: string) { const n = list.length + 1; return `${prefix}${String(n).padStart(3, "0")}`; }
function money(n: number) { return `LKR ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
const eyebrow: CSSProperties = { color: "#907860", textTransform: "uppercase", letterSpacing: 1.3, fontSize: 10, fontWeight: 800 };
const layout: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(240px, 310px) minmax(0, 1fr)", gap: 16, alignItems: "start" };
const listCard: CSSProperties = { background: "#F4EADB", border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 3px 12px #6245220a" };
const detailCard: CSSProperties = { background: "#F8F1E7", border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden", minWidth: 0, boxShadow: "0 3px 12px #6245220a" };
const detailHeader: CSSProperties = { padding: "15px 20px", background: "linear-gradient(105deg, #45301D, #684830)", color: "white" };
const panel: CSSProperties = { border: `1px solid #E9DFD2`, borderRadius: 9, overflow: "hidden", marginBottom: 14, scrollMarginTop: 12, background: "#fff" };
const panelHead: CSSProperties = { padding: "10px 14px", background: "linear-gradient(90deg, #684830, #806047)", color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: .6 };
const input: CSSProperties = { minHeight: 40, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "9px 11px", background: "#FFFEFC", color: colors.ink, font: "inherit", boxSizing: "border-box" };
const smallInput: CSSProperties = { minWidth: 75, width: 95, padding: "7px 8px", border: `1px solid ${colors.border}`, borderRadius: 7, font: "inherit" };
const fieldWrap: CSSProperties = { display: "grid", gap: 6, minWidth: 0, color: colors.muted, fontSize: 10, letterSpacing: .5, fontWeight: 800, textTransform: "uppercase" };
const formGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, alignItems: "end" };
const segment: CSSProperties = { display: "flex", gap: 5, border: `1px solid ${colors.border}`, padding: 5, background: colors.pale, borderRadius: 11, marginBottom: 15, overflowX: "auto" };
const segmentBtn: CSSProperties = { flex: 1, minWidth: 135, border: 0, background: "transparent", color: colors.muted, padding: "10px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer" };
const segmentActive: CSSProperties = { background: colors.brown, color: "#fff", boxShadow: "0 2px 5px #68483030" };
const quickNav: CSSProperties = { border: `1px solid ${colors.border}`, background: colors.bg, borderRadius: 8, color: colors.ink, padding: "8px 11px", whiteSpace: "nowrap", fontWeight: 700, fontSize: 12, cursor: "pointer" };
const rowButton: CSSProperties = { width: "100%", display: "flex", gap: 11, alignItems: "center", padding: 14, border: 0, borderBottom: "1px solid #F1E9DF", background: "transparent", cursor: "pointer", color: colors.ink };
const rowActive: CSSProperties = { background: "#EADAC6", boxShadow: "inset 3px 0 0 #684830" };
const tile: CSSProperties = { width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "#73543C", color: "#fff", flexShrink: 0, fontSize: 18 };
const badge: CSSProperties = { marginLeft: 8, color: "#7042A5", background: "#F0E8FF", borderRadius: 12, padding: "3px 8px", fontSize: 10 };
const counter: CSSProperties = { color: colors.muted, fontSize: 10, textAlign: "right" };
const actionBar: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: 13, borderTop: `1px solid ${colors.border}`, background: "#F2E6D7" };
const flagGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 };
const flagCardStyle: CSSProperties = { border: `1px solid #E9DFD2`, borderRadius: 10, padding: 12, background: "#FCFBFA", cursor: "pointer" };
const switchStyle: CSSProperties = { width: 36, height: 20, borderRadius: 20, position: "relative", display: "inline-block", flexShrink: 0 };
const imageBox: CSSProperties = { width: 100, height: 100, display: "grid", placeItems: "center", textAlign: "center", border: "1px dashed #BFA98C", borderRadius: 9, overflow: "hidden" };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const summaryGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 14 };
const summaryCard: CSSProperties = { border: `1px solid ${colors.border}`, borderRadius: 9, padding: 12, background: "#FFFEFC", display: "grid", gap: 8, fontSize: 12 };
const linkBtn: CSSProperties = { border: 0, background: "transparent", color: "#2866aa", textDecoration: "underline", cursor: "pointer", padding: 0 };
const chip: CSSProperties = { borderRadius: 20, background: "#F0E8D8", color: colors.ink, padding: "6px 10px", fontSize: 11, fontWeight: 700, textDecoration: "none" };
const debtBanner: CSSProperties = { borderRadius: 8, padding: 12, fontWeight: 800, alignSelf: "end" };
const btn = (primary: boolean): CSSProperties => ({ padding: "10px 14px", borderRadius: 9, border: `1px solid ${primary ? colors.brown : colors.border}`, background: primary ? colors.brown : "#fff", color: primary ? "white" : colors.ink, fontWeight: 700, cursor: "pointer", opacity: .98 });
const statusPill = (on: boolean): CSSProperties => ({ display: "inline-block", marginTop: 6, background: on ? "#E4F4E8" : "#FDE9E7", color: on ? "#368052" : "#B63E3E", padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 800, fontStyle: "normal" });
const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 200, background: "#20170f99", display: "grid", placeItems: "center", padding: 16 };
const browseModal: CSSProperties = { width: "min(900px,96vw)", background: "white", borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 70px #0005" };
const toastStyle: CSSProperties = { position: "fixed", zIndex: 300, right: 24, bottom: 24, background: "#a33131", color: "white", borderRadius: 9, padding: "12px 17px", boxShadow: "0 7px 24px #0003", fontWeight: 700, fontSize: 13, maxWidth: "min(420px,90vw)" };
const segmentAction: CSSProperties = {};
function FieldLabel() { return null; }
