"use client";

// ============================================================
// LOCATION: components/menu/CartView.tsx
// "Ready to Eat?" — the app's menu_cart screen.
//   variant="sheet" → mobile full-screen sheet (header + sticky footer)
//   variant="panel" → desktop right-hand sticky cart panel
//
// Already-ordered rows are READ-ONLY; only NEW rows can be
// changed, exactly like the app.
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
        <ItemPhoto item={{ id: row.itemId, name: row.name, imageUrl: item?.imageUrl ?? null }} size={46} radius={10} />
        <div style={s.panelDet}>
          <div style={s.panelName}>{row.name}</div>
          <div style={s.panelMeta}>
            {row.readOnly ? "ALREADY ON BILL · read only" : `NEW${row.remark ? ` · ${row.remark}` : ""}`}
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
      <ItemPhoto item={{ id: row.itemId, name: row.name, imageUrl: item?.imageUrl ?? null }} size={74} radius={12} />

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
              {row.remark ? "Edit Order Remark" : "Add Order Remark"}
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

  const list = empty ? (
    <div style={s.empty}>
      <span style={{ fontSize: 52 }} aria-hidden>🛒</span>
      <div style={s.emptyTitle}>Your cart is empty</div>
      <div style={s.emptySub}>Add something delicious from the menu</div>
      <button type="button" style={s.emptyBtn} onClick={onBack}>
        Browse Menu
      </button>
    </div>
  ) : (
    <div style={panel ? s.panelList : s.list}>
      {rows.map((row) => (
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
      ))}
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
          <div style={s.totRow}>
            <span>Already on bill</span>
            <b>{formatPrice(existingTotal)}</b>
          </div>
          <div style={{ ...s.totRow, ...s.totRowGrand }}>
            <span>New items ({newCount})</span>
            <b>{formatPrice(newTotal)}</b>
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button
            type="button"
            style={{ ...s.confirm, ...(confirming ? { opacity: 0.7 } : null) }}
            onClick={onConfirm}
            disabled={confirming}
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
        <button type="button" style={s.roundBtn} onClick={onBack} aria-label="Back">
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
        {!empty && (
          <div style={s.sectionRow}>
            <span style={s.sectionLabel}>Your Order</span>
            <span style={s.sectionCount}>
              {rows.length} {rows.length === 1 ? "item" : "items"}
            </span>
          </div>
        )}
        {list}
      </div>

      {!empty && (
        <div style={s.sheetFooter}>
          <div style={s.grip} />
          <div style={s.totRow}>
            <span>Already on bill</span>
            <b>{formatPrice(existingTotal)}</b>
          </div>
          <div style={{ ...s.totRow, ...s.totRowGrand }}>
            <span>New items ({newCount})</span>
            <b>{formatPrice(newTotal)}</b>
          </div>
          {error && <div style={s.error}>{error}</div>}
          <div style={s.footerRow}>
            <button type="button" style={s.homeBtn} onClick={onHome} aria-label="Home">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                <path d="M12 3.2 2.6 11.4h2.6V20h5v-5.2h3.6V20h5v-8.6h2.6z" />
              </svg>
            </button>
            <button
              type="button"
              style={{ ...s.confirm, ...(confirming ? { opacity: 0.7 } : null) }}
              onClick={onConfirm}
              disabled={confirming}
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
    padding: "12px 18px 14px",
    borderBottom: `1px solid ${T.line}`,
    flex: "0 0 auto",
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: `1.5px solid ${T.line}`,
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
  headMid: { display: "flex", alignItems: "center", gap: 8 },
  headTitle: { margin: 0, color: T.gold, fontSize: 19, fontWeight: 700 },
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
    padding: "0 5px",
  },
  clear: { background: "none", border: "none", color: T.red, fontSize: 12.5, fontWeight: 500, cursor: "pointer", padding: 4 },
  sheetBody: { flex: 1, overflowY: "auto", paddingBottom: 16 },
  sectionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px 12px" },
  sectionLabel: { color: T.w92, fontSize: 15, fontWeight: 700 },
  sectionCount: { color: T.w55, fontSize: 12 },
  list: { padding: "0 18px" },
  row: {
    display: "flex",
    gap: 12,
    background: T.card,
    // longhands so rowRo can override borderColor alone
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: T.line,
    borderRadius: 16,
    padding: 12,
    marginBottom: 11,
  },
  rowRo: { background: "#262626", borderColor: "rgba(255,255,255,0.05)" },
  det: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  top: { display: "flex", justifyContent: "space-between", gap: 8 },
  name: { color: T.w92, fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 },
  trash: {
    width: 26,
    height: 26,
    borderRadius: 8,
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
    marginTop: 5,
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    padding: "3px 7px",
    borderRadius: 7,
  },
  tagRo: { background: "rgba(255,255,255,0.10)", color: T.w55 },
  tagNew: { background: T.greenSoft, color: "#8fd3ac" },
  unit: { color: T.w55, fontSize: 11.5, marginTop: 5 },
  roLine: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 10 },
  roTxt: { color: T.w25, fontSize: 11.5, fontStyle: "italic" },
  remarkBtn: {
    alignSelf: "flex-start",
    marginTop: 7,
    background: "none",
    border: "none",
    padding: 0,
    color: T.gold,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  remarkPreview: { color: T.w55, fontSize: 11.5, fontStyle: "italic", marginTop: 2 },
  bot: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9 },
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
  qty: { color: T.white, fontSize: 14, fontWeight: 700, minWidth: 22, textAlign: "center" },
  lineTotal: { color: T.gold, fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "60px 40px", gap: 10 },
  emptyTitle: { color: T.w92, fontSize: 20, fontWeight: 700, marginTop: 8 },
  emptySub: { color: T.w55, fontSize: 14, textAlign: "center", lineHeight: 1.5 },
  emptyBtn: {
    marginTop: 12,
    background: T.gold,
    color: T.white,
    border: "none",
    padding: "12px 28px",
    borderRadius: 24,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  sheetFooter: {
    flex: "0 0 auto",
    background: T.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: `1px solid ${T.line}`,
    padding: "16px 18px 22px",
    boxShadow: "0 -8px 22px rgba(0,0,0,0.45)",
  },
  grip: { width: 40, height: 4, borderRadius: 2, background: T.w25, margin: "0 auto 14px" },
  totRow: { display: "flex", justifyContent: "space-between", color: T.w55, fontSize: 12.5, marginBottom: 8 },
  totRowGrand: { fontSize: 13.5 },
  footerRow: { display: "flex", gap: 12, alignItems: "center", marginTop: 14 },
  homeBtn: {
    width: 56,
    height: 52,
    borderRadius: 14,
    background: T.gold,
    border: "none",
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
    borderRadius: 14,
    background: T.green,
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    color: T.white,
    fontSize: 15,
    fontWeight: 700,
    boxShadow: T.shadowGreen,
    cursor: "pointer",
  },
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
    marginTop: 12,
    width: "100%",
    background: "none",
    border: "none",
    color: T.gold,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { color: "#ffb4b4", fontSize: 12, margin: "4px 0 10px" },
  note: { color: T.w25, fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 1.6 },

  /* desktop panel */
  panel: {
    width: 372,
    flex: "0 0 372px",
    background: "#171717",
    borderLeft: "1px solid #232323",
    display: "flex",
    flexDirection: "column",
    padding: "20px 18px",
    minHeight: 0,
  },
  panelHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flex: "0 0 auto" },
  panelTitle: { color: T.white, fontSize: 16, fontWeight: 800 },
  panelSub: { color: T.w40, fontSize: 12, marginTop: 4 },
  panelList: { paddingTop: 16, paddingBottom: 8 },
  panelRow: {
    display: "flex",
    gap: 11,
    padding: 11,
    borderRadius: 13,
    background: "#1F1F1F",
    // longhands so panelRowRo can override borderColor alone
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: T.line,
    marginBottom: 10,
  },
  panelRowRo: { background: "#1B1B1B", borderColor: "rgba(255,255,255,0.04)" },
  panelDet: { flex: 1, minWidth: 0 },
  panelName: { color: T.w92, fontSize: 12.5, fontWeight: 600 },
  panelMeta: { color: T.w40, fontSize: 11, marginTop: 3 },
  panelActions: { display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" },
  stepperSm: { display: "inline-flex", alignItems: "center", background: T.surface, borderRadius: 20, border: `1px solid ${T.line}` },
  stepSm: { width: 26, height: 24, background: "none", border: "none", color: T.white, fontSize: 15, cursor: "pointer" },
  qtySm: { color: T.white, fontSize: 12.5, fontWeight: 700, minWidth: 18, textAlign: "center" },
  linkBtn: { background: "none", border: "none", padding: 0, color: T.gold, fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
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
  panelFooter: { marginTop: "auto", borderTop: `1px solid ${T.line}`, paddingTop: 14, flex: "0 0 auto" },
};
