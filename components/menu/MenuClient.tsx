"use client";

// ============================================================
// LOCATION: components/menu/MenuClient.tsx
// Customer menu & ordering screen — /menu?table=T-07&group=...&t=...
//
// Step machine (same flow as the Expo app):
//   welcome → home → group → (sub-group) → cart → success
// Mobile: glass header + floating bottom bar + full-screen cart sheet.
// Desktop: top bar + sidebar categories + grid + sticky cart panel.
//
// The table is validated up front via GET /api/order/table (the
// signed ?t= token is forwarded) — an unknown table or a bad token
// gets a "scan your QR" screen instead of a failed order at confirm.
// Cart APIs are the guarded /api/order/* endpoints (token + rate
// limit + server-side prices), same as the /order flow.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { categoryLabel, T } from "./theme";
import { useCustomerCart, type CartRow } from "./useCustomerCart";
import { useIsDesktop, useIsWide } from "./useMedia";
import { useMediaQuery } from "./useMedia";
import { useMenuTree } from "./useMenuTree";
import BottomBar, { CartGlyph, SearchGlyph } from "./BottomBar";
import CartView from "./CartView";
import GuestForm from "./GuestForm";
import GroupScreen from "./GroupScreen";
import ItemDetailModal from "./ItemDetailModal";
import MenuHome from "./MenuHome";
import OrderSuccess from "./OrderSuccess";
import RemarkSheet from "./RemarkSheet";
import SearchOverlay from "./SearchOverlay";
import WelcomeScreen from "./WelcomeScreen";
import type { GroupCard, SubGroup } from "./types";

type View = "welcome" | "guest" | "home" | "group" | "cart" | "success";

export default function MenuClient({
  table,
  tableGroup,
  locCode = "",
  locationName = "",
  token,
  invalidLink = false,
  isTakeaway = false,
}: {
  table: string;
  tableGroup: string;
  /** Location code embedded in the QR (Tbl_LocationMaster.LocCode). */
  locCode?: string;
  /** Location display name (Tbl_LocationMaster.LocDes). */
  locationName?: string;
  /** Signed table token (minted server-side or from a legacy ?t= URL). */
  token?: string;
  /** The ?id= link could not be decrypted — show the scan screen. */
  invalidLink?: boolean;
  /** Takeaway QR — no table, no pax, orders go in as OrderType TA. */
  isTakeaway?: boolean;
}) {
  const desktop = useIsDesktop();
  const wide = useIsWide();
  /* 1024–1279px still gets the desktop shell, but only two cards per
     row and slimmer rails — three columns there left ~100px cards.
     3-up only once the content area can give every card ~240px. */
  const fourUp = useMediaQuery("(min-width: 1700px)");
  const threeUp = useMediaQuery("(min-width: 1440px)");
  const columns = fourUp ? 4 : threeUp ? 3 : 2;
  const tree = useMenuTree();

  const itemsById = useMemo(
    () => new Map(tree.searchable.map((i) => [i.id, i])),
    [tree.searchable]
  );

  /* ── table validation (fail fast, not at confirm time) ──────
     The QR lands here with ?table=…&t=…. Verify the table exists
     (and the token is valid) via the guarded /api/order/table
     BEFORE the guest builds a cart — otherwise the order only
     fails at confirm with "Table not found".
       ok      → proceed (adopt the table group when the URL
                 didn't carry one)
       blocked → 404 (unknown/disabled table) or 403 (bad token):
                 show the "scan your QR" screen instead of the menu
       offline → endpoint unreachable: fail open, the confirm
                 call is the backstop */
  const [tableCheckResult, setTableCheckResult] = useState<{
    table: string;
    token: string;
    status: "ok" | "blocked" | "offline";
  } | null>(null);
  const [resolvedGroup, setResolvedGroup] = useState(tableGroup);

  useEffect(() => {
    if (!table) return;
    /* The takeaway QR has no POS table to verify — the TA order type
       is decided on the server from the table number. */
    if (isTakeaway) return;
    let alive = true;
    (async () => {
      try {
        const qs = new URLSearchParams({ table });
        if (token) qs.set("t", token);
        const res = await fetch(`/api/order/table?${qs.toString()}`, { cache: "no-store" });
        if (!alive) return;
        if (res.ok) {
          const json = await res.json().catch(() => null);
          /* The POS is authoritative (it returns the readable group
             NAME, e.g. "A. Ground Floor"), so it replaces the group
             carried in the URL / encrypted id ("001"). */
          const group = String(json?.data?.tableGroup ?? "").trim();
          if (group) setResolvedGroup(group);
          setTableCheckResult({ table, token: token ?? "", status: "ok" });
        } else if (res.status === 404 || res.status === 403) {
          setTableCheckResult({ table, token: token ?? "", status: "blocked" });
        } else {
          setTableCheckResult({ table, token: token ?? "", status: "offline" }); // fail open
        }
      } catch {
        if (alive) setTableCheckResult({ table, token: token ?? "", status: "offline" }); // fail open
      }
    })();
    return () => {
      alive = false;
    };
  }, [table, token, isTakeaway]);

  /* "checking" is derived — a result only counts for the table (and
     token) it was fetched for, so a table change re-checks. */
  const tableCheck: "checking" | "ok" | "blocked" | "offline" = isTakeaway
    ? "ok"
    : tableCheckResult && tableCheckResult.table === table && tableCheckResult.token === (token ?? "")
      ? tableCheckResult.status
      : "checking";

  // resolvedGroup starts as the URL group and is filled in from the
  // table lookup when the URL didn't carry one.
  const cart = useCustomerCart({
    table,
    tableGroup: resolvedGroup || tableGroup,
    locCode,
    token,
    itemsById,
    takeaway: isTakeaway,
  });

  const [view, setView] = useState<View>("welcome");
  const [tabChoice, setTabChoice] = useState("");
  const [group, setGroup] = useState<GroupCard | null>(null);
  const [sub, setSub] = useState<SubGroup | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [remarkRow, setRemarkRow] = useState<CartRow | null>(null);
  const [opening, setOpening] = useState(false);
  const [pulse, setPulse] = useState(false);
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
    setView(cart.hasGuest ? "home" : "guest");
  }, [opening, tree.loading, cart.hasGuest]);

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
    if (!cart.hasGuest) {
      setView("guest");
      window.scrollTo({ top: 0 });
      return;
    }
    const result = await cart.confirm();
    if (result) {
      setView("success");
      window.scrollTo({ top: 0 });
    }
  }, [cart]);

  /* ══════════════════ no table → ask for the QR ═════════════
     Manual table entry is intentionally NOT offered — ordering is
     QR-scan only, so a guest can only reach the menu through a
     valid table QR link. */
  if (!table && !invalidLink) {
    return (
      <div className="mnu-min-dvh" style={s.root}>
        <div style={s.scanWrap}>
          <span style={s.scanArt} aria-hidden>📷</span>
          <h2 style={s.scanTitle}>Scan your table QR</h2>
          <p style={s.scanSub}>
            To order, please scan the QR code on your table.
            <br />
            Ask a member of our staff if you need help.
          </p>
        </div>
      </div>
    );
  }

  /* ══════════════════ invalid link / table not found ════════ */
  if (invalidLink || (table && tableCheck === "blocked")) {
    return (
      <div className="mnu-min-dvh" style={s.root}>
        <div style={s.scanWrap}>
          <span style={s.scanArt} aria-hidden>{invalidLink ? "🔒" : "🔍"}</span>
          <h2 style={s.scanTitle}>{invalidLink ? "Invalid link" : "Table not found"}</h2>
          <p style={s.scanSub}>
            {invalidLink ? (
              <>
                This link is invalid or has expired.
                <br />
                Please scan the QR code on your table.
              </>
            ) : (
              <>
                We couldn&apos;t verify table <b style={{ color: T.gold }}>{table}</b>.
                <br />
                Please scan the QR code on your table,
                <br />
                or ask a member of our staff for assistance.
              </>
            )}
          </p>
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
          tableGroup={resolvedGroup || tableGroup}
          locationName={locationName}
          takeaway={isTakeaway}
          opening={opening}
          onOpenMenu={() => void openMenu()}
        />
        {opening && (
          <div style={s.preparing} className="mnu-anim-fade">
            <div style={s.prepCard} className="mnu-anim-pop">
              <span className="mnu-spinner" style={s.prepSpinner} />
              <div style={s.prepTitle}>Preparing your menu</div>
              <div style={s.prepText}>Please wait a moment...</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════ guest form ═════════════════════════════
     Dine-in: pax + phone (Tbl_CustomerMaster lookup) + name.
     Takeaway: phone + name only (no pax). */
  if (view === "guest") {
    return (
      <div className="mnu-min-dvh" style={s.root}>
        <GuestForm
          table={table}
          tableGroup={resolvedGroup || tableGroup}
          takeaway={isTakeaway}
          initial={cart.guest}
          onSubmit={(g) => {
            cart.setGuestDetails(g);
            setView("home");
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  /* ══════════════════ desktop shell ════════════════════════ */
  const main = (
    <div
      style={{
        padding: desktop ? "22px 26px 40px" : "16px 16px 0",
        maxWidth: desktop ? 1180 : "100%",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {tree.error && (
        <div style={s.errorBox}>
          <div style={{ color: T.red, fontSize: 13.5 }}>{tree.error}</div>
          <button type="button" style={s.retry} onClick={tree.reload}>
            Try again
          </button>
        </div>
      )}

      {tree.loading && !tree.error && (
        <div
          style={{
            ...s.skelGrid,
            gridTemplateColumns: desktop ? "repeat(3, minmax(0,1fr))" : "repeat(2, minmax(0,1fr))",
          }}
        >
          {Array.from({ length: desktop ? 6 : 4 }).map((_, i) => (
            <div key={i} className="mnu-skel" style={{ ...s.skelCard, height: desktop ? 208 : 190 }} />
          ))}
        </div>
      )}

      {!tree.loading && view === "home" && (
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
          columns={columns}
          heroCompact={!fourUp}
        />
      )}

      {!tree.loading && view === "group" && group && (
        <GroupScreen
          group={group}
          subGroup={sub}
          desktop={desktop}
          columns={columns}
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
          onAddMore={() => {
            setGroup(null);
            setSub(null);
            setView("home");
          }}
          onDone={() => {
            if (isTakeaway) {
              cart.resetAll(true);
            }
            setGroup(null);
            setSub(null);
            setDetailId(null);
            setView("welcome");
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </div>
  );

  if (desktop) {
    return (
      <div className="mnu-min-dvh" style={{ ...s.root, ...s.dRoot }}>
        <header style={s.dHeader} className="mnu-glass mnu-safe-top">
          <div style={s.dBrand}>
            <span style={s.dLogoRing}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/millamirissa.png" alt="Mila Mirissa" style={s.dLogo} />
            </span>
            <div style={s.dBrandText}>
              <span style={s.dBrandMain}>MILA MIRISSA</span>
              <span style={s.dBrandSub}>CUSTOMER MENU</span>
            </div>
          </div>
          <div style={s.dHeaderMid}>
            <button type="button" style={s.dNavBtn} className="mnu-tap" onClick={() => setView("home")}>
              Menu
            </button>
            <button type="button" style={s.dSearch} className="mnu-tap-soft" onClick={() => setSearchOpen(true)}>
              <SearchGlyph size={16} color="rgba(255,255,255,0.5)" />
              <span style={{ color: T.w40 }}>Search dishes…</span>
              <span style={s.kbd}>Ctrl K</span>
            </button>
          </div>
          <div style={s.dTable}>
            <span style={s.dTableK}>{isTakeaway ? "Order type" : "Your table"}</span>
            <span style={s.dTableV}>{isTakeaway ? "TAKEAWAY" : table}</span>
          </div>
        </header>

        <div style={s.dRow}>
          <aside style={{ ...s.sidebar, ...(wide ? null : s.sidebarNarrow) }} className="mnu-scroll">
            <div style={s.sideSection}>Categories</div>
            {tree.tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                style={{ ...s.sideItem, ...(tab.key === activeTab ? s.sideItemOn : null) }}
                className="mnu-tap-soft"
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
                  className="mnu-tap-soft"
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
                  className="mnu-tap"
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
      <header style={s.mHeader} className="mnu-glass mnu-safe-top">
        {/* no home button here — keeps the logo dead-centre (spacer only) */}
        <span style={s.mHeadSpacer} aria-hidden />
        <div style={s.mBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/millamirissa.png" alt="Mila Mirissa" style={s.mLogo} />
          <span style={s.mBrandSub}>
            {isTakeaway ? "TAKEAWAY" : `TABLE ${table}`}
          </span>
        </div>
        <button
          type="button"
          style={s.mHeadBtn}
          className={`mnu-tap${cart.newCount > 0 ? " mnu-pulse-gold" : ""}`}
          onClick={() => setView("cart")}
          aria-label="Cart"
        >
          <CartGlyph size={20} color={cart.newCount > 0 ? T.gold : T.white} />
          {cart.newCount > 0 && <span style={s.mBadge}>{cart.newCount}</span>}
        </button>
      </header>

      {/* the floating bottom bar overlays the last ~92px — keep content clear of it */}
      <main style={{ flex: 1, paddingBottom: 92 }}>{main}</main>

      <BottomBar
        cartCount={cart.newCount}
        pulse={pulse}
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

      </>
    );
  }
}

const s: Record<string, CSSProperties> = {
  root: {
    background: `radial-gradient(1100px 520px at 85% -10%, rgba(217,164,99,0.10), transparent 62%), ${T.bg}`,
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
  scanArt: {
    width: 104,
    height: 104,
    borderRadius: "50%",
    background: "radial-gradient(circle at 32% 28%, #4a3a22, #1B1712 75%)",
    border: `1px solid ${T.goldLine}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 46,
    boxShadow: "0 18px 44px rgba(0,0,0,0.45)",
  },
  scanTitle: { margin: "20px 0 0", fontSize: 23, fontWeight: 800 },
  scanSub: { color: T.w55, fontSize: 13.5, lineHeight: 1.75, margin: "10px 0 24px", maxWidth: 340 },
  /* loading overlay */
  preparing: {
    position: "fixed",
    inset: 0,
    zIndex: 120,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  prepCard: {
    minWidth: 230,
    padding: "28px 26px",
    borderRadius: 22,
    background: T.card,
    border: `1px solid ${T.goldLine}`,
    textAlign: "center",
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
  },
  prepSpinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "3px solid rgba(255,255,255,0.22)",
    borderTopColor: T.gold,
    display: "inline-block",
  },
  prepTitle: { color: T.white, fontSize: 16, fontWeight: 800, marginTop: 14 },
  prepText: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 5 },

  /* skeleton grid (menu loading) */
  skelGrid: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
    paddingBottom: 10,
  },
  skelCard: { width: "100%" },

  /* mobile header */
  mHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px 10px",
    position: "sticky",
    top: 0,
    zIndex: 30,
    borderBottom: `1px solid ${T.line}`,
  },
  mHeadSpacer: { width: 40, height: 40, flex: "0 0 auto" },
  mHeadBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
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
    background: "#E5484D",
    border: "2px solid #14100D",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
  mBrand: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5 },
  mLogo: { width: 34, height: 34, display: "block", borderRadius: "50%", border: `1.5px solid ${T.goldLine}` },
  mBrandSub: { fontSize: 8.5, letterSpacing: 3.2, color: T.gold, fontWeight: 700 },

  /* desktop shell */
  dHeader: {
    height: 62,
    flex: "0 0 auto",
    borderBottom: `1px solid ${T.line}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    padding: "0 22px",
    position: "sticky",
    top: 0,
    zIndex: 30,
  },
  dBrand: { display: "flex", alignItems: "center", gap: 12 },
  dLogoRing: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    padding: 2.5,
    background: "conic-gradient(from 210deg, rgba(217,164,99,0.9), rgba(217,164,99,0.15), rgba(217,164,99,0.9))",
    display: "inline-flex",
    flex: "0 0 auto",
  },
  dLogo: { width: "100%", height: "100%", display: "block", borderRadius: "50%", border: `2px solid ${T.surface}` },
  dBrandText: { display: "flex", flexDirection: "column", gap: 3 },
  dBrandMain: { fontSize: 15, fontWeight: 800, letterSpacing: 3 },
  dBrandSub: { fontSize: 8.5, letterSpacing: 3.2, color: T.gold, fontWeight: 700 },
  dHeaderMid: { display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" },
  dNavBtn: {
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w72,
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 11,
    padding: "9px 16px",
    cursor: "pointer",
  },
  dSearch: {
    width: 320,
    height: 40,
    borderRadius: 20,
    background: T.card,
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    padding: "0 14px",
    fontSize: 13,
    cursor: "pointer",
  },
  kbd: {
    marginLeft: "auto",
    color: T.w40,
    fontSize: 10.5,
    border: `1px solid ${T.line}`,
    borderRadius: 6,
    padding: "2px 7px",
    background: "rgba(255,255,255,0.04)",
  },
  dTable: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    padding: "7px 14px",
    borderRadius: 12,
    background: T.goldSoft,
    border: `1px solid ${T.goldLine}`,
  },
  dTableK: { color: "rgba(255,255,255,0.6)", fontSize: 9.5, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700 },
  dTableV: { color: T.gold, fontSize: 15, fontWeight: 800 },
  /** desktop shell is a fixed-height app frame: header + three
      independently scrolling columns, cart footer always visible */
  dRoot: { height: "100dvh", maxHeight: "100dvh", overflow: "hidden" },
  dRow: { flex: 1, display: "flex", minHeight: 0 },
  sidebarNarrow: { width: 214, flex: "0 0 214px", padding: "16px 10px" },
  sidebar: {
    width: 262,
    flex: "0 0 262px",
    background: T.surface,
    borderRight: "1px solid rgba(255,246,234,0.08)",
    padding: "18px 14px",
    overflowY: "auto",
    minHeight: 0,
  },
  sideSection: {
    color: T.w40,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    padding: "14px 8px 8px",
  },
  sideItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "none",
    border: "none",
    color: T.w55,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    marginBottom: 3,
  },
  sideItemOn: {
    background: T.goldSoft,
    color: T.gold,
    boxShadow: "inset 2.5px 0 0 " + T.gold,
  },
  sideCount: {
    color: T.w40,
    fontWeight: 700,
    fontSize: 11.5,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: "2px 8px",
  },
  sideFoot: {
    marginTop: 18,
    color: T.w40,
    fontSize: 11,
    lineHeight: 1.7,
    padding: "14px 8px 0",
    borderTop: "1px solid rgba(255,246,234,0.08)",
  },
  dMain: { flex: 1, overflowY: "auto", minHeight: 0, paddingTop: 20 },
  dMainHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "0 26px 16px" },
  dMainTitle: { margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: 0.2 },
  dMainSub: { color: T.w40, fontSize: 12.5, marginTop: 6 },
  ghostSmall: {
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w92,
    fontSize: 12.5,
    fontWeight: 700,
    borderRadius: 11,
    padding: "9px 15px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  /* error */
  errorBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: T.redSoft,
    border: "1px solid rgba(255,143,143,0.35)",
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
    fontWeight: 700,
    cursor: "pointer",
  },

  /* dialog */
  dlgOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 110,
    background: "rgba(0,0,0,0.62)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dlg: {
    width: "100%",
    maxWidth: 380,
    background: T.card,
    border: `1px solid ${T.goldLine}`,
    borderRadius: 24,
    padding: "26px 24px 22px",
    textAlign: "center",
    boxShadow: "0 28px 70px rgba(0,0,0,0.55)",
  },
  dlgIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: T.goldSoft,
    border: `1px solid ${T.goldLine}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    marginBottom: 14,
  },
  dlgTitle: { margin: 0, color: T.white, fontSize: 19, fontWeight: 800 },
  dlgText: { color: T.w55, fontSize: 13, lineHeight: 1.7, margin: "10px 0 20px" },
  dlgActions: { display: "flex", gap: 10 },
  dlgGhost: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w72,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  dlgPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    background: T.goldGrad,
    border: "1px solid rgba(255,255,255,0.22)",
    color: T.goldInk,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: T.shadowGold,
  },
};
