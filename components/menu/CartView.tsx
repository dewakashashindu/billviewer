"use client";

// ============================================================
// LOCATION: components/menu/CartView.tsx
// "Ready to Eat?" — the app's menu_cart screen (redesigned).
//   variant="sheet" → mobile full-screen sheet (header + sticky footer)
//   variant="panel" → desktop right-hand sticky cart panel
//
// Already-ordered rows are READ-ONLY; only NEW rows can be
// changed, exactly like the app. Mobile groups the rows into
// "New items" and "Already on bill" sections.
// ============================================================

import type { CSSProperties } from "react";
import { formatPrice, T } from "./theme";
import { ItemPhoto } from "./MenuItemCard";
import type { CartRow } from "./useCustomerCart";
import type { MenuItem } from "./types";

function TrashGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="1.9" aria-hidden>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function Row({
  row,
  item,
  onInc,
  onDec,
  onRemove,
  onRemark,
  panel,
}: {
  row: CartRow;
  item?: MenuItem;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onRemark: () => void;
  panel?: boolean;
}) {
  const lineTotal = row.unitPrice * row.qty;

  if (panel) {
    return (
      <div style={{ ...s.panelRow, ...(row.readOnly ? s.panelRowRo : null) }}>
        <ItemPhoto item={{ id: row.itemId, name: row.name, imageUrl: item?.imageUrl ?? null }} size={46} radius={12} />
        <div style={s.panelDet}>
          <div style={s.panelName}>{row.name}</div>
          <div style={s.panelMeta}>
            {row.readOnly ? "ALREADY ON BILL · READ ONLY" : `NEW${row.remark ? ` · ${row.remark}` : ""}`}
          </div>
          {!row.readOnly && (
            <div style={s.panelActions}>
              <span style={s.stepperSm}>
                <button type="button" style={s.stepSm} onClick={onDec}>−</button>
                <span style={s.qtySm}>{row.qty}</span>
                <button type="button" style={s.stepSm} onClick={onInc}>+</button>
              </span>
              <button type="button" style={s.linkBtn} onClick={onRemark}>
                {row.remark ? "Edit remark" : "Add remark"}
              </button>
              <button type="button" style={s.iconBtn} onClick={onRemove} aria-label="Remove">
                <TrashGlyph />
              </button>
            </div>
          )}
        </div>
        <div style={s.panelRight}>
          <div style={s.lineTotal}>{formatPrice(lineTotal)}</div>
          <div style={s.qtyTxt}>×{row.qty}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...s.row, ...(row.readOnly ? s.rowRo : null) }}>
      <ItemPhoto item={{ id: row.itemId, name: row.name, imageUrl: item?.imageUrl ?? null }} size={72} radius={14} />

      <div style={s.det}>
        <div style={s.top}>
          <span style={s.name}>{row.name}</span>
          {!row.readOnly && (
            <button type="button" style={s.trash} onClick={onRemove} aria-label="Remove">
              <TrashGlyph />
            </button>
          )}
        </div>

        <span style={{ ...s.tag, ...(row.readOnly ? s.tagRo : s.tagNew) }}>
          {row.readOnly ? "ALREADY ON BILL" : "NEW ITEM"}
        </span>

        <div style={s.unit}>{formatPrice(row.unitPrice)} / item</div>

        {row.readOnly ? (
          <div style={s.roLine}>
            <span style={s.roTxt}>Already ordered — read only</span>
            <span style={s.lineTotal}>{formatPrice(lineTotal)}</span>
          </div>
        ) : (
          <>
            <button type="button" style={s.remarkBtn} onClick={onRemark}>
              {row.remark ? "Edit Order Remark" : "+ Add Order Remark"}
            </button>
            {row.remark ? <div style={s.remarkPreview}>{row.remark}</div> : null}
            <div style={s.bot}>
              <span style={s.stepper}>
                <button type="button" style={s.step} onClick={onDec}>−</button>
                <span style={s.qty}>{row.qty}</span>
                <button type="button" style={s.step} onClick={onInc}>+</button>
              </span>
              <span style={s.lineTotal}>{formatPrice(lineTotal)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Totals block shared by the sheet footer and the desktop panel. */
function Totals({ existingTotal, newTotal, newCount }: { existingTotal: number; newTotal: number; newCount: number }) {
  const grand = existingTotal + newTotal;
  return (
    <div style={s.totalsCard}>
      <div style={s.totRow}>
        <span>Already on bill</span>
        <b>{formatPrice(existingTotal)}</b>
      </div>
      <div style={s.totRow}>
        <span>New items ({newCount})</span>
        <b>{formatPrice(newTotal)}</b>
      </div>
      <div style={s.totDivider} />
      <div style={{ ...s.totRow, ...s.totRowGrand }}>
        <span>Total payable</span>
        <b style={s.grandAmt}>{formatPrice(grand)}</b>
      </div>
    </div>
  );
}

export default function CartView({
  variant,
  rows,
  itemsById,
  newCount,
  existingTotal,
  newTotal,
  confirming,
  error,
  invoiceNo,
  onBack,
  onHome,
  onConfirm,
  onInc,
  onDec,
  onRemove,
  onRemark,
  onClear,
  onSearch,
}: {
  variant: "sheet" | "panel";
  rows: CartRow[];
  itemsById: Map<string, MenuItem>;
  newCount: number;
  existingTotal: number;
  newTotal: number;
  confirming: boolean;
  error: string | null;
  invoiceNo?: string;
  onBack: () => void;
  onHome: () => void;
  onConfirm: () => void;
  onInc: (key: string) => void;
  onDec: (key: string) => void;
  onRemove: (key: string) => void;
  onRemark: (row: CartRow) => void;
  onClear: () => void;
  onSearch?: () => void;
}) {
  const panel = variant === "panel";
  const empty = rows.length === 0;
  const newRows = rows.filter((r) => !r.readOnly);
  const oldRows = rows.filter((r) => r.readOnly);

  const renderRow = (row: CartRow) => (
    <Row
      key={row.rowId}
      row={row}
      item={itemsById.get(row.itemId)}
      panel={panel}
      onInc={() => onInc(row.lineKey)}
      onDec={() => onDec(row.lineKey)}
      onRemove={() => onRemove(row.lineKey)}
      onRemark={() => onRemark(row)}
    />
  );

  const list = empty ? (
    <div style={s.empty}>
      <span style={s.emptyArt} aria-hidden>🛒</span>
      <div style={s.emptyTitle}>Your cart is empty</div>
      <div style={s.emptySub}>Add something delicious from the menu</div>
      <button type="button" style={s.emptyBtn} className="mnu-tap" onClick={onBack}>
        Browse Menu
      </button>
    </div>
  ) : panel ? (
    <div style={s.panelList}>{rows.map(renderRow)}</div>
  ) : (
    <div style={s.list}>
      {newRows.length > 0 && (
        <>
          <div style={s.sectionRow}>
            <span style={s.sectionLabel}>New Items</span>
            <span style={s.sectionCount}>{newRows.length}</span>
          </div>
          {newRows.map(renderRow)}
        </>
      )}
      {oldRows.length > 0 && (
        <>
          <div style={s.sectionRow}>
            <span style={s.sectionLabel}>Already on Bill</span>
            <span style={s.sectionCount}>{oldRows.length}</span>
          </div>
          {oldRows.map(renderRow)}
        </>
      )}
    </div>
  );

  /* ── desktop panel ── */
  if (panel) {
    return (
      <aside style={s.panel}>
        <div style={s.panelHead}>
          <div>
            <div style={s.panelTitle}>Ready to Eat?</div>
            <div style={s.panelSub}>
              {newCount > 0 ? `${newCount} new item${newCount === 1 ? "" : "s"}` : "Nothing new yet"}
              {invoiceNo ? ` · ${invoiceNo}` : ""}
            </div>
          </div>
          {!empty && (
            <button type="button" style={s.clear} onClick={onClear}>
              Clear all
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }} className="mnu-scroll">
          {list}
        </div>

        <div style={s.panelFooter}>
          <Totals existingTotal={existingTotal} newTotal={newTotal} newCount={newCount} />
          {error && <div style={s.error}>{error}</div>}
          <button
            type="button"
            style={{ ...s.confirm, ...(confirming ? { opacity: 0.7 } : null) }}
            className="mnu-tap"
            onClick={onConfirm}
            disabled={confirming || newCount === 0}
          >
            {confirming ? <span className="mnu-spinner" style={s.spinner} /> : <span style={s.tick} />}
            {confirming ? "Confirming..." : "Confirm Order"}
          </button>
          <div style={s.note}>Payment at the counter · final bill link is sent by SMS</div>
        </div>
      </aside>
    );
  }

  /* ── mobile sheet ── */
  return (
    <div style={s.sheet} className="mnu-anim-up">
      <div style={s.sheetHead}>
        <button type="button" style={s.roundBtn} className="mnu-tap" onClick={onBack} aria-label="Back">
          <span style={s.backChev} />
        </button>
        <div style={s.headMid}>
          <h3 style={s.headTitle}>Ready to Eat?</h3>
          {newCount > 0 && <span style={s.countBadge}>{newCount}</span>}
        </div>
        {!empty ? (
          <button type="button" style={s.clear} onClick={onClear}>
            Clear all
          </button>
        ) : (
          <span style={{ width: 62 }} />
        )}
      </div>

      <div style={s.sheetBody} className="mnu-scroll">
        {list}
      </div>

      {!empty && (
        <div style={s.sheetFooter} className="mnu-safe-bottom">
          <div style={s.grip} />
          <Totals existingTotal={existingTotal} newTotal={newTotal} newCount={newCount} />
          {error && <div style={s.error}>{error}</div>}
          <div style={s.footerRow}>
            <button type="button" style={s.homeBtn} className="mnu-tap" onClick={onHome} aria-label="Home">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                <path d="M12 3.2 2.6 11.4h2.6V20h5v-5.2h3.6V20h5v-8.6h2.6z" />
              </svg>
            </button>
            <button
              type="button"
              style={{
                ...s.confirm,
                ...(confirming || newCount === 0 ? { opacity: 0.55 } : null),
              }}
              className="mnu-tap"
              onClick={onConfirm}
              disabled={confirming || newCount === 0}
            >
              {confirming ? <span className="mnu-spinner" style={s.spinner} /> : <span style={s.tick} />}
              {confirming ? "Confirming..." : "Confirm Order"}
            </button>
          </div>
          {onSearch ? (
            <button type="button" style={s.moreLink} onClick={onSearch}>
              + Add more items
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  /* mobile sheet */
  sheet: { position: "fixed", inset: 0, zIndex: 80, background: T.bg, display: "flex", flexDirection: "column" },
  sheetHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px 14px",
    borderBottom: `1px solid ${T.line}`,
    flex: "0 0 auto",
    background: "rgba(27,27,27,0.6)",
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: `1px solid ${T.line}`,
    background: T.card,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  backChev: {
    width: 9,
    height: 9,
    borderLeft: "2px solid #fff",
    borderBottom: "2px solid #fff",
    transform: "rotate(45deg)",
    marginLeft: 2,
    display: "block",
  },
  headMid: { display: "flex", alignItems: "center", gap: 9 },
  headTitle: { margin: 0, color: T.gold, fontSize: 19, fontWeight: 800, letterSpacing: 0.3 },
  countBadge: {
    background: T.gold,
    color: T.white,
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 6px",
  },
  clear: { background: "none", border: "none", color: T.red, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 4 },
  sheetBody: { flex: 1, overflowY: "auto", paddingBottom: 16 },
  sectionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 18px 11px",
  },
  sectionLabel: { color: T.w92, fontSize: 13, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" },
  sectionCount: {
    color: T.gold,
    fontSize: 11,
    fontWeight: 800,
    background: T.goldSoft,
    borderRadius: 9,
    padding: "3px 9px",
  },
  list: { padding: "0 18px" },
  row: {
    display: "flex",
    gap: 12,
    background: T.card,
    // longhands so rowRo can override borderColor alone
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: T.line,
    borderRadius: 18,
    padding: 12,
    marginBottom: 11,
    boxShadow: "0 5px 16px rgba(0,0,0,0.22)",
  },
  rowRo: { background: "#242220", borderColor: "rgba(255,255,255,0.05)" },
  det: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  top: { display: "flex", justifyContent: "space-between", gap: 8 },
  name: { color: T.w92, fontSize: 13.5, fontWeight: 700, lineHeight: 1.4 },
  trash: {
    width: 28,
    height: 28,
    borderRadius: 9,
    background: T.redSoft,
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flex: "0 0 auto",
  },
  tag: {
    alignSelf: "flex-start",
    marginTop: 6,
    fontSize: 8.5,
    fontWeight: 800,
    letterSpacing: 0.6,
    padding: "3px 8px",
    borderRadius: 7,
  },
  tagRo: { background: "rgba(255,255,255,0.09)", color: T.w55 },
  tagNew: { background: T.greenSoft, color: "#8fd3ac" },
  unit: { color: T.w55, fontSize: 11.5, marginTop: 6 },
  roLine: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 10 },
  roTxt: { color: T.w40, fontSize: 11.5, fontStyle: "italic" },
  remarkBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    background: "none",
    border: "none",
    padding: 0,
    color: T.gold,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  remarkPreview: { color: T.w55, fontSize: 11.5, fontStyle: "italic", marginTop: 3 },
  bot: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  stepper: {
    display: "inline-flex",
    alignItems: "center",
    background: T.surface,
    borderRadius: 24,
    border: `1px solid ${T.line}`,
    overflow: "hidden",
  },
  step: {
    width: 34,
    height: 32,
    background: "none",
    border: "none",
    color: T.white,
    fontSize: 18,
    cursor: "pointer",
  },
  qty: { color: T.white, fontSize: 14, fontWeight: 800, minWidth: 22, textAlign: "center" },
  lineTotal: { color: T.gold, fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "60px 40px", gap: 8 },
  emptyArt: {
    fontSize: 52,
    width: 104,
    height: 104,
    borderRadius: "50%",
    background: T.card,
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { color: T.w92, fontSize: 20, fontWeight: 800, marginTop: 6 },
  emptySub: { color: T.w55, fontSize: 13.5, textAlign: "center", lineHeight: 1.55 },
  emptyBtn: {
    marginTop: 14,
    background: "linear-gradient(180deg, rgba(186,131,66,0.98), rgba(171,119,60,0.95))",
    color: T.white,
    border: "none",
    padding: "13px 30px",
    borderRadius: 24,
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: T.shadowGold,
  },
  sheetFooter: {
    flex: "0 0 auto",
    background: "#201E1B",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTop: `1px solid ${T.line}`,
    padding: "14px 18px 20px",
    boxShadow: "0 -10px 26px rgba(0,0,0,0.5)",
  },
  grip: { width: 40, height: 4, borderRadius: 2, background: T.w25, margin: "0 auto 14px" },
  totalsCard: {
    background: T.card,
    border: `1px solid ${T.line}`,
    borderRadius: 16,
    padding: "13px 15px",
  },
  totRow: { display: "flex", justifyContent: "space-between", alignItems: "center", color: T.w55, fontSize: 12.5, marginBottom: 7 },
  totRowGrand: { fontSize: 14, marginBottom: 0, color: T.w92 },
  totDivider: { height: 1, background: T.line, margin: "4px 0 10px" },
  grandAmt: { color: T.gold, fontSize: 17, fontWeight: 800 },
  footerRow: { display: "flex", gap: 12, alignItems: "center", marginTop: 14 },
  homeBtn: {
    width: 56,
    height: 52,
    borderRadius: 15,
    background: "linear-gradient(180deg, rgba(186,131,66,0.98), rgba(171,119,60,0.95))",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: T.shadowGold,
    cursor: "pointer",
    flex: "0 0 auto",
  },
  confirm: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    background: "linear-gradient(180deg, #469B6A 0%, #3D8C5E 100%)",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    color: T.white,
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.2,
    boxShadow: T.shadowGreen,
    cursor: "pointer",
  },
  confirmDisabled: { opacity: 0.55 },
  tick: {
    width: 14,
    height: 8,
    borderLeft: "2.5px solid #fff",
    borderBottom: "2.5px solid #fff",
    transform: "rotate(-45deg) translateY(-1px)",
    display: "inline-block",
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.35)",
    borderTopColor: "#fff",
    display: "inline-block",
  },
  moreLink: {
    marginTop: 13,
    width: "100%",
    background: "none",
    border: "none",
    color: T.gold,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  error: { color: "#ffb4b4", fontSize: 12, margin: "10px 0 0", textAlign: "center" },
  note: { color: T.w25, fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 1.6 },

  /* desktop panel */
  panel: {
    width: 372,
    flex: "0 0 372px",
    background: "#171614",
    borderLeft: "1px solid #232323",
    display: "flex",
    flexDirection: "column",
    padding: "20px 18px",
    minHeight: 0,
  },
  panelHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flex: "0 0 auto" },
  panelTitle: { color: T.white, fontSize: 17, fontWeight: 800 },
  panelSub: { color: T.w40, fontSize: 12, marginTop: 4 },
  panelList: { paddingTop: 16, paddingBottom: 8 },
  panelRow: {
    display: "flex",
    gap: 11,
    padding: 11,
    borderRadius: 15,
    background: "#211F1C",
    // longhands so panelRowRo can override borderColor alone
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: T.line,
    marginBottom: 10,
  },
  panelRowRo: { background: "#1C1A18", borderColor: "rgba(255,255,255,0.04)" },
  panelDet: { flex: 1, minWidth: 0 },
  panelName: { color: T.w92, fontSize: 12.5, fontWeight: 700 },
  panelMeta: { color: T.w40, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, marginTop: 3 },
  panelActions: { display: "flex", alignItems: "center", gap: 10, marginTop: 9, flexWrap: "wrap" },
  stepperSm: {
    display: "inline-flex",
    alignItems: "center",
    background: T.surface,
    borderRadius: 20,
    border: `1px solid ${T.line}`,
  },
  stepSm: { width: 26, height: 24, background: "none", border: "none", color: T.white, fontSize: 15, cursor: "pointer" },
  qtySm: { color: T.white, fontSize: 12.5, fontWeight: 800, minWidth: 18, textAlign: "center" },
  linkBtn: { background: "none", border: "none", padding: 0, color: T.gold, fontSize: 11.5, fontWeight: 700, cursor: "pointer" },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 7,
    background: T.redSoft,
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  panelRight: { textAlign: "right", flex: "0 0 auto" },
  qtyTxt: { color: T.w55, fontSize: 11, marginTop: 5 },
  panelFooter: { marginTop: "auto", paddingTop: 14, flex: "0 0 auto" },
};
