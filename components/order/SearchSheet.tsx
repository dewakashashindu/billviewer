// ============================================================
// LOCATION: components/order/SearchSheet.tsx
// Full-screen search over the whole menu (bottom sheet on a
// phone, a centred panel on a big screen).
//
// The menu is already in memory, so the search is instant — no
// extra round trip to the server.
// ============================================================
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { C, moneyShort } from "./theme";
import type { MenuItem } from "./types";

export default function SearchSheet({
  items,
  onClose,
  onAdd,
  qtyOf,
}: {
  items: MenuItem[];
  onClose: () => void;
  onAdd: (item: MenuItem) => void;
  qtyOf: (itemId: string) => number;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q) ||
          (i.groupName || "").toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [items, query]);

  return (
    <>
      <div className="ord-sheet-backdrop" onClick={onClose} />
      <div
        className="ord-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Search the menu"
        style={{ height: "86dvh" }}
      >
        <div className="ord-sheet-grab" />

        {/* search field */}
        <div style={{ padding: "8px 16px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 46,
              padding: "0 14px",
              borderRadius: 999,
              background: C.surface,
              border: `1px solid ${C.line}`,
              boxShadow: C.shadowSm,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: C.ink3 }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.9" />
              <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes…"
              inputMode="search"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontFamily: C.font,
                fontSize: 15,
                color: C.ink,
                minWidth: 0,
              }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="ord-tap"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: C.ink3,
                  display: "inline-flex",
                  padding: 4,
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {/* results */}
        <div className="ord-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
          {query.trim() === "" ? (
            <div style={{ padding: "34px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 34 }}>🔎</div>
              <div className="ord-title" style={{ marginTop: 10, fontSize: 16 }}>
                What are you craving?
              </div>
              <p className="ord-body" style={{ marginTop: 4, fontSize: 13 }}>
                Type a dish name — fried rice, kottu, lime juice…
              </p>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "34px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 34 }}>🫙</div>
              <div className="ord-title" style={{ marginTop: 10, fontSize: 16 }}>
                No matches
              </div>
              <p className="ord-body" style={{ marginTop: 4, fontSize: 13 }}>
                We could not find “{query}”. Try another dish.
              </p>
            </div>
          ) : (
            <>
              <div className="ord-eyebrow" style={{ margin: "2px 0 10px" }}>
                {results.length} {results.length === 1 ? "dish" : "dishes"}
              </div>
              {results.map((item) => {
                const qty = qtyOf(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onAdd(item)}
                    className="ord-tap-soft"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textAlign: "left",
                      padding: "10px 0",
                      border: "none",
                      borderBottom: `1px solid ${C.lineSoft}`,
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: C.font,
                    }}
                  >
                    <span
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        background: C.surfaceWarm,
                        overflow: "hidden",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 21,
                        position: "relative",
                      }}
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        item.name.slice(0, 1)
                      )}
                      {qty > 0 ? (
                        <span
                          style={{
                            position: "absolute",
                            top: -4,
                            right: -4,
                            minWidth: 18,
                            height: 18,
                            padding: "0 5px",
                            borderRadius: 999,
                            background: C.primary,
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {qty}
                        </span>
                      ) : null}
                    </span>

                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 650,
                          color: C.ink,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 11.5,
                          color: C.ink3,
                          marginTop: 2,
                        }}
                      >
                        {item.groupName}
                      </span>
                    </span>

                    <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>
                      {moneyShort(item.price)}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}
