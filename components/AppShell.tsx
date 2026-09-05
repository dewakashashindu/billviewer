"use client";

// ============================================================
// AppShell — reporting side eke sidebar + mobile bottom nav
// (Bill viewer pages meka ain — /bill, / me shell eken wenaskai)
// ============================================================
import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import DateRangeModal from "./DateRangeModal";

/* ── Icons ── */
function IGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
function IChevRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IChevDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ── Nav types ── */
interface ReportLeaf {
  key: string;
  label: string;
  reportId?: string; // undefined = coming soon
}
interface Category {
  key: string;
  label: string;
  children: ReportLeaf[];
}
interface NavItem {
  key: string;
  label: string;
  icon: React.ReactElement;
  path?: string;
  children?: Category[];
}

const NAV: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: <IGrid />,
    path: "/dashboard",
  },
  {
    key: "reports",
    label: "Reports",
    icon: <IChart />,
    children: [
      {
        key: "cat-sales",
        label: "Sales Reports",
        children: [
          {
            key: "r-trans-summary",
            label: "Transaction Summary By Date",
            reportId: "transaction-summary",
          },
          { key: "r-item-sales", label: "Item-wise Sales" },
          { key: "r-dept-sales", label: "Department-wise Sales" },
          { key: "r-hourly", label: "Hourly Sales" },
        ],
      },
      {
        key: "cat-bills",
        label: "Bill Reports",
        children: [
          { key: "r-bill-audit", label: "Bill Audit" },
          { key: "r-cancelled", label: "Cancelled Bills" },
        ],
      },
      {
        key: "cat-staff",
        label: "Staff Reports",
        children: [{ key: "r-staff-perf", label: "Staff Performance" }],
      },
      {
        key: "cat-pay",
        label: "Payment Reports",
        children: [{ key: "r-pay-summary", label: "Payment Mode Summary" }],
      },
    ],
  },
];

const SHELL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  .sh-nav-scroll::-webkit-scrollbar { width:4px; }
  .sh-nav-scroll::-webkit-scrollbar-track { background:transparent; }
  .sh-nav-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:4px; }

  .sh-grip {
    position:absolute; right:-13px; top:50%; transform:translateY(-50%);
    width:13px; height:48px;
    background:linear-gradient(180deg,#243c44 0%,#1a2e36 100%);
    border:1px solid rgba(255,255,255,0.1); border-left:none;
    border-radius:0 8px 8px 0;
    display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:3px;
    cursor:pointer; z-index:50;
    transition:background 0.18s,width 0.15s;
  }
  .sh-grip:hover { background:linear-gradient(180deg,#2e4a52 0%,#223840 100%); width:15px; }
  .sh-grip-line { width:5px; height:1.5px; border-radius:99px; background:rgba(255,255,255,0.5); }

  .sh-group-btn {
    width:100%; border:none; background:transparent; cursor:pointer;
    font-family:'Inter',sans-serif;
    display:flex; align-items:center;
    border-radius:9px;
    transition:background 0.15s,color 0.15s;
  }
  .sh-group-btn:hover { background:rgba(255,255,255,0.07); }
  .sh-group-btn.active { background:rgba(255,255,255,0.13); }
  .sh-group-btn.icon-mode { width:44px; height:44px; justify-content:center; padding:0; color:rgba(255,255,255,0.45); }
  .sh-group-btn.icon-mode:hover { color:rgba(255,255,255,0.85); }
  .sh-group-btn.icon-mode.active { color:#fff; }
  .sh-group-btn.row-mode { height:40px; padding:0 10px; gap:10px; color:rgba(255,255,255,0.5); }
  .sh-group-btn.row-mode:hover { color:rgba(255,255,255,0.9); }
  .sh-group-btn.row-mode.active { color:#fff; }

  .sh-cat-btn {
    width:100%; border:none; background:transparent; cursor:pointer;
    font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600;
    display:flex; align-items:center; justify-content:space-between;
    height:34px; border-radius:7px; padding:0 10px 0 26px;
    color:rgba(255,255,255,0.55);
    transition:background 0.13s,color 0.13s;
    text-align:left;
  }
  .sh-cat-btn:hover { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.9); }

  .sh-leaf-btn {
    width:100%; border:none; background:transparent; cursor:pointer;
    font-family:'Inter',sans-serif; font-size:12px; font-weight:500;
    display:flex; align-items:center; gap:8px;
    height:31px; border-radius:7px;
    padding:0 10px 0 40px;
    color:rgba(255,255,255,0.42);
    transition:background 0.13s,color 0.13s;
    text-align:left;
  }
  .sh-leaf-btn:hover { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.85); }
  .sh-leaf-btn.active { background:rgba(255,255,255,0.11); color:#fff; }

  .sh-children { overflow:hidden; transition:max-height 0.28s cubic-bezier(.4,0,.2,1), opacity 0.22s ease; }

  .sh-desktop { display:flex; flex-direction:column; }

  .sh-mob-nav {
    display:none;
    position:fixed; bottom:0; left:0; right:0; z-index:100;
    background:linear-gradient(180deg,#1a2e35 0%,#111e24 100%);
    height:64px;
    align-items:center; justify-content:center;
    gap:8px;
    border-top:1px solid rgba(255,255,255,0.07);
    box-shadow:0 -4px 20px rgba(0,0,0,0.25);
  }
  .sh-mob-btn {
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    gap:3px; padding:6px 22px;
    border:none; background:transparent;
    color:rgba(255,255,255,0.4); cursor:pointer;
    border-radius:8px; transition:all 0.18s;
  }
  .sh-mob-btn.active { color:#fff; background:rgba(255,255,255,0.1); }
  .sh-mob-lbl { font-size:9px; font-weight:600; letter-spacing:0.02em; font-family:'Inter',sans-serif; white-space:nowrap; }

  @media(max-width:767px) {
    .sh-desktop { display:none !important; }
    .sh-mob-nav { display:flex !important; }
    .sh-main-body { padding-bottom:72px !important; }
  }
`;

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    reports: true,
  });
  const [modal, setModal] = useState<{
    title: string;
    reportId?: string;
  } | null>(null);

  function toggle(key: string) {
    setExpanded((p) => ({ ...p, [key]: !p[key] }));
  }

  function openReport(label: string, reportId?: string) {
    if (!reportId) {
      setModal({ title: label }); // coming-soon mode
      return;
    }
    setModal({ title: label, reportId });
  }

  /* ─────────── DESKTOP SIDEBAR ─────────── */
  const W = open ? 216 : 64;

  const sidebar = (
    <aside
      className="sh-desktop"
      style={{
        width: W,
        minWidth: W,
        height: "100vh",
        background: "linear-gradient(180deg,#1c2f37 0%,#111e25 100%)",
        flexShrink: 0,
        position: "relative",
        overflow: "visible",
        zIndex: 20,
        transition:
          "width 0.24s cubic-bezier(.4,0,.2,1),min-width 0.24s cubic-bezier(.4,0,.2,1)",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          justifyContent: open ? "flex-start" : "center",
          padding: open ? "14px 14px 4px" : "14px 0 4px",
          flexShrink: 0,
        }}
      >
        <Image
          src="/CAPTURE 1.png"
          alt="MICROECHEF"
          width={open ? 130 : 34}
          height={open ? 44 : 34}
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Nav */}
      <div
        className="sh-nav-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: open ? "10px 8px" : "10px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: open ? "stretch" : "center",
          gap: 1,
        }}
      >
        {NAV.map((item) => {
          const isDirect = !item.children;
          const activeItem = isDirect && pathname.startsWith(item.path ?? "#");
          const isExpanded = !!expanded[item.key];

          if (!open) {
            return (
              <button
                key={item.key}
                title={item.label}
                className={`sh-group-btn icon-mode ${activeItem ? "active" : ""}`}
                onClick={() => {
                  if (isDirect && item.path) router.push(item.path);
                  else {
                    setOpen(true);
                    setExpanded({ [item.key]: true });
                  }
                }}
              >
                {item.icon}
              </button>
            );
          }

          return (
            <div key={item.key}>
              {/* Top-level button */}
              <button
                className={`sh-group-btn row-mode ${activeItem ? "active" : ""}`}
                onClick={() => {
                  if (isDirect && item.path) router.push(item.path);
                  else toggle(item.key);
                }}
                style={{ justifyContent: "space-between" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: 18,
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.label}
                  </span>
                </span>
                {!isDirect && (
                  <span
                    style={{ display: "flex", alignItems: "center", opacity: 0.5 }}
                  >
                    {isExpanded ? <IChevDown /> : <IChevRight />}
                  </span>
                )}
              </button>

              {/* Categories */}
              {!isDirect && item.children && (
                <div
                  className="sh-children"
                  style={{
                    maxHeight: isExpanded
                      ? `${item.children.length * 320}px`
                      : "0px",
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div style={{ paddingBottom: 4 }}>
                    {item.children.map((cat: Category) => {
                      const catExpanded = !!expanded[cat.key];
                      return (
                        <div key={cat.key}>
                          <button
                            className="sh-cat-btn"
                            onClick={() => toggle(cat.key)}
                          >
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  width: 4,
                                  height: 4,
                                  borderRadius: "50%",
                                  background: "rgba(255,255,255,0.25)",
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ whiteSpace: "nowrap" }}>
                                {cat.label}
                              </span>
                            </span>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                opacity: 0.45,
                              }}
                            >
                              {catExpanded ? <IChevDown /> : <IChevRight />}
                            </span>
                          </button>

                          {/* Leaves */}
                          <div
                            className="sh-children"
                            style={{
                              maxHeight: catExpanded
                                ? `${cat.children.length * 36}px`
                                : "0px",
                              opacity: catExpanded ? 1 : 0,
                            }}
                          >
                            {cat.children.map((leaf) => {
                              const active =
                                leaf.reportId != null &&
                                pathname === `/reports/${leaf.reportId}`;
                              return (
                                <button
                                  key={leaf.key}
                                  className={`sh-leaf-btn ${active ? "active" : ""}`}
                                  onClick={() =>
                                    openReport(leaf.label, leaf.reportId)
                                  }
                                  title={
                                    leaf.reportId
                                      ? leaf.label
                                      : `${leaf.label} (coming soon)`
                                  }
                                >
                                  <span
                                    style={{
                                      width: 4,
                                      height: 4,
                                      borderRadius: "50%",
                                      flexShrink: 0,
                                      background: active
                                        ? "#7dd3d8"
                                        : "rgba(255,255,255,0.22)",
                                    }}
                                  />
                                  <span
                                    style={{
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {leaf.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grip */}
      <div className="sh-grip" onClick={() => setOpen((o) => !o)}>
        <div className="sh-grip-line" />
        <div className="sh-grip-line" />
        <div className="sh-grip-line" />
      </div>
    </aside>
  );

  /* ─────────── MOBILE BOTTOM NAV ─────────── */
  const mobileNav = (
    <nav className="sh-mob-nav">
      {NAV.map((item) => {
        const active =
          item.path === "/dashboard"
            ? pathname.startsWith("/dashboard")
            : pathname.startsWith("/reports");
        return (
          <button
            key={item.key}
            className={`sh-mob-btn ${active ? "active" : ""}`}
            onClick={() =>
              item.path
                ? router.push(item.path)
                : openReport("Transaction Summary By Date", "transaction-summary")
            }
          >
            {item.icon}
            <span className="sh-mob-lbl">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fff" }}>
      <style>{SHELL_CSS}</style>

      {sidebar}
      {mobileNav}

      {/* White content area */}
      <main
        className="sh-main-body"
        style={{
          flex: 1,
          minWidth: 0,
          background: "#ffffff",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </main>

      {/* Date range modal */}
      <DateRangeModal
        open={modal != null}
        title={modal?.title ?? ""}
        linked={modal?.reportId != null}
        onClose={() => setModal(null)}
        onApply={(from, to) => {
          const id = modal?.reportId;
          setModal(null);
          if (id) router.push(`/reports/${id}?from=${from}&to=${to}`);
        }}
      />
    </div>
  );
}
