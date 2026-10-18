// ============================================================
// LOCATION: components/order/MenuPanel.tsx
// Step 2 of the customer flow — the menu.
//
//   • search (opens the full-screen search sheet)
//   • category tabs (FOOD / BEVERAGE / DESSERT …)
//   • group sections with the dish grid
//   • a sticky bottom bar with the cart summary
// ============================================================
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OrderShell, CartPill } from "./OrderShell";
import ItemTile from "./ItemTile";
import SearchSheet from "./SearchSheet";
import { C, money } from "./theme";
import { useOrderMenu } from "./useOrderMenu";
import { useOrderCart } from "./useOrderCart";
import type { MenuItem } from "./types";

export default function MenuPanel({
  table,
  token,
  tableGroup,
}: {
  table: string;
  token: string;
  tableGroup?: string;
}) {
  const router = useRouter();
  const menu = useOrderMenu();
  const [activeTab, setActiveTab] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);

  const itemsById = useMemo(
    () => new Map(menu.items.map((i) => [i.id, i])),
    [menu.items]
  );

  const cart = useOrderCart({ table, token, tableGroup, itemsById });

  /* The first tab is active by default. */
  const currentTab = activeTab || menu.tabs[0]?.label || "";
  const groups = useMemo(
    () => menu.groups.filter((g) => g.tabKey === currentTab),
    [menu.groups, currentTab]
  );

  const goCart = () => {
    const q = new URLSearchParams({ table });
    if (token) q.set("t", token);
    router.push(`/order/cart?${q.toString()}`);
  };

  const goWelcome = () => {
    const q = new URLSearchParams({ table });
    if (token) q.set("t", token);
    router.push(`/order?${q.toString()}`);
  };

  const handleAdd = (item: MenuItem) => {
    cart.add(item);
  };

  return (
    <>
      <OrderShell
        title="Our Menu"
        subtitle={table ? `Table ${table}` : undefined}
        onBack={goWelcome}
        right={
          <CartPill count={cart.newCount} total={cart.newTotal} onClick={goCart} />
        }
        bottom={
          <div className="ord-cartbar ord-safe-bottom">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
                  {cart.newCount} {cart.newCount === 1 ? "item" : "items"}
                </div>
                <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 1 }}>
                  {cart.newTotal > 0 ? money(cart.newTotal) : "Your cart is empty"}
                </div>
              </div>
              <button
                type="button"
                onClick={goCart}
                disabled={cart.newCount === 0}
                className="ord-btn"
                style={{
                  height: 44,
                  padding: "0 22px",
                  fontSize: 14.5,
                  background:
                    cart.newCount === 0
                      ? C.surfaceWarm
                      : "linear-gradient(180deg, #6B4A2F 0%, #5E3D26 100%)",
                  color: cart.newCount === 0 ? C.ink3 : "#FFF9F2",
                  boxShadow: cart.newCount === 0 ? "none" : C.shadowMd,
                }}
              >
                View cart
              </button>
            </div>
          </div>
        }
      >
        {/* search field */}
        <div style={{ padding: "12px 16px 4px" }}>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ord-tap"
            style={{
              width: "100%",
              height: 46,
              borderRadius: 999,
              background: C.surface,
              border: `1px solid ${C.line}`,
              boxShadow: C.shadowSm,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 16px",
              cursor: "pointer",
              fontFamily: C.font,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: C.ink3 }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.9" />
              <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 14, color: C.ink3 }}>Search dishes…</span>
          </button>
        </div>

        {/* category tabs */}
        {menu.tabs.length > 0 ? (
          <div
            className="ord-no-bar"
            style={{
              display: "flex",
              gap: 4,
              overflowX: "auto",
              padding: "10px 16px 0",
              borderBottom: `1px solid ${C.line}`,
            }}
          >
            {menu.tabs.map((tab) => {
              const active = tab.label === currentTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.label)}
                  className="ord-tap"
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: C.font,
                    padding: "9px 12px 12px",
                    fontSize: 13.5,
                    fontWeight: active ? 750 : 550,
                    color: active ? C.primary : C.ink3,
                    letterSpacing: "0.02em",
                  }}
                >
                  {tab.label}
                  <span style={{ fontSize: 10.5, color: active ? C.goldDeep : C.ink3, marginLeft: 5 }}>
                    {tab.count}
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      left: 10,
                      right: 10,
                      bottom: -1,
                      height: 2.5,
                      borderRadius: 2,
                      background: active ? C.primary : "transparent",
                      transition: "background .2s ease",
                    }}
                  />
                </button>
              );
            })}
          </div>
        ) : null}

        {/* items */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }} className="ord-scroll">
          {menu.loading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))",
                gap: 12,
                padding: 16,
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="ord-card" style={{ overflow: "hidden" }}>
                  <div className="ord-skel" style={{ aspectRatio: "4 / 3", borderRadius: 0 }} />
                  <div style={{ padding: 12 }}>
                    <div className="ord-skel" style={{ height: 12, width: "80%" }} />
                    <div className="ord-skel" style={{ height: 10, width: "55%", marginTop: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : menu.error ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 34 }}>😕</div>
              <div className="ord-title" style={{ marginTop: 10, fontSize: 16 }}>
                The menu did not load
              </div>
              <p className="ord-body" style={{ marginTop: 4, fontSize: 13 }}>
                {menu.error}
              </p>
              <button
                type="button"
                onClick={menu.reload}
                className="ord-btn ord-btn-ghost"
                style={{ marginTop: 16, height: 42, padding: "0 20px", fontSize: 13.5 }}
              >
                Try again
              </button>
            </div>
          ) : (
            <div style={{ padding: "4px 16px 28px" }}>
              {groups.map((group) => (
                <section key={group.key} style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 16.5,
                        fontWeight: 750,
                        color: C.ink,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {group.name}
                    </h2>
                    <span style={{ fontSize: 11.5, color: C.ink3 }}>{group.count}</span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {group.items.map((item) => (
                      <ItemTile
                        key={item.id}
                        item={item}
                        qty={cart.qtyOf(item.id)}
                        onAdd={() => handleAdd(item)}
                        onInc={() => cart.incItem(item.id)}
                        onDec={() => cart.decItem(item.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {groups.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 32 }}>🍽️</div>
                  <p className="ord-body" style={{ marginTop: 8, fontSize: 13 }}>
                    Nothing in this category yet.
                  </p>
                </div>
              ) : null}

              <p
                style={{
                  textAlign: "center",
                  color: C.ink3,
                  fontSize: 11.5,
                  marginTop: 28,
                }}
              >
                Prices include all taxes · Service charge is added at the till
              </p>
            </div>
          )}
        </div>
      </OrderShell>

      {searchOpen ? (
        <SearchSheet
          items={menu.items}
          qtyOf={cart.qtyOf}
          onAdd={handleAdd}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
    </>
  );
}
