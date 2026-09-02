"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

// --- Types ---
interface BillItem {
  name: string;
  price: number;
}

// --- Data ---
const billItems: BillItem[] = [
  { name: "Chicken Kottu Roti x 2", price: 1800.0 },
  { name: "Fish Ambulthiyal x 1", price: 1200.0 },
  { name: "Pol Sambol & Rice x 3", price: 2100.0 },
  { name: "King Coconut x 4", price: 800.0 },
  { name: "Watalappan x 2", price: 900.0 },
];

const subtotal = 6800.0;
const tax = 544.0;
const tip = 340.0;
const grandTotal = 7684.0;

// --- Promotions ---
const promotions = [
  {
    id: 1,
    badge: "🎁 Special Offer",
    title: "15% OFF",
    titleSub: "on your next visit!",
    desc: "Get an exclusive discount on your next dine-in. Valid for 30 days from today.",
    code: "CHEF15",
    codeLabel: "Code:",
    cta: "Claim Offer",
    color: "#FF8C00",
    bg: "rgba(255,140,0,0.08)",
    border: "rgba(255,140,0,0.25)",
  },
  {
    id: 2,
    badge: "🍰 Free Dessert",
    title: "Leave a Review",
    titleSub: "Get a free dessert!",
    desc: "Rate us 5 stars on Google and enjoy a complimentary dessert on your next visit!",
    code: "REVIEW5",
    codeLabel: "Code:",
    cta: "Leave a Google Review →",
    color: "#003D9B",
    bg: "rgba(0,61,155,0.06)",
    border: "rgba(0,61,155,0.2)",
    link: "https://google.com",
  },
  {
    id: 3,
    badge: "👨‍👩‍👧 Family Deal",
    title: "Rs. 500 OFF",
    titleSub: "on orders above Rs. 5000",
    desc: "Perfect for family dining! Get Rs. 500 off when you spend Rs. 5000 or more.",
    code: "FAMILY500",
    codeLabel: "Code:",
    cta: "Claim Offer",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.06)",
    border: "rgba(22,163,74,0.2)",
  },
];

// --- Promo Popup ---
function PromoPopup({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState(0);
  const [copying, setCopying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % promotions.length);
    }, 4000);
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const goTo = (idx: number) => {
    setCurrent(idx);
    startTimer();
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    });
  };

  const promo = promotions[current];

  return (
    <>
      <style>{`
        @keyframes progressBar {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes popupIn {
          0%   { opacity: 0; transform: scale(0.92) translateY(24px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(25,28,30,0.55)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          animation: "backdropIn 0.3s ease both",
        }}
      />

      {/* Modal wrapper */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
          pointerEvents: "none",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 460,
            background: "white",
            borderRadius: 18,
            boxShadow: "0 32px 80px rgba(0,0,0,0.22)",
            overflow: "hidden",
            position: "relative",
            pointerEvents: "auto",
            animation: "popupIn 0.45s cubic-bezier(0.34,1.3,0.64,1) both",
          }}
        >
          {/* Top color bar */}
          <div
            style={{
              height: 5,
              background: `linear-gradient(90deg, #003D9B 0%, ${promo.color} 100%)`,
              transition: "background 0.5s ease",
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              background: "rgba(67,70,84,0.09)",
              border: "none",
              borderRadius: 9999,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(67,70,84,0.18)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(67,70,84,0.09)")
            }
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1L11 11M11 1L1 11"
                stroke="#434654"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Content */}
          <div style={{ padding: "36px 40px 28px" }}>
            {/* Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: promo.bg,
                border: `1px solid ${promo.border}`,
                borderRadius: 9999,
                padding: "5px 14px",
                marginBottom: 18,
                transition: "all 0.4s ease",
              }}
            >
              <span
                style={{
                  color: promo.color,
                  fontSize: 12,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  letterSpacing: 0.4,
                }}
              >
                {promo.badge}
              </span>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 10 }}>
              <p
                style={{
                  color: promo.color,
                  fontSize: 42,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  lineHeight: "1.05",
                  margin: 0,
                  transition: "color 0.4s ease",
                }}
              >
                {promo.title}
              </p>
              <p
                style={{
                  color: "#191C1E",
                  fontSize: 17,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 600,
                  lineHeight: "26px",
                  margin: 0,
                }}
              >
                {promo.titleSub}
              </p>
            </div>

            {/* Description */}
            <p
              style={{
                color: "#434654",
                fontSize: 14,
                fontFamily: "Inter, sans-serif",
                fontWeight: 400,
                lineHeight: "22px",
                marginBottom: 20,
              }}
            >
              {promo.desc}
            </p>

            {/* Code row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(0,61,155,0.05)",
                border: "1px dashed rgba(0,61,155,0.18)",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 22,
              }}
            >
              <span
                style={{
                  color: "#434654",
                  fontSize: 12,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                }}
              >
                {promo.codeLabel}
              </span>
              <span
                style={{
                  color: "#003D9B",
                  fontSize: 16,
                  fontFamily: "'Courier New', monospace",
                  fontWeight: 800,
                  letterSpacing: 2,
                  flex: 1,
                }}
              >
                {promo.code}
              </span>
              <button
                onClick={() => handleCopy(promo.code)}
                style={{
                  background: copying ? "#16a34a" : "#003D9B",
                  border: "none",
                  borderRadius: 7,
                  padding: "5px 12px",
                  color: "white",
                  fontSize: 11,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.3s",
                  letterSpacing: 0.3,
                }}
              >
                {copying ? "✓ Copied!" : "Copy"}
              </button>
            </div>

            {/* CTA */}
            {promo.link ? (
              <a
                href={promo.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "100%",
                  padding: "15px",
                  background: promo.color,
                  borderRadius: 10,
                  border: "none",
                  color: "white",
                  fontSize: 14,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                  boxSizing: "border-box",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {promo.cta}
              </a>
            ) : (
              <button
                onClick={onClose}
                style={{
                  width: "100%",
                  padding: "15px",
                  background: promo.color,
                  borderRadius: 10,
                  border: "none",
                  color: "white",
                  fontSize: 14,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {promo.cta}
              </button>
            )}
          </div>

          {/* Slide dots */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              paddingBottom: 22,
            }}
          >
            {promotions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                style={{
                  width: idx === current ? 24 : 8,
                  height: 8,
                  borderRadius: 9999,
                  background: idx === current ? promo.color : "#C3C6D6",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.35s ease",
                }}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 3,
              background: "#F0F0F0",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              key={`${current}-progress`}
              style={{
                height: "100%",
                background: promo.color,
                animation: "progressBar 4s linear forwards",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// --- Promo Cards (below bill) ---
function PromoCards() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 672,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        marginTop: 32,
      }}
    >
      {/* Section title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: "#C3C6D6" }} />
        <p
          style={{
            color: "#434654",
            fontSize: 12,
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            letterSpacing: 1.2,
            whiteSpace: "nowrap",
            textTransform: "uppercase",
          }}
        >
          🎉 Exclusive Offers For You
        </p>
        <div style={{ flex: 1, height: 1, background: "#C3C6D6" }} />
      </div>

      {promotions.map((promo) => (
        <div
          key={promo.id}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.92)",
            borderRadius: 12,
            outline: "1px #EEEEEE solid",
            outlineOffset: -1,
            boxShadow: "0 4px 16px rgba(0,82,204,0.05)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex" }}>
            <div
              style={{ width: 5, background: promo.color, flexShrink: 0 }}
            />
            <div style={{ flex: 1, padding: "20px 24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      background: promo.bg,
                      border: `1px solid ${promo.border}`,
                      borderRadius: 9999,
                      padding: "3px 10px",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        color: promo.color,
                        fontSize: 11,
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 700,
                        letterSpacing: 0.3,
                      }}
                    >
                      {promo.badge}
                    </span>
                  </div>
                  <p
                    style={{
                      color: "#191C1E",
                      fontSize: 16,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      lineHeight: "22px",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: promo.color }}>{promo.title}</span>{" "}
                    {promo.titleSub}
                  </p>
                  <p
                    style={{
                      color: "#434654",
                      fontSize: 12,
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 400,
                      lineHeight: "18px",
                      marginBottom: 10,
                    }}
                  >
                    {promo.desc}
                  </p>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(0,61,155,0.05)",
                      border: "1px dashed rgba(0,61,155,0.15)",
                      borderRadius: 7,
                      padding: "4px 10px",
                    }}
                  >
                    <span
                      style={{
                        color: "#434654",
                        fontSize: 11,
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      {promo.codeLabel}
                    </span>
                    <span
                      style={{
                        color: "#003D9B",
                        fontSize: 13,
                        fontFamily: "'Courier New', monospace",
                        fontWeight: 800,
                        letterSpacing: 1.5,
                      }}
                    >
                      {promo.code}
                    </span>
                    <button
                      onClick={() => handleCopy(promo.code)}
                      style={{
                        background:
                          copied === promo.code ? "#16a34a" : "#003D9B",
                        border: "none",
                        borderRadius: 5,
                        padding: "2px 8px",
                        color: "white",
                        fontSize: 10,
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 0.3s",
                      }}
                    >
                      {copied === promo.code ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>

                {promo.link ? (
                  <a
                    href={promo.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 40,
                      paddingLeft: 16,
                      paddingRight: 16,
                      background: promo.color,
                      borderRadius: 8,
                      color: "white",
                      fontSize: 11,
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 700,
                      letterSpacing: 0.3,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      alignSelf: "flex-start",
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "0.88")
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    {promo.cta}
                  </a>
                ) : (
                  <button
                    style={{
                      height: 40,
                      paddingLeft: 16,
                      paddingRight: 16,
                      background: promo.color,
                      borderRadius: 8,
                      border: "none",
                      color: "white",
                      fontSize: 11,
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 700,
                      letterSpacing: 0.3,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      alignSelf: "flex-start",
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "0.88")
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    {promo.cta}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Page ---
export default function Home() {
  const [showPromo, setShowPromo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowPromo(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleDownload = () => window.print();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-only { display: block !important; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-up      { animation: fadeUp 0.55s ease both; }
        .anim-delay-1 { animation-delay: 0.1s; }
        .anim-delay-2 { animation-delay: 0.2s; }
        .dl-btn:hover  { background: rgba(0,61,155,0.06) !important; }
        .nav-lnk:hover { color: #003D9B !important; }
      `}</style>

      {showPromo && <PromoPopup onClose={() => setShowPromo(false)} />}

      {/* ── NAVBAR ── */}
      <nav
        className="no-print"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(255,255,255,0.95)",
          boxShadow: "0 1px 0 #EEEEEE",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1200,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 10,
            paddingBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image
              src="/CAPTURE 1.png"
              alt="MICROECHEF Logo"
              width={36}
              height={36}
              style={{ borderRadius: 8, objectFit: "contain" }}
              priority
            />
            <span
              style={{
                color: "#003D9B",
                fontSize: 20,
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                letterSpacing: 0.5,
              }}
            >
              MICROECHEF
            </span>
          </div>

          {/* Order badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                color: "#434654",
                fontSize: 13,
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              Order #MC-8492
            </span>
            <div
              style={{
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 4,
                paddingBottom: 4,
                background: "rgba(22,163,74,0.10)",
                borderRadius: 9999,
                border: "1px solid rgba(22,163,74,0.2)",
              }}
            >
              <span
                style={{
                  color: "#16a34a",
                  fontSize: 12,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                ✓ PAID
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* ── PAGE WRAPPER ── */}
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, #F0F4FF 0%, #F8F9FB 50%, #FFF8F0 100%)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 1,
            paddingLeft: 20,
            paddingRight: 20,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 712,
              paddingTop: 110,
              paddingBottom: 80,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* ── BILL CARD ── */}
            <div className="anim-up" style={{ width: "100%", maxWidth: 672 }}>
              <div
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.96)",
                  boxShadow:
                    "0 20px 60px rgba(0,61,155,0.10), 0 4px 16px rgba(0,0,0,0.04)",
                  borderRadius: 16,
                  outline: "1px #EEEEEE solid",
                  outlineOffset: -1,
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  overflow: "hidden",
                }}
              >
                {/* Top accent bar */}
                <div
                  style={{
                    height: 5,
                    background:
                      "linear-gradient(90deg, #003D9B 0%, #0066FF 50%, #FF8C00 100%)",
                  }}
                />

                <div
                  style={{
                    padding: "40px 44px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                  }}
                >
                  {/* Bill Header */}
                  <div
                    style={{
                      paddingBottom: 24,
                      borderBottom: "1px solid #EEEEEE",
                      marginBottom: 24,
                      textAlign: "center",
                    }}
                  >
                    {/* Restaurant Icon */}
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        margin: "0 auto 16px",
                        borderRadius: 14,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(0,61,155,0.15)",
                      }}
                    >
                      <Image
                        src="/CAPTURE 1.png"
                        alt="MICROECHEF"
                        width={52}
                        height={52}
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                    <p
                      style={{
                        color: "#003D9B",
                        fontSize: 13,
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 700,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      MICROECHEF
                    </p>
                    <p
                      style={{
                        color: "#191C1E",
                        fontSize: 26,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        lineHeight: "1.3",
                        marginBottom: 8,
                      }}
                    >
                      Your Bill
                    </p>
                    <p
                      style={{
                        color: "#434654",
                        fontSize: 12,
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 500,
                        lineHeight: "16.8px",
                      }}
                    >
                      Table 12 &bull; Server: Nimal &bull; Oct 24, 2025
                    </p>
                  </div>

                  {/* Items */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      paddingBottom: 24,
                      borderBottom: "1px dashed #DDDDDD",
                      marginBottom: 20,
                    }}
                  >
                    {billItems.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 0",
                        }}
                      >
                        <p
                          style={{
                            color: "#191C1E",
                            fontSize: 14.5,
                            fontFamily: "Inter, sans-serif",
                            fontWeight: 400,
                            lineHeight: "24px",
                          }}
                        >
                          {item.name}
                        </p>
                        <p
                          style={{
                            color: "#191C1E",
                            fontSize: 14.5,
                            fontFamily: "'Courier New', monospace",
                            fontWeight: 600,
                            lineHeight: "24px",
                          }}
                        >
                          Rs.{" "}
                          {item.price.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {[
                      { label: "Subtotal", value: subtotal },
                      { label: "Tax (8%)", value: tax },
                      { label: "Tip", value: tip },
                    ].map((row) => (
                      <div
                        key={row.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <p
                          style={{
                            color: "#434654",
                            fontSize: 14,
                            fontFamily: "Inter, sans-serif",
                            fontWeight: 400,
                            lineHeight: "25.6px",
                          }}
                        >
                          {row.label}
                        </p>
                        <p
                          style={{
                            color: "#434654",
                            fontSize: 14,
                            fontFamily: "'Courier New', monospace",
                            fontWeight: 400,
                            lineHeight: "25.6px",
                          }}
                        >
                          Rs.{" "}
                          {row.value.toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    ))}

                    {/* Grand Total */}
                    <div
                      style={{
                        marginTop: 12,
                        padding: "20px 20px",
                        background:
                          "linear-gradient(135deg, rgba(0,61,155,0.05) 0%, rgba(0,102,255,0.04) 100%)",
                        borderRadius: 12,
                        border: "1px solid rgba(0,61,155,0.1)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <p
                        style={{
                          color: "#191C1E",
                          fontSize: 20,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          lineHeight: "33.6px",
                        }}
                      >
                        Grand Total
                      </p>
                      <p
                        style={{
                          color: "#003D9B",
                          fontSize: 22,
                          fontFamily: "'Courier New', monospace",
                          fontWeight: 800,
                          lineHeight: "33.6px",
                        }}
                      >
                        Rs.{" "}
                        {grandTotal.toLocaleString("en-LK", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Download Button */}
                  <div
                    className="no-print"
                    style={{
                      marginTop: 28,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <button
                      onClick={handleDownload}
                      style={{
                        height: 50,
                        paddingLeft: 32,
                        paddingRight: 32,
                        borderRadius: 10,
                        background:
                          "linear-gradient(135deg, #003D9B 0%, #0052CC 100%)",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        transition: "opacity 0.2s",
                        boxShadow: "0 4px 16px rgba(0,61,155,0.3)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "0.88")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="7,10 12,15 17,10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span
                        style={{
                          color: "white",
                          fontSize: 14,
                          fontFamily: "Inter, sans-serif",
                          fontWeight: 600,
                          letterSpacing: 0.5,
                        }}
                      >
                        Download PDF Bill
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── PROMO CARDS ── */}
            <div
              className="anim-up anim-delay-1 no-print"
              style={{ width: "100%", maxWidth: 672 }}
            >
              <PromoCards />
            </div>

            {/* Thank You Message */}
            <div
              className="anim-up anim-delay-2 no-print"
              style={{
                width: "100%",
                maxWidth: 672,
                marginTop: 56,
                background: "rgba(255,255,255,0.92)",
                borderRadius: 14,
                outline: "1px #EEEEEE solid",
                outlineOffset: -1,
                boxShadow: "0 10px 40px rgba(0,82,204,0.07)",
                padding: "40px 44px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: "rgba(0,61,155,0.10)",
                  borderRadius: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                    fill="#003D9B"
                  />
                </svg>
              </div>
              <p
                style={{
                  color: "#191C1E",
                  fontSize: 22,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                Thank You for Dining With Us! 🎉
              </p>
              <p
                style={{
                  color: "#434654",
                  fontSize: 14,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 400,
                  lineHeight: "22px",
                  marginBottom: 8,
                }}
              >
                We hope you enjoyed your meal at MICROECHEF. We look forward to
                serving you again soon!
              </p>
              <p
                style={{
                  color: "#9496A1",
                  fontSize: 12,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  lineHeight: "18px",
                }}
              >
                Don't forget to use your exclusive discount codes on your next
                visit.
              </p>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer
          className="no-print"
          style={{
            paddingLeft: 20,
            paddingRight: 20,
            display: "flex",
            justifyContent: "center",
            background: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1160,
              paddingTop: 32,
              paddingBottom: 32,
              borderTop: "1px solid #EEEEEE",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            {/* Brand */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Image
                  src="/CAPTURE 1.png"
                  alt="MICROECHEF"
                  width={24}
                  height={24}
                  style={{ borderRadius: 6, objectFit: "contain" }}
                />
                <span
                  style={{
                    color: "#003D9B",
                    fontSize: 14,
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    letterSpacing: 0.5,
                  }}
                >
                  MICROECHEF
                </span>
              </div>
              <span
                style={{
                  color: "#9496A1",
                  fontSize: 11,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                }}
              >
                © 2026 MICROECHEF. All rights reserved.
              </span>
            </div>

            {/* Links */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <a
                href="tel:+94112345678"
                className="nav-lnk"
                style={{
                  color: "#434654",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012.18 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.15a16 16 0 006.29 6.29l1.42-1.42a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
                Contact Us
              </a>

              <a
                href="#"
                className="nav-lnk"
                style={{
                  color: "#434654",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
              >
                Privacy Policy
              </a>

              <a
                href="#"
                className="nav-lnk"
                style={{
                  color: "#434654",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
              >
                Terms of Service
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}