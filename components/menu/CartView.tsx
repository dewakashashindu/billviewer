"use client";

// ============================================================
// LOCATION: components/menu/CartView.tsx
// "Ready to Eat?" — the app's menu_cart screen (redesigned).
//   variant="sheet" → mobile full-screen sheet (header + sticky footer)
//   variant="panel" → desktop right-hand sticky cart panel
//
// ONE ROW PER ITEM. The quantity a guest already put on the bill and
// the quantity they are adding now live on the same line: the row
// carries an `ON BILL` chip plus a stepper that can only move the
// part above the already-ordered quantity. Nothing ever appears twice.
// ============================================================

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatPrice, T } from "./theme";
import { ItemPhoto } from "./MenuItemCard";
import { useMediaQuery } from "./useMedia";
import type { CartRow } from "./useCustomerCart";
import type { MenuItem } from "./types";

const NUM: CSSProperties = { fontVariantNumeric: "tabular-nums" };

function TrashGlyph({ color = T.red }: { color?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" aria-hidden>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function LockGlyph({ color = T.w55, size = 9 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8.4 10V7.6a3.6 3.6 0 0 1 7.2 0V10" />
    </svg>
  );
}

/** Small "ON BILL ×n" chip used on a merged row. */
function OnBillChip({ qty, dim }: { qty: number; dim?: boolean }) {
  return (
    <span style={{ ...s.chip, ...(dim ? s.chipDim : s.chipGold) }}>
      <LockGlyph color={dim ? T.w55 : T.gold} />
      ON BILL{qty > 0 ? ` ×${qty}` : ""}
    </span>
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
  const added = row.qty - row.baseQty; // what the guest can still change
  const locked = row.readOnly;
  const mixed = row.baseQty > 0 && added > 0;
  const canDec = added > 0;

  if (panel) {
    return (
      <div style={{ ...s.panelRow, ...(locked ? s.panelRowRo : null), ...(mixed ? s.panelRowMixed : null) }}>
        <ItemPhoto
          item={{ id: row.itemId, name: row.name, imageUrl: item?.imageUrl ?? null }}
          size={46}
          radius={12}
        />
        <div style={s.panelDet}>
          <div style={s.panelName} className="mnu-clamp2">
            {row.name}
          </div>
          <div style={s.panelMetaRow}>
            {row.baseQty > 0 ? <OnBillChip qty={row.baseQty} dim={locked} /> : <span style={s.chipNew}>NEW</span>}
            {added > 0 && row.baseQty > 0 && <span style={s.addedTag}>+{added} new</span>}
            {row.remark && <span style={s.panelRemark} className="mnu-clamp1">· {row.remark}</span>}
          </div>
          {!locked && (
            <div style={s.panelActions}>
              <span style={s.stepperSm}>
                <button
                  type="button"
                  style={{ ...s.stepSm, ...(canDec ? null : s.stepOff) }}
                  onClick={onDec}
                  disabled={!canDec}
                  aria-label={`One less ${row.name}`}
                >
                  −
                </button>
                <span style={s.qtySm}>{added}</span>
                <button
                  type="button"
                  style={s.stepSm}
                  onClick={onInc}
                  aria-label={`One more ${row.name}`}
                >
                  +
                </button>
              </span>
              <button type="button" style={s.linkBtn} onClick={onRemark}>
                {row.remark ? "Edit note" : "Add note"}
              </button>
            </div>
          )}
        </div>
        <div style={s.panelRight}>
          <div style={{ ...s.panelTotal, ...NUM }}>{formatPrice(lineTotal)}</div>
          <div style={{ ...s.qtyTxt, ...NUM }}>×{row.qty}</div>
          {!locked && (
            <button type="button" style={s.iconBtn} onClick={onRemove} aria-label={`Remove ${row.name}`}>
              <TrashGlyph />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...s.row, ...(locked ? s.rowRo : null), ...(mixed ? s.rowMixed : null) }}>
      <ItemPhoto
        item={{ id: row.itemId, name: row.name, imageUrl: item?.imageUrl ?? null }}
        size={68}
        radius={14}
      />

      <div style={s.det}>
        <div style={s.top}>
          <span style={s.name} className="mnu-clamp2">
            {row.name}
          </span>
          {!locked && (
            <button type="button" style={s.trash} onClick={onRemove} aria-label={`Remove ${row.name}`}>
              <TrashGlyph />
            </button>
          )}
        </div>

        <div style={s.chipRow}>
          {row.baseQty > 0 ? <OnBillChip qty={row.baseQty} dim={locked} /> : <span style={s.chipNew}>NEW ITEM</span>}
          {added > 0 && row.baseQty > 0 && <span style={s.addedTag}>+{added} new</span>}
        </div>

        <div style={{ ...s.unit, ...NUM }}>{formatPrice(row.unitPrice)} / item</div>

        {locked ? (
          <div style={s.roLine}>
            <span style={s.roTxt}>Already ordered — add more from the menu</span>
            <span style={{ ...s.lineTotal, ...NUM }}>{formatPrice(lineTotal)}</span>
          </div>
        ) : (
          <>
            <button type="button" style={s.remarkBtn} onClick={onRemark}>
              {row.remark ? "Edit order remark" : "+ Add order remark"}
            </button>
            {row.remark ? <div style={s.remarkPreview}>{row.remark}</div> : null}
            <div style={s.bot}>
              <span style={s.stepper}>
                <button
                  type="button"
                  style={{ ...s.step, ...(canDec ? null : s.stepOff) }}
                  onClick={onDec}
                  disabled={!canDec}
                  aria-label={`One less ${row.name}`}
                >
                  −
                </button>
                <span style={{ ...s.qty, ...NUM }}>{added}</span>
                <button
                  type="button"
                  style={s.step}
                  onClick={onInc}
                  aria-label={`One more ${row.name}`}
                >
                  +
                </button>
              </span>
              <span style={{ ...s.lineTotal, ...NUM }}>{formatPrice(lineTotal)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Totals block shared by the sheet footer and the desktop panel. */
function Totals({
  existingTotal,
  newTotal,
  newCount,
}: {
  existingTotal: number;
  newTotal: number;
  newCount: number;
}) {
  const grand = existingTotal + newTotal;
  return (
    <div style={s.totalsCard}>
      <div style={s.totRow}>
        <span>Already on bill</span>
        <b style={NUM}>{formatPrice(existingTotal)}</b>
      </div>
      <div style={s.totRow}>
        <span>New items ({newCount})</span>
        <b style={{ ...NUM, color: newTotal > 0 ? T.gold : T.w55 }}>{formatPrice(newTotal)}</b>
      </div>
      <div style={s.totDivider} />
      <div style={s.totRowGrand}>
        <span style={s.grandLabel}>Total payable</span>
        <b style={{ ...s.grandAmt, ...NUM }}>{formatPrice(grand)}</b>
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
  onConfirm: () => void;
  onInc: (key: string) => void;
  onDec: (key: string) => void;
  onRemove: (key: string) => void;
  onRemark: (row: CartRow) => void;
  onClear: () => void;
  onSearch?: () => void;
}) {
  const panel = variant === "panel";
  const wide = useMediaQuery("(min-width: 1280px)");

  /* "Clear all" drops every new line in one tap — on a phone that is a
     thumb-slip away from losing a five-item order, so it arms first and
     only clears on a second press within three seconds. */
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    []
  );
  const handleClear = () => {
    if (!armed) {
      setArmed(true);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmed(false);
    onClear();
  };
  const empty = rows.length === 0;
  const newItems = rows.filter((r) => r.qty > r.baseQty).length;

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
      <span style={s.emptyArt} aria-hidden>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.goldLine} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 8.5h15l-1.4 10.2a2.2 2.2 0 0 1-2.2 1.9H8.1a2.2 2.2 0 0 1-2.2-1.9z" />
          <path d="M9 8.5V6.6A3 3 0 0 1 12 3.6a3 3 0 0 1 3 3v1.9" />
        </svg>
      </span>
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
      <div style={s.sectionRow}>
        <span style={s.sectionLabel}>Your order</span>
        <span style={{ ...s.sectionCount, ...NUM }}>{rows.length}</span>
      </div>
      {rows.map(renderRow)}
      <div style={s.listHint}>
        Items marked <b style={s.hintGold}>ON BILL</b> are already in the kitchen — you can still add
        more of them.
      </div>
    </div>
  );

  /* ── confirm CTA (gold, never green) ── */
  const cta = (compact?: boolean) => {
    const disabled = confirming || newCount === 0;
    return (
      <button
        type="button"
        style={{
          ...s.confirm,
          ...(compact ? s.confirmCompact : null),
          ...(disabled ? s.confirmDisabled : null),
        }}
        className="mnu-tap"
        onClick={onConfirm}
        disabled={disabled}
      >
        {confirming ? (
          <span className="mnu-spinner" style={s.spinner} />
        ) : disabled ? null : (
          <span style={s.tick} aria-hidden />
        )}
        <span>{confirming ? "Confirming…" : newCount === 0 ? "Add items to confirm" : "Confirm Order"}</span>
        {!confirming && newCount > 0 && (
          <span style={{ ...s.ctaAmt, ...NUM }}>{formatPrice(newTotal)}</span>
        )}
      </button>
    );
  };

  const errorBox = error ? (
    <div style={s.error} role="alert">
      <span style={s.errorDot} aria-hidden />
      <span>{error}</span>
    </div>
  ) : null;

  /* ── desktop panel ── */
  if (panel) {
    return (
      <aside style={{ ...s.panel, ...(wide ? null : s.panelNarrow) }}>
        <div style={s.panelHead}>
          <div>
            <div style={s.panelTitle}>Ready to Eat?</div>
            <div style={s.panelSub}>
              {newCount > 0 ? `${newCount} new item${newCount === 1 ? "" : "s"}` : "Nothing new yet"}
              {invoiceNo ? ` · ${invoiceNo}` : ""}
            </div>
          </div>
          {!empty && (
            <button
              type="button"
              style={{ ...s.clear, ...(armed ? s.clearArmed : null) }}
              onClick={handleClear}
            >
              {armed ? "Tap again to clear" : "Clear all"}
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }} className="mnu-scroll">
          {list}
        </div>

        <div style={s.panelFooter}>
          {errorBox}
          <Totals existingTotal={existingTotal} newTotal={newTotal} newCount={newItems} />
          {cta()}
          <div style={s.note}>Payment at the counter · final bill link is sent by SMS</div>
        </div>
      </aside>
    );
  }

  /* ── mobile sheet ── */
  return (
    <div style={s.sheet} className="mnu-anim-up">
      <div style={s.sheetHead} className="mnu-safe-top">
        <button type="button" style={s.roundBtn} className="mnu-tap" onClick={onBack} aria-label="Back">
          <span style={s.backChev} />
        </button>
        <div style={s.headMid}>
          <h3 style={s.headTitle}>Ready to Eat?</h3>
          {newCount > 0 && <span style={{ ...s.countBadge, ...NUM }}>{newCount}</span>}
        </div>
        {!empty ? (
          <button
            type="button"
            style={{ ...s.clear, ...(armed ? s.clearArmed : null) }}
            onClick={handleClear}
          >
            {armed ? "Tap again" : "Clear all"}
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
          {errorBox}
          <Totals existingTotal={existingTotal} newTotal={newTotal} newCount={newItems} />
          {cta(true)}
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
  /* ── mobile sheet ─────────────────────────────────────────── */
  sheet: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: T.bg,
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
  },
  sheetHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "14px 18px",
    borderBottom: `1px solid ${T.line}`,
    flex: "0 0 auto",
    background: T.surface,
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
    flex: "0 0 auto",
  },
  backChev: {
    width: 9,
    height: 9,
    borderLeft: `2px solid ${T.w92}`,
    borderBottom: `2px solid ${T.w92}`,
    transform: "rotate(45deg)",
    marginLeft: 2,
    display: "block",
  },
  headMid: { display: "flex", alignItems: "center", gap: 9, minWidth: 0 },
  headTitle: {
    margin: 0,
    color: T.ink,
    fontSize: 19,
    fontWeight: 800,
    letterSpacing: -0.2,
    whiteSpace: "nowrap",
  },
  countBadge: {
    background: T.goldGrad,
    color: T.goldInk,
    fontSize: 11,
    fontWeight: 900,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 6px",
  },
  clear: {
    background: "none",
    border: "none",
    color: T.red,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    padding: 4,
    flex: "0 0 auto",
    whiteSpace: "nowrap",
  },
  clearArmed: {
    color: T.goldInk,
    background: T.goldGrad,
    borderRadius: 9,
    padding: "5px 10px",
    fontSize: 11.5,
  },
  sheetBody: { flex: 1, overflowY: "auto", paddingBottom: 12 },
  sectionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 18px 12px",
  },
  sectionLabel: {
    color: T.w92,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  sectionCount: {
    color: T.gold,
    fontSize: 11,
    fontWeight: 800,
    background: T.goldSoft,
    borderRadius: 9,
    padding: "3px 9px",
  },
  list: { padding: "0 16px" },
  listHint: { color: T.w40, fontSize: 11, lineHeight: 1.65, padding: "10px 4px 24px" },
  hintGold: { color: T.gold, fontWeight: 800 },

  row: {
    display: "flex",
    gap: 12,
    background: T.card,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: T.line,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset",
  },
  rowRo: { background: T.cardDeep, borderColor: T.line },
  rowMixed: { borderColor: T.goldLine, background: T.card },
  det: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  top: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" },
  name: { color: T.ink, fontSize: 13.5, fontWeight: 700, lineHeight: 1.42 },
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
  chipRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 8.5,
    fontWeight: 900,
    letterSpacing: 0.7,
    padding: "3px 7px",
    borderRadius: 6,
    whiteSpace: "nowrap",
  },
  chipGold: { background: T.goldSoft, color: T.gold, border: `1px solid ${T.goldLine}` },
  chipDim: { background: "rgba(247,238,227,0.07)", color: T.w55, border: "1px solid transparent" },
  chipNew: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 8.5,
    fontWeight: 900,
    letterSpacing: 0.7,
    padding: "3px 7px",
    borderRadius: 6,
    background: T.greenSoft,
    color: T.green,
  },
  addedTag: { color: T.gold, fontSize: 10, fontWeight: 800, letterSpacing: 0.3 },
  unit: { color: T.w55, fontSize: 11.5, marginTop: 6 },
  roLine: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12, gap: 10 },
  roTxt: { color: T.w40, fontSize: 11, lineHeight: 1.5, flex: 1 },
  remarkBtn: {
    alignSelf: "flex-start",
    marginTop: 9,
    background: "none",
    border: "none",
    padding: 0,
    color: T.gold,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  remarkPreview: { color: T.w55, fontSize: 11.5, fontStyle: "italic", marginTop: 3 },
  bot: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10 },
  stepper: {
    display: "inline-flex",
    alignItems: "center",
    background: T.surface,
    borderRadius: 24,
    border: `1px solid ${T.goldLine}`,
    overflow: "hidden",
  },
  step: {
    width: 36,
    height: 34,
    background: "none",
    border: "none",
    color: T.gold,
    fontSize: 19,
    lineHeight: 1,
    cursor: "pointer",
  },
  stepOff: { color: T.w25, cursor: "not-allowed" },
  qty: {
    color: T.ink,
    fontSize: 14,
    fontWeight: 800,
    minWidth: 24,
    textAlign: "center",
  },
  lineTotal: { color: T.ink, fontSize: 14.5, fontWeight: 800, whiteSpace: "nowrap" },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    padding: "60px 40px",
    gap: 8,
  },
  emptyArt: {
    fontSize: 48,
    width: 100,
    height: 100,
    borderRadius: "50%",
    background: T.card,
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { color: T.ink, fontSize: 20, fontWeight: 800, marginTop: 6 },
  emptySub: { color: T.w55, fontSize: 13.5, textAlign: "center", lineHeight: 1.55 },
  emptyBtn: {
    marginTop: 14,
    background: T.goldGrad,
    color: T.goldInk,
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
    background: T.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTop: `1px solid ${T.line}`,
    padding: "14px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
    boxShadow: "0 -12px 30px rgba(0,0,0,0.45)",
  },
  totalsCard: {
    background: T.cardDeep,
    border: `1px solid ${T.line}`,
    borderRadius: 16,
    padding: "13px 15px",
  },
  totRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: T.w55,
    fontSize: 12.5,
    marginBottom: 7,
  },
  totDivider: { height: 1, background: T.line, margin: "5px 0 11px" },
  totRowGrand: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  grandLabel: { color: T.w92, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.2 },
  grandAmt: { color: T.gold, fontSize: 20, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.2 },
  confirm: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    background: T.goldGrad,
    border: "1px solid rgba(255,255,255,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    color: T.goldInk,
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.2,
    boxShadow: T.shadowGold,
    cursor: "pointer",
    padding: "0 14px",
  },
  confirmCompact: { flex: 1, width: "100%" },
  confirmDisabled: {
    background: T.card2,
    color: T.w55,
    border: "1px solid rgba(255,246,234,0.07)",
    boxShadow: "none",
    cursor: "not-allowed",
  },
  ctaAmt: {
    marginLeft: "auto",
    fontSize: 12.5,
    fontWeight: 800,
    background: "rgba(29,21,13,0.13)",
    borderRadius: 8,
    padding: "4px 8px",
    whiteSpace: "nowrap",
  },
  tick: {
    width: 14,
    height: 8,
    borderLeft: `2.5px solid ${T.goldInk}`,
    borderBottom: `2.5px solid ${T.goldInk}`,
    transform: "rotate(-45deg) translateY(-1px)",
    display: "inline-block",
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: "2px solid rgba(29,21,13,0.30)",
    borderTopColor: T.goldInk,
    display: "inline-block",
  },
  moreLink: {
    marginTop: 12,
    width: "100%",
    background: "none",
    border: "none",
    color: T.gold,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: T.redSoft,
    border: `1px solid rgba(255,143,143,0.35)`,
    borderRadius: 12,
    padding: "10px 12px",
    color: "#FFD2D2",
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 10,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: T.red,
    marginTop: 5,
    flex: "0 0 auto",
  },
  note: { color: T.w40, fontSize: 11, textAlign: "center", marginTop: 11, lineHeight: 1.6 },

  /* ── desktop panel ────────────────────────────────────────── */
  panelNarrow: { width: 322, flex: "0 0 322px", padding: "16px 13px" },
  panel: {
    width: 380,
    flex: "0 0 380px",
    background: T.surface,
    borderLeft: `1px solid ${T.line}`,
    display: "flex",
    flexDirection: "column",
    padding: "20px 18px",
    minHeight: 0,
  },
  panelHead: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flex: "0 0 auto",
  },
  panelTitle: { color: T.ink, fontSize: 17, fontWeight: 800, letterSpacing: -0.2 },
  panelSub: { color: T.w40, fontSize: 12, marginTop: 4 },
  panelList: { paddingTop: 16, paddingBottom: 8 },
  panelRow: {
    display: "flex",
    gap: 11,
    padding: 11,
    borderRadius: 15,
    background: T.card,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: T.line,
    marginBottom: 9,
  },
  panelRowRo: { background: T.cardDeep, borderColor: T.line },
  panelRowMixed: { borderColor: T.goldLine },
  panelDet: { flex: 1, minWidth: 0 },
  panelName: { color: T.ink, fontSize: 12.5, fontWeight: 700 },
  panelMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    flexWrap: "wrap",
    minWidth: 0,
  },
  panelRemark: { color: T.w40, fontSize: 10, minWidth: 0 },
  panelActions: { display: "flex", alignItems: "center", gap: 9, marginTop: 9, flexWrap: "nowrap", minWidth: 0 },
  stepperSm: {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    background: T.surface,
    borderRadius: 20,
    border: `1px solid ${T.goldLine}`,
  },
  stepSm: {
    width: 28,
    height: 26,
    background: "none",
    border: "none",
    color: T.gold,
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
  },
  qtySm: { color: T.ink, fontSize: 12.5, fontWeight: 800, minWidth: 18, textAlign: "center" },
  linkBtn: {
    background: "none",
    border: "none",
    padding: 0,
    whiteSpace: "nowrap",
    flexShrink: 0,
    color: T.gold,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  iconBtn: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 7,
    background: T.redSoft,
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  panelRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flex: "0 0 auto" },
  panelTotal: { color: T.ink, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" },
  qtyTxt: { color: T.w40, fontSize: 11 },
  panelFooter: { marginTop: "auto", paddingTop: 14, flex: "0 0 auto" },
};
