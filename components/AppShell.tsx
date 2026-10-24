"use client";

// ============================================================
// AppShell — reporting side eke sidebar + mobile bottom nav
// (Bill viewer pages meka ain — /bill, / me shell eken wenaskai)
// ============================================================
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import DateRangeModal, { type DateRangeFilterSpec } from "./DateRangeModal";
import { REPORTS_CONFIG } from "@/config/reports.config";

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
function IQr() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M21 21v.01M18 18h.01" />
    </svg>
  );
}
function IUserPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
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
  adminOnly?: boolean;
}

export interface ShellUserInfo {
  userId: string;
  loginName: string;
  userName: string;
  groupId?: string;
  isAdmin: boolean;
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
        // Performance Report (POS Crystal Report)
        key: "cat-performance",
        label: "Performance Report",
        children: [
          {
            key: "r-perf-report",
            label: "Performance Report",
            reportId: "performance-report",
          },
        ],
      },
      {
        // 1.1 – 1.5 Sales
        key: "cat-sales",
        label: "Sales Reports",
        children: [
          {
            key: "r-ss-om",
            label: "Sales Summery – Order Mode Wise",
            reportId: "sales-summary-order-mode",
          },
          {
            key: "r-ss-bt",
            label: "Sales Summery – Bill Type Wise",
            reportId: "sales-summary-bill-type",
          },
          {
            key: "r-ss-all",
            label: "Sales Summery – ALL",
            reportId: "sales-summary",
          },
          {
            key: "r-sd-bt",
            label: "Sales Detail – Bill Type Wise",
            reportId: "sales-details-bill-type",
          },
          {
            key: "r-sd-om",
            label: "Sales Detail – Order Mode Wise",
            reportId: "sales-details-order-mode",
          },
          {
            key: "r-sd-all",
            label: "Sales Detail – All",
            reportId: "sales-details",
          },
          { key: "r-sbc-s", label: "Sales By Category – Summery", reportId: "sales-category-summary" },
          { key: "r-sbc-d", label: "Sales By Category – Detail", reportId: "sales-category-detail" },
          { key: "r-hourly", label: "Hourly Sales", reportId: "hourly-sales" },
        ],
      },
      {
        // 2.x Payment Mode
        key: "cat-payment",
        label: "Payment Mode",
        children: [
          { key: "r-pay-summary", label: "Payment Summery", reportId: "payment-summary" },
          { key: "r-pay-mode", label: "Pay Mode Wise", reportId: "payment-summary-wise" },
          { key: "r-pay-grid", label: "Bill Pay Mode Wise Grid", reportId: "payment-bill-paymode-grid" },
          { key: "r-pay-billtype", label: "Bill Type Wise", reportId: "payment-billtype" },
        ],
      },
      {
        // 3.x Cashier Collection
        key: "cat-cashier",
        label: "Cashier Collection",
        children: [
          { key: "r-cc-cashier", label: "Cashier Wise Sales", reportId: "cashier-collection" },
          { key: "r-cc-pbd", label: "Payment Break Down", reportId: "cashier-payment-breakdown" },
          { key: "r-cc-pbd-grid", label: "Payment Break Down – Grid", reportId: "cashier-breakdown-grid" },
        ],
      },
      {
        // 4.x Menu Item Issue
        key: "cat-menu-issue",
        label: "Menu Item Issue",
        children: [
          { key: "r-mii-item", label: "Item Issue", reportId: "menu-item-issue" },
          { key: "r-mii-date", label: "Menu Item Issue By Date", reportId: "menu-item-issue-date" },
        ],
      },
      {
        // 5.1 Item Movement
        key: "cat-item-move",
        label: "Item Movement",
        children: [{ key: "r-im", label: "Item Movement", reportId: "item-movement" }],
      },
      {
        // 6.1 Table Management
        key: "cat-table",
        label: "Table Management",
        children: [{ key: "r-tm-steward", label: "Steward Wise", reportId: "steward-wise" }],
      },
      {
        // 7.1 Transaction reports
        key: "cat-txn",
        label: "Transaction Reports",
        children: [
          {
            key: "r-trans-summary",
            label: "Transaction Summery",
            reportId: "transaction-summary",
          },
        ],
      },
      {
        // 8.x Taxes and Service Charge
        key: "cat-tax",
        label: "Taxes & Service Charge",
        children: [
          { key: "r-tsc-sc", label: "Service Charge", reportId: "service-charge" },
          { key: "r-tsc-vat", label: "Tax & VAT Report", reportId: "tax-vat" },
        ],
      },
      {
        // 9 Complimentary Cost
        key: "cat-comp",
        label: "Complimentary Cost",
        children: [{ key: "r-comp", label: "Complimentary Cost", reportId: "complimentary-cost" }],
      },
      {
        // 10 Void
        key: "cat-void",
        label: "Void Reports",
        children: [{ key: "r-void", label: "Void Summery and Detail", reportId: "void-report" }],
      },
      {
        // 11 Pax Count
        key: "cat-pax",
        label: "Pax Count",
        children: [{ key: "r-pax", label: "Pax Count", reportId: "pax-count" }],
      },
      {
        // 12 Cash In/Out
        key: "cat-cash-io",
        label: "Cash In/Out",
        children: [{ key: "r-cio", label: "Cash In/Out Report", reportId: "cash-inout" }],
      },
      {
        // 14 Open tables
        key: "cat-open",
        label: "Open Tables",
        children: [{ key: "r-open", label: "Open (On-Going) Tables", reportId: "open-tables" }],
      },
      {
        // 15.x Tracing
        key: "cat-trace",
        label: "Tracing",
        children: [
          { key: "r-trace-slip", label: "Slip Trace", reportId: "slip-trace" },
          { key: "r-trace-inv", label: "Invoice Trace", reportId: "invoice-trace" },
        ],
      },
      {
        // 16 KOT/BOT
        key: "cat-kotbot",
        label: "KOT/BOT Tracing",
        children: [{ key: "r-kotbot", label: "KOT/BOT Tracing", reportId: "kot-bot" }],
      },
      {
        // 21.x Credit Settlement
        key: "cat-credit",
        label: "Credit Settlement",
        children: [
          { key: "r-cred-ccs", label: "Current Credit Summery", reportId: "credit-summary" },
          { key: "r-cred-history", label: "Credit History", reportId: "credit-history" },
          { key: "r-cred-pay", label: "Payment History", reportId: "credit-pay-history" },
          { key: "r-cred-payhistory", label: "Payment History", reportId: "credit-pay-history" },
          { key: "r-cred-account", label: "Account Detail", reportId: "credit-account-detail" },
        ],
      },
    ],
  },
  {
    // Right below Reports — Admin User Creation page
    key: "user-creation",
    label: "User Creation",
    icon: <IUserPlus />,
    path: "/user-creation",
    adminOnly: true,
  },
  {
    // Last sidebar item — Table QR generator page
    key: "table-qr",
    label: "Table QR Codes",
    icon: <IQr />,
    path: "/table-qr",
  },
];

const SHELL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  .sh-nav-scroll::-webkit-scrollbar { width:4px; }
  .sh-nav-scroll::-webkit-scrollbar-track { background:transparent; }
  .sh-nav-scroll::-webkit-scrollbar-thumb { background:rgba(104,72,48,0.28); border-radius:4px; }

  .sh-grip {
    position:absolute; right:-13px; top:50%; transform:translateY(-50%);
    width:13px; height:48px;
    background:linear-gradient(180deg,#684830 0%,#45301D 100%);
    border:1px solid rgba(69,48,29,0.25); border-left:none;
    border-radius:0 8px 8px 0;
    display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:3px;
    cursor:pointer; z-index:50;
    transition:background 0.18s,width 0.15s;
  }
  .sh-grip:hover { background:linear-gradient(180deg,#907860 0%,#45301D 100%); width:15px; }
  .sh-grip-line { width:5px; height:1.5px; border-radius:99px; background:rgba(255,255,255,0.5); }

  .sh-group-btn {
    width:100%; border:none; background:transparent; cursor:pointer;
    font-family:'Inter',sans-serif;
    display:flex; align-items:center;
    border-radius:9px;
    transition:background 0.15s,color 0.15s;
  }
  .sh-group-btn:hover { background:rgba(104,72,48,0.07); }
  .sh-group-btn.active { background:rgba(104,72,48,0.12); }
  .sh-group-btn.icon-mode { width:44px; height:44px; justify-content:center; padding:0; color:rgba(69,48,29,0.55); }
  .sh-group-btn.icon-mode:hover { color:#45301D; }
  .sh-group-btn.icon-mode.active { color:#684830; }
  .sh-group-btn.row-mode { height:40px; padding:0 10px; gap:10px; color:rgba(69,48,29,0.62); }
  .sh-group-btn.row-mode:hover { color:#45301D; }
  .sh-group-btn.row-mode.active { color:#684830; }

  .sh-cat-block { margin-top:6px; }

  .sh-cat-btn {
    width:100%;
    border:1px solid #E2D2BA;
    background:#F3E8D8;
    cursor:pointer;
    font-family:'Inter',sans-serif; font-size:12px; font-weight:700;
    letter-spacing:0.15px;
    display:flex; align-items:center; justify-content:space-between;
    height:34px; border-radius:8px; padding:0 10px 0 12px;
    color:#45301D;
    transition:all 0.14s ease;
    text-align:left;
  }
  .sh-cat-btn:hover { background:#EADBC5; border-color:#D2BC9C; color:#382514; }
  .sh-cat-btn.has-active {
    background:linear-gradient(135deg,#EFE1CC 0%,#E7D4B8 100%);
    border-color:#C7AE8B;
    color:#382514;
    box-shadow:inset 3px 0 0 #684830;
  }

  .sh-leaf-list {
    display:flex; flex-direction:column; gap:2px;
    padding:4px 0 3px 10px;
    margin-left:8px;
    border-left:1.5px solid #E6D8C3;
  }

  .sh-leaf-btn {
    width:100%; border:none; background:transparent; cursor:pointer;
    font-family:'Inter',sans-serif; font-size:12px; font-weight:500;
    display:flex; align-items:center;
    min-height:31px; border-radius:7px;
    padding:5px 10px;
    color:#6B543E;
    transition:background 0.13s,color 0.13s;
    text-align:left;
    line-height:1.25;
  }
  .sh-leaf-btn:hover { background:rgba(104,72,48,0.08); color:#45301D; }
  .sh-leaf-btn.active {
    background:linear-gradient(135deg,#45301D 0%,#684830 100%);
    color:#ffffff;
    font-weight:600;
    box-shadow:0 2px 6px rgba(69,48,29,0.18);
  }

  .sh-children { overflow:hidden; transition:max-height 0.28s cubic-bezier(.4,0,.2,1), opacity 0.22s ease; }

  .sh-desktop { display:flex; flex-direction:column; }

  .sh-mob-nav {
    display:none;
    position:fixed; bottom:0; left:0; right:0; z-index:100;
    background:#FCF7F3;
    height:64px;
    align-items:center; justify-content:center;
    gap:8px;
    border-top:1px solid #E4D6BF;
    box-shadow:0 -4px 20px rgba(104,72,48,0.15);
  }
  .sh-mob-btn {
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    gap:3px; padding:6px 22px;
    border:none; background:transparent;
    color:rgba(69,48,29,0.55); cursor:pointer;
    border-radius:8px; transition:all 0.18s;
  }
  .sh-mob-btn.active { color:#fff; background:#684830; }
  .sh-mob-lbl { font-size:9px; font-weight:600; letter-spacing:0.02em; font-family:'Inter',sans-serif; white-space:nowrap; }

  @media(max-width:767px) {
    .sh-desktop { display:none !important; }
    .sh-mob-nav { display:flex !important; }
    .sh-main-body { padding-bottom:72px !important; }
  }
`;

/* ── UserBar — content area top-right: logged-in user + sign-out ── */
function UserBar({
  user,
}: {
  user: ShellUserInfo | null;
}) {
  const router = useRouter();
  const name = user?.userName || user?.loginName || "";

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.replace("/login");
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        padding: "10px 18px 0",
        flexShrink: 0,
      }}
    >
      {name && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#684830 0%,#45301D 100%)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textTransform: "uppercase",
            }}
          >
            {name.trim().charAt(0) || "U"}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#684830" }}>
            {name}
          </span>
          {user && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                background: user.isAdmin ? "#F0E8D8" : "#F8F4EE",
                border: "1px solid #E4D6BF",
                color: user.isAdmin ? "#45301D" : "#6B543E",
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              {user.isAdmin ? "Admin" : "User"}
            </span>
          )}
        </span>
      )}
      <button
        onClick={logout}
        title="Sign out"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          border: "1px solid #E4D6BF",
          borderRadius: 8,
          background: "#fff",
          color: "#6B543E",
          cursor: "pointer",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}

export default function AppShell({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser?: ShellUserInfo;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<ShellUserInfo | null>(
    currentUser ?? null
  );
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    reports: true,
    "cat-performance": true,
  });
  const [modal, setModal] = useState<{
    title: string;
    reportId?: string;
    filter?: DateRangeFilterSpec;
  } | null>(null);

  // Auto-expand the category containing the currently active report
  useEffect(() => {
    if (!pathname.startsWith("/reports/")) return;
    const reportsNav = NAV.find((n) => n.key === "reports");
    if (!reportsNav?.children) return;
    for (const cat of reportsNav.children) {
      if (
        cat.children.some(
          (leaf) => leaf.reportId && pathname === `/reports/${leaf.reportId}`
        )
      ) {
        setExpanded((prev) =>
          prev.reports && prev[cat.key]
            ? prev
            : { ...prev, reports: true, [cat.key]: true }
        );
        break;
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (currentUser) {
      setUserInfo(currentUser);
      return;
    }
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const u = d.user || d.data;
        if (alive && d.success && u) {
          setUserInfo({
            userId: String(u.userId ?? ""),
            loginName: String(u.loginName ?? ""),
            userName: String(u.userName ?? u.loginName ?? ""),
            groupId: String(u.groupId ?? ""),
            isAdmin: Boolean(u.isAdmin),
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [currentUser]);

  const visibleNav = NAV.filter(
    (item) => !item.adminOnly || Boolean(userInfo?.isAdmin)
  );

  function toggle(key: string) {
    setExpanded((p) => ({ ...p, [key]: !p[key] }));
  }

  function openReport(label: string, reportId?: string) {
    if (!reportId) {
      setModal({ title: label }); // coming-soon mode
      return;
    }
    setModal({
      title: label,
      reportId,
      filter: REPORTS_CONFIG[reportId]?.filter,
    });
  }

  /* ─────────── DESKTOP SIDEBAR ─────────── */
  const W = open ? 232 : 64;

  const sidebar = (
    <aside
      className="sh-desktop"
      style={{
        width: W,
        minWidth: W,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        background: "#FCF7F3",
        borderRight: "1px solid #E4D6BF",
        flexShrink: 0,
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
          justifyContent: "center",
          padding: open ? "14px 14px 4px" : "14px 0 4px",
          flexShrink: 0,
        }}
      >
        <Image
          src="/millamirissa.png"
          alt="Mila Mirissa"
          width={160}
          height={160}
          priority
          style={{
            objectFit: "contain",
            width: open ? 108 : 38,
            height: "auto",
          }}
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
        {visibleNav.map((item) => {
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
                      ? `${item.children.length * 420}px`
                      : "0px",
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div style={{ paddingBottom: 4 }}>
                    {item.children.map((cat: Category) => {
                      const catExpanded = !!expanded[cat.key];
                      const hasActiveLeaf = cat.children.some(
                        (leaf) =>
                          leaf.reportId != null &&
                          pathname === `/reports/${leaf.reportId}`
                      );
                      return (
                        <div key={cat.key} className="sh-cat-block">
                          <button
                            className={`sh-cat-btn ${hasActiveLeaf ? "has-active" : ""}`}
                            onClick={() => toggle(cat.key)}
                          >
                            <span
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {cat.label}
                            </span>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                opacity: 0.65,
                                flexShrink: 0,
                              }}
                            >
                              {catExpanded ? <IChevDown /> : <IChevRight />}
                            </span>
                          </button>

                          {/* Leaves (clean text rows without document icons) */}
                          <div
                            className="sh-children"
                            style={{
                              maxHeight: catExpanded
                                ? `${cat.children.length * 42 + 12}px`
                                : "0px",
                              opacity: catExpanded ? 1 : 0,
                            }}
                          >
                            <div className="sh-leaf-list">
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
      {visibleNav.map((item) => {
        const active = item.path
          ? pathname.startsWith(item.path)
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
    <div style={{ display: "flex", minHeight: "100vh", background: "#FCF7F3" }}>
      <style>{SHELL_CSS}</style>

      {sidebar}
      {mobileNav}

      {/* White content area */}
      <main
        className="sh-main-body"
        style={{
          flex: 1,
          minWidth: 0,
          background: "#FCF7F3",
          color: "#45301D",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <UserBar user={userInfo} />
        {children}
      </main>

      {/* Date range modal */}
      <DateRangeModal
        open={modal != null}
        title={modal?.title ?? ""}
        linked={modal?.reportId != null}
        filter={modal?.filter}
        onClose={() => setModal(null)}
        onApply={(from, to, loc, extra) => {
          const id = modal?.reportId;
          setModal(null);
          if (id)
            router.push(
              `/reports/${id}?from=${from}&to=${to}${
                loc ? `&loc=${encodeURIComponent(loc)}` : ""
              }${
                extra && extra.value
                  ? `&${extra.param}=${encodeURIComponent(extra.value)}`
                  : ""
              }`
            );
        }}
      />
    </div>
  );
}
