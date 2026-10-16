"use client";

// ============================================================
// LOCATION: components/menu/MenuClient.tsx
// Customer menu & ordering screen — /menu?table=T-07&group=...
//
// Step machine (same flow as the Expo app):
//   welcome → home → group → (sub-group) → cart → success
// Mobile: floating bottom bar + full-screen cart sheet.
// Desktop: sidebar categories + grid + sticky cart panel.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { categoryLabel, T } from "./theme";
import { useCustomerCart, type CartRow } from "./useCustomerCart";
import { useIsDesktop } from "./useMedia";
import { useMenuTree } from "./useMenuTree";
import BottomBar, { CartGlyph, HomeGlyph, SearchGlyph } from "./BottomBar";
import CartView from "./CartView";
import GroupScreen from "./GroupScreen";
import ItemDetailModal from "./ItemDetailModal";
import MenuHome from "./MenuHome";
import OrderSuccess from "./OrderSuccess";
import RemarkSheet from "./RemarkSheet";
import SearchOverlay from "./SearchOverlay";
import WelcomeScreen from "./WelcomeScreen";
import type { GroupCard, SubGroup } from "./types";

type View = "welcome" | "home" | "group" | "cart" | "success";

export default function MenuClient({
  table,
  tableGroup,
}: {
  table: string;
  tableGroup: string;
}) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const tree = useMenuTree();

  const itemsById = useMemo(
    () => new Map(tree.searchable.map((i) => [i.id, i])),
    [tree.searchable]
  );

  const cart = useCustomerCart({ table, tableGroup, itemsById });

  const [view, setView] = useState<View>("welcome");
  const [tabChoice, setTabChoice] = useState("");
  const [group, setGroup] = useState<GroupCard | null>(null);
  const [sub, setSub] = useState<SubGroup | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [remarkRow, setRemarkRow] = useState<CartRow | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [manualTable, setManualTable] = useState("");
  const pulseTimer = useRef<number | null>(null);

  /* first tab is the default — derived, so no state sync in an effect */
  const activeTab = tabChoice || tree.tabs[0]?.key || "";
  const setActiveTab = setTabChoice;

  /* ── cart helpers used by every screen ───────────────────── */
  const qtyOf = useCallback(
    (itemId: string) =>
      cart.lines.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.qty, 0),
    [cart.lines]
  );

  const existingOf = useCallback(
    (itemId: string) =>
      Object.entries(cart.baseline)
        .filter(([k]) => k.startsWith(`${itemId}|`))
        .reduce((sum, [, v]) => sum + v.qty, 0),
    [cart.baseline]
  );

  const flash = useCallback(() => {
    setPulse(true);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulse(false), 320);
  }, []);

  const addItem = useCallback(
    (itemId: string) => {
      const line = cart.lines.find((l) => l.itemId === itemId);
      if (line) cart.inc(line.key);
      else {
        const item = itemsById.get(itemId);
        if (item) cart.add(item);
      }
      flash();
    },
    [cart, flash, itemsById]
  );

  const decItem = useCallback(
    (itemId: string) => {
      const candidates = cart.lines.filter((l) => l.itemId === itemId);
      const editable = [...candidates].reverse().find(
        (l) => l.qty > (cart.baseline[l.key]?.qty ?? 0)
      );
      if (editable) cart.dec(editable.key);
    },
    [cart]
  );

  /* ── welcome → menu (pre-loads behind the button) ────────── */
  const openMenu = useCallback(async () => {
    if (opening) return;
    setOpening(true);
    const started = Date.now();
    // let the loader paint, then wait for the menu (min 800ms)
    await new Promise((r) => setTimeout(r, 60));
    while (tree.loading && Date.now() - started < 8000) {
      await new Promise((r) => setTimeout(r, 120));
    }
    const remaining = Math.max(0, 800 - (Date.now() - started));
    if (remaining) await new Promise((r) => setTimeout(r, remaining));
    setOpening(false);
    setView("home");
  }, [opening, tree.loading]);

  /* ── desktop ⌘K / Ctrl+K → search ────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openGroup = useCallback((g: GroupCard) => {
    setGroup(g);
    setSub(null);
    setView("group");
    window.scrollTo({ top: 0 });
  }, []);

  const detailItem = detailId ? itemsById.get(detailId) ?? null : null;

  const handleConfirm = useCallback(async () => {
    const result = await cart.confirm();
    if (result) {
      setView("success");
      window.scrollTo({ top: 0 });
    }
  }, [cart]);

  /* ══════════════════ no table → ask for the QR ═════════════ */
  if (!table) {
    return (
      <div className="mnu-min-dvh" style={s.root}>
        <div style={s.scanWrap}>
          <span style={{ fontSize: 54 }} aria-hidden>📷</span>
          <h2 style={s.scanTitle}>Scan your table QR</h2>
          <p style={s.scanSub}>
            To order, please scan the QR code on your table.
            <br />
            Or enter your table number below (staff will confirm).
          </p>
          <form
            style={s.scanForm}
            onSubmit={(e) => {
              e.preventDefault();
              const t = manualTable.trim();
              if (t) router.replace(`/menu?table=${encodeURIComponent(t)}`);
            }}
          >
            <input
              value={manualTable}
              onChange={(e) => setManualTable(e.target.value)}
              placeholder="e.g. T-07"
              style={s.scanInput}
            />
            <button type="submit" style={s.scanBtn}>
              Open menu
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ══════════════════ welcome ══════════════════════════════ */
  if (view === "welcome") {
    return (
      <div className="mnu-min-dvh" style={s.root}>
        <WelcomeScreen
          table={table}
          tableGroup={tableGroup}
          opening={opening}
          onOpenMenu={() => void openMenu()}
        />
        {opening && (
          <div style={s.preparing} className="mnu-anim-fade">
            <div style={s.prepCard}>
              <span className="mnu-spinner" style={s.prepSpinner} />
              <div style={s.prepTitle}>Preparing your menu</div>
              <div style={s.prepText}>Please wait a moment...</div>
            </div>
          </div>
        )}
        {leaveOpen && <LeaveDialog onClose={() => setLeaveOpen(false)} />}
      </div>
    );
  }

  /* ══════════════════ desktop shell ════════════════════════ */
  const main = (
    <div style={{ padding: desktop ? "4px 26px 40px" : "0 18px 0", maxWidth: desktop ? 1180 : "100%", margin: "0 auto", width: "100%" }}>
      {tree.error && (
        <div style={s.errorBox}>
          <div style={{ color: "#ffb4b4", fontSize: 13.5 }}>{tree.error}</div>
          <button type="button" style={s.retry} onClick={tree.reload}>
            Try again
          </button>
        </div>
      )}

      {view === "home" && (
        <MenuHome
          tabs={tree.tabs}
          groups={tree.groups}
          activeTab={activeTab}
          onTab={setActiveTab}
          onOpenGroup={openGroup}
          alreadyOrderedByItem={new Map(
            cart.lines
              .filter((l) => (cart.baseline[l.key]?.qty ?? 0) > 0)
              .map((l) => [l.itemId, cart.baseline[l.key]?.qty ?? 0])
          )}
          desktop={desktop}
        />
      )}

      {view === "group" && group && (
        <GroupScreen
          group={group}
          subGroup={sub}
          desktop={desktop}
          cart={{ qtyOf, existingOf, add: addItem, inc: addItem, dec: decItem }}
          onBack={() => (sub ? setSub(null) : setView("home"))}
          onOpenSub={(sg) => {
            setSub(sg);
            window.scrollTo({ top: 0 });
          }}
          onAdd={addItem}
          onInc={addItem}
          onDec={decItem}
          onOpenItem={setDetailId}
        />
      )}

      {view === "success" && cart.lastResult && (
        <OrderSuccess
          result={cart.lastResult}
          onAddMore={() => setView("home")}
          onDone={() => setView("welcome")}
        />
      )}
    </div>
  );

  if (desktop) {
    return (
      <div className="mnu-min-dvh" style={s.root}>
        <header style={s.dHeader}>
          <div style={s.dBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/millamirissa.png" alt="Mila Mirissa" style={s.dLogo} />
            <div style={s.dBrandText}>
              <span style={s.dBrandMain}>MILA MIRISSA</span>
              <span style={s.dBrandSub}>CUSTOMER MENU</span>
            </div>
          </div>
          <div style={s.dHeaderMid}>
            <button type="button" style={s.dNavBtn} onClick={() => setView("home")}>
              Menu
            </button>
            <button type="button" style={s.dSearch} onClick={() => setSearchOpen(true)}>
              <SearchGlyph size={16} color="rgba(255,255,255,0.5)" />
              <span style={{ color: T.w40 }}>Search dishes…</span>
              <span style={s.kbd}>Ctrl K</span>
            </button>
          </div>
          <div style={s.dTable}>
            <span style={s.dTableK}>Your table</span>
            <span style={s.dTableV}>{table}</span>
          </div>
        </header>

        <div style={s.dRow}>
          <aside style={s.sidebar} className="mnu-scroll">
            <div style={s.sideSection}>Categories</div>
            {tree.tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                style={{ ...s.sideItem, ...(tab.key === activeTab ? s.sideItemOn : null) }}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSub(null);
                  setView("home");
                }}
              >
                <span>{tab.label}</span>
                <small style={s.sideCount}>{tab.count}</small>
              </button>
            ))}

            <div style={s.sideSection}>Groups</div>
            {tree.groups
              .filter((g) => !activeTab || categoryLabel(g.categoryId) === activeTab)
              .map((g) => (
                <button
                  key={g.key}
                  type="button"
                  style={{ ...s.sideItem, ...(group?.key === g.key && view === "group" ? s.sideItemOn : null) }}
                  onClick={() => openGroup(g)}
                >
                  <span>{g.name}</span>
                  <small style={s.sideCount}>{g.count}</small>
                </button>
              ))}

            <div style={s.sideFoot}>
              Menu is live from the POS — prices and availability are always current.
              {tree.source === "mock" && (
                <>
                  <br />
                  <span style={{ color: T.gold }}>Demo mode (no DB configured)</span>
                </>
              )}
            </div>
          </aside>

          <main style={s.dMain} className="mnu-scroll">
            <div style={s.dMainHead}>
              <div>
                <h2 style={s.dMainTitle}>
                  {view === "group" && group ? group.name : "Our Menu"}
                  {view === "group" && sub ? ` · ${sub.name}` : ""}
                </h2>
                <div style={s.dMainSub}>
                  {tree.groups.reduce((n, g) => n + g.count, 0)} items · prices include all taxes
                </div>
              </div>
              {view !== "home" && (
                <button
                  type="button"
                  style={s.ghostSmall}
                  onClick={() => {
                    setSub(null);
                    setView("home");
                  }}
                >
                  ← All categories
                </button>
              )}
            </div>
            {main}
          </main>

          <CartView
            variant="panel"
            rows={cart.rows}
            itemsById={itemsById}
            newCount={cart.newCount}
            existingTotal={cart.existingTotal}
            newTotal={cart.newTotal}
            confirming={cart.confirming}
            error={cart.confirmError}
            invoiceNo={cart.invoiceNo}
            onBack={() => setView("home")}
            onHome={() => setLeaveOpen(true)}
            onConfirm={() => void handleConfirm()}
            onInc={cart.inc}
            onDec={cart.dec}
            onRemove={cart.removeNew}
            onRemark={setRemarkRow}
            onClear={cart.clearNew}
            onSearch={() => setSearchOpen(true)}
          />
        </div>

        {modals()}

        <ItemDetailModal
          item={detailItem}
          desktop
          qty={detailId ? qtyOf(detailId) : 0}
          onClose={() => setDetailId(null)}
          onAdd={() => detailId && addItem(detailId)}
          onInc={() => detailId && addItem(detailId)}
          onDec={() => detailId && decItem(detailId)}
        />
      </div>
    );
  }

  /* ══════════════════ mobile shell ═════════════════════════ */
  return (
    <div className="mnu-min-dvh" style={s.root}>
      <header style={s.mHeader}>
        <button type="button" style={s.mHeadBtn} onClick={() => setLeaveOpen(true)} aria-label="Home">
          <HomeGlyph size={18} />
        </button>
        <div style={s.mBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/millamirissa.png" alt="Mila Mirissa" style={s.mLogo} />
          <span style={s.mBrandSub}>TABLE {table}</span>
        </div>
        <button type="button" style={s.mHeadBtn} onClick={() => setView("cart")} aria-label="Cart">
          <CartGlyph size={20} />
          {cart.newCount > 0 && <span style={s.mBadge}>{cart.newCount}</span>}
        </button>
      </header>

      <main style={{ flex: 1 }}>{main}</main>

      <BottomBar
        cartCount={cart.newCount}
        pulse={pulse}
        onHome={() => setLeaveOpen(true)}
        onSearch={() => setSearchOpen(true)}
        onCart={() => setView("cart")}
      />

      {view === "cart" && (
        <CartView
          variant="sheet"
          rows={cart.rows}
          itemsById={itemsById}
          newCount={cart.newCount}
          existingTotal={cart.existingTotal}
          newTotal={cart.newTotal}
          confirming={cart.confirming}
          error={cart.confirmError}
          invoiceNo={cart.invoiceNo}
          onBack={() => setView(group ? "group" : "home")}
          onHome={() => setLeaveOpen(true)}
          onConfirm={() => void handleConfirm()}
          onInc={cart.inc}
          onDec={cart.dec}
          onRemove={cart.removeNew}
          onRemark={setRemarkRow}
          onClear={cart.clearNew}
          onSearch={() => {
            setView(group ? "group" : "home");
            setSearchOpen(true);
          }}
        />
      )}

      {modals()}

      <ItemDetailModal
        item={detailItem}
        qty={detailId ? qtyOf(detailId) : 0}
        onClose={() => setDetailId(null)}
        onAdd={() => detailId && addItem(detailId)}
        onInc={() => detailId && addItem(detailId)}
        onDec={() => detailId && decItem(detailId)}
      />
    </div>
  );

  /* ── shared overlays (defined once, rendered in both shells) ── */
  function modals() {
    return (
      <>
        {searchOpen && (
          <SearchOverlay
            items={tree.searchable}
            onClose={() => setSearchOpen(false)}
            qtyOf={qtyOf}
            onAdd={(id) => addItem(id)}
            onInc={(id) => addItem(id)}
            onDec={(id) => decItem(id)}
            onOpenItem={(id) => {
              setSearchOpen(false);
              setDetailId(id);
            }}
          />
        )}

        <RemarkSheet
          key={remarkRow?.rowId ?? "none"}
          open={Boolean(remarkRow)}
          itemName={remarkRow?.name ?? ""}
          value={remarkRow?.remark ?? ""}
          onClose={() => setRemarkRow(null)}
          onSave={(remark) => {
            if (remarkRow) cart.setRemark(remarkRow.lineKey, remark);
            setRemarkRow(null);
          }}
        />

        {leaveOpen && (
          <LeaveDialog
            onClose={() => setLeaveOpen(false)}
            onLeave={() => {
              setLeaveOpen(false);
              setView("welcome");
            }}
            hasCart={cart.newCount > 0}
          />
        )}
      </>
    );
  }
}

/* ── small dialogs ─────────────────────────────────────────── */

function LeaveDialog({
  onClose,
  onLeave,
  hasCart,
}: {
  onClose: () => void;
  onLeave?: () => void;
  hasCart?: boolean;
}) {
  return (
    <div style={s.dlgOverlay} className="mnu-anim-fade" onClick={onClose}>
      <div style={s.dlg} className="mnu-anim-pop" onClick={(e) => e.stopPropagation()}>
        <h3 style={s.dlgTitle}>{onLeave ? "Leave the menu?" : "Need help?"}</h3>
        <p style={s.dlgText}>
          {onLeave ? (
            hasCart ? (
              <>Your cart is saved on this device — you can come back any time.</>
            ) : (
              <>You can reopen the menu from your table QR at any time.</>
            )
          ) : (
            <>Please ask your steward for assistance. Your cart is saved.</>
          )}
        </p>
        <div style={s.dlgActions}>
          <button type="button" style={s.dlgGhost} onClick={onClose}>
            {onLeave ? "Keep browsing" : "Close"}
          </button>
          {onLeave && (
            <button type="button" style={s.dlgPrimary} onClick={onLeave}>
              Go to welcome
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    background: T.bg,
    color: T.white,
    fontFamily: T.font,
    display: "flex",
    flexDirection: "column",
    colorScheme: "dark",
  },

  /* scan / no table */
  scanWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 26px",
    textAlign: "center",
  },
  scanTitle: { margin: "14px 0 0", fontSize: 23, fontWeight: 800 },
  scanSub: { color: T.w55, fontSize: 13.5, lineHeight: 1.7, margin: "10px 0 22px" },
  scanForm: { display: "flex", gap: 10, width: "100%", maxWidth: 360 },
  scanInput: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.white,
    padding: "0 14px",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  },
  scanBtn: {
    height: 48,
    padding: "0 20px",
    borderRadius: 13,
    background: T.gold,
    border: "none",
    color: T.white,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },

  /* loading overlay */
  preparing: {
    position: "fixed",
    inset: 0,
    zIndex: 120,
    background: "rgba(0,0,0,0.48)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  prepCard: {
    minWidth: 220,
    padding: "26px 24px",
    borderRadius: 20,
    background: "#252525",
    border: "1px solid rgba(244,195,109,0.34)",
    textAlign: "center",
  },
  prepSpinner: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    border: "3px solid rgba(255,255,255,0.25)",
    borderTopColor: T.gold,
    display: "inline-block",
  },
  prepTitle: { color: T.white, fontSize: 16, fontWeight: 800, marginTop: 14 },
  prepText: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 5 },

  /* mobile header */
  mHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px 10px",
    position: "sticky",
    top: 0,
    zIndex: 30,
    background: "rgba(27,27,27,0.94)",
    backdropFilter: "blur(8px)",
    borderBottom: `1px solid ${T.line}`,
  },
  mHeadBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: T.card,
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
  },
  mBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    background: "#FF3B30",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
  mBrand: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5 },
  mLogo: { width: 32, height: 32, display: "block", borderRadius: "50%" },
  mBrandSub: { fontSize: 8.5, letterSpacing: 3.4, color: T.gold },

  /* desktop shell */
  dHeader: {
    height: 60,
    flex: "0 0 auto",
    borderBottom: "1px solid #232323",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    padding: "0 22px",
    background: "#151515",
  },
  dBrand: { display: "flex", alignItems: "center", gap: 11 },
  dLogo: { width: 38, height: 38, display: "block", borderRadius: "50%", flex: "0 0 auto" },
  dBrandText: { display: "flex", flexDirection: "column", gap: 3 },
  dBrandMain: { fontSize: 15, fontWeight: 800, letterSpacing: 3 },
  dBrandSub: { fontSize: 8.5, letterSpacing: 3.4, color: T.gold },
  dHeaderMid: { display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" },
  dNavBtn: {
    background: "none",
    border: `1px solid ${T.line}`,
    color: T.w72,
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 10,
    padding: "8px 14px",
    cursor: "pointer",
  },
  dSearch: {
    width: 320,
    height: 38,
    borderRadius: 19,
    background: T.card,
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    padding: "0 14px",
    fontSize: 13,
    cursor: "pointer",
  },
  kbd: { marginLeft: "auto", color: T.w25, fontSize: 10.5, border: `1px solid ${T.line}`, borderRadius: 6, padding: "2px 6px" },
  dTable: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  dTableK: { color: T.w40, fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase" },
  dTableV: { color: T.gold, fontSize: 15, fontWeight: 800 },
  dRow: { flex: 1, display: "flex", minHeight: 0 },
  sidebar: {
    width: 262,
    flex: "0 0 262px",
    background: "#151515",
    borderRight: "1px solid #232323",
    padding: "18px 14px",
    overflowY: "auto",
    minHeight: 0,
  },
  sideSection: { color: T.w25, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", padding: "14px 8px 8px" },
  sideItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 11,
    background: "none",
    border: "none",
    color: T.w55,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    marginBottom: 3,
  },
  sideItemOn: { background: T.goldSoft, color: T.gold },
  sideCount: { color: T.w25, fontWeight: 500, fontSize: 12 },
  sideFoot: { marginTop: 18, color: T.w25, fontSize: 11, lineHeight: 1.7, padding: "14px 8px 0", borderTop: "1px solid #232323" },
  dMain: { flex: 1, overflowY: "auto", minHeight: 0, paddingTop: 18 },
  dMainHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "0 26px 14px" },
  dMainTitle: { margin: 0, fontSize: 19, fontWeight: 800 },
  dMainSub: { color: T.w40, fontSize: 12.5, marginTop: 5 },
  ghostSmall: {
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w92,
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 10,
    padding: "9px 14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  /* error */
  errorBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "rgba(224,82,82,0.12)",
    border: "1px solid rgba(224,82,82,0.35)",
    borderRadius: 14,
    padding: "14px 16px",
    margin: "16px 0",
  },
  retry: {
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w92,
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
};
