"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { getBillTotalRows, STATUS_META, RESTAURANT_INFO, statusReceiptWord, type Bill } from "@/lib/billFormat";

// --- Promotions Data ---
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
    link: undefined as string | undefined,
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
    link: undefined as string | undefined,
  },
];

// =============================================
// PROMO POPUP
// =============================================
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

      {/* Modal */}
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

          {/* Close Button */}
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

            {/* Code Row */}
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
                onMouseEnter={(e) =>
                  (e.currentTarget.style.opacity = "0.88")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.opacity = "1")
                }
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
                onMouseEnter={(e) =>
                  (e.currentTarget.style.opacity = "0.88")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.opacity = "1")
                }
              >
                {promo.cta}
              </button>
            )}
          </div>

          {/* Dots */}
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

          {/* Progress Bar */}
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

// =============================================
// PROMO CARDS
// =============================================
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
      {/* Section Title */}
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
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "1")
                    }
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
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "1")
                    }
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

function PDFDownloadButton({ bill }: { bill: Bill }) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePDFDownload = async () => {
    setPdfLoading(true);
    try {
      const ReactPDF = await import("@react-pdf/renderer");
      const { BillPDFDocument } = await import("@/lib/BillPDF");

      const blob = await ReactPDF.pdf(<BillPDFDocument bill={bill} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `eReceipt-${bill.billNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF eka hadanna beri una. Aye try karanna.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <button
      onClick={handlePDFDownload}
      disabled={pdfLoading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "13px 24px",
        background: "#1a1a1a",
        color: "#ffffff",
        border: "none",
        borderRadius: 8,
        fontFamily: "'Courier New', ui-monospace, monospace",
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: 0.5,
        cursor: pdfLoading ? "wait" : "pointer",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      {pdfLoading ? "Preparing PDF..." : "\u2B07 Download eReceipt (PDF)"}
    </button>
  );
}

const MONO =
  '"Courier New", ui-monospace, SFMono-Regular, Menlo, monospace';

const INK = "#1a1a1a";
const INK_SOFT = "#555555";
const DASH_C = "#2b2b2b";

const fmtAmt = (n: number) =>
  n.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function Dashed() {
  return (
    <div
      style={{
        borderTop: `1.5px dashed ${DASH_C}`,
        margin: "14px 0",
      }}
    />
  );
}

// =============================================
// COFFEE LOADER (spinning cup animation)
// =============================================
const COFFEE_CSS = `
  .coffee {
    --coffee-bg: #e9e9ee;
    --coffee-fg: #1a1a1a;
    font-size: 0.6em;
    position: relative;
    width: 21.5em;
    height: 9em;
  }
  .coffee:before {
    border-bottom: 0.25em dashed var(--coffee-fg);
    content: "";
    display: block;
    position: absolute;
    top: 7.5em;
    width: 100%;
  }
  .coffee__cup,
  .coffee__cup-part,
  .coffee__cup-handle,
  .coffee__steam-part {
    animation-duration: 8s;
    animation-iteration-count: infinite;
  }
  .coffee__cup,
  .coffee__cup-part,
  .coffee__cup-handle {
    animation-timing-function: cubic-bezier(0.9,0,0.1,1);
  }
  .coffee__cup {
    animation-name: coffee-cup;
    position: relative;
    width: 11.25em;
    height: 9em;
  }
  .coffee__cup-part {
    background-color: var(--coffee-bg);
    position: absolute;
  }
  .coffee__cup-part--a {
    animation-name: coffee-cup-part-a;
    border-radius: 5.625em 5.625em 5.625em 5.625em / 2em 2em 2.7em 2.7em;
    box-shadow: 0 0 0 0.3em var(--coffee-fg) inset;
    top: 4.3em;
    width: 11.25em;
    height: 4.7em;
  }
  .coffee__cup-part--b {
    animation-name: coffee-cup-part-b;
    background-color: transparent;
    border-radius: 5.625em / 2em;
    box-shadow: 0 0 0 0.2em var(--coffee-fg) inset;
    top: 4.3em;
    width: 11.25em;
    height: 4em;
  }
  .coffee__cup-part--c {
    animation-name: coffee-cup-part-c;
    border-radius: 1.7em / 0.45em;
    box-shadow: 0 0 0 0.2em var(--coffee-fg) inset;
    top: 7.1em;
    left: 3.925em;
    width: 3.4em;
    height: 0.9em;
  }
  .coffee__cup-part--d,
  .coffee__cup-part--e,
  .coffee__cup-part--f {
    z-index: 1;
  }
  .coffee__cup-part--d {
    animation-name: coffee-cup-part-d;
    border-radius: 3.6em 3.6em 3.3em 3.3em / 1em 1em 3.5em 3.5em;
    box-shadow: 0 0 0 0.2em var(--coffee-fg) inset;
    top: 2.55em;
    left: 2.025em;
    width: 7.2em;
    height: 5.15em;
  }
  .coffee__cup-part--e {
    animation-name: coffee-cup-part-e;
    background-color: var(--coffee-fg);
    box-shadow:
      0 0 0 0.2em var(--coffee-fg) inset,
      0 1em 0 var(--coffee-bg) inset;
    border-radius: 3.5em / 1em;
    top: 2.65em;
    left: 2.125em;
    width: 7em;
    height: 2em;
  }
  .coffee__cup-part--f {
    animation-name: coffee-cup-part-f;
    background-color: transparent;
    color: var(--coffee-fg);
    top: 4.1em;
    left: 5.925em;
    width: 4.8em;
    height: 3em;
  }
  .coffee__cup-handle {
    animation-name: coffee-cup-handle;
  }
  .coffee__cup,
  .coffee__steam {
    transform: translateX(-50%);
  }
  .coffee__steam {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 3.5em;
    height: 3.5em;
    color: var(--coffee-fg);
  }
  .coffee__steam--right {
    right: 0;
    left: auto;
    transform: translateX(50%);
  }
  .coffee__steam-part {
    animation-name: coffee-steam-left;
    animation-timing-function: linear;
    stroke-dashoffset: 48;
  }
  .coffee__steam--right .coffee__steam-part {
    animation-name: coffee-steam-right;
    stroke-dashoffset: 35;
  }
  .coffee__steam-part--a { stroke-dasharray: 24 142; }
  .coffee__steam-part--b { stroke-dasharray: 30 8 10 130; }
  .coffee__steam-part--c { stroke-dasharray: 15 6 1 134; }
  .coffee__steam-part--d { stroke-dasharray: 18 6 1 90; }
  .coffee__steam-part--e { stroke-dasharray: 25 6 4 76; }

  @keyframes coffee-cup {
    from, 25%, 75%, to { left: 0; }
    50% { left: 21.5em; }
  }
  @keyframes coffee-cup-part-a {
    from, 50%, to { width: 11.25em; }
    25%, 75% { width: calc(11.25em + 21.5em); }
  }
  @keyframes coffee-cup-part-b {
    from, 50%, to { width: 11.25em; }
    25%, 75% { width: calc(11.25em + 21.5em); }
  }
  @keyframes coffee-cup-part-c {
    from, 50%, to { width: 3.4em; }
    25%, 75% { width: calc(3.4em + 21.5em); }
  }
  @keyframes coffee-cup-part-d {
    from, 50%, to { width: 7.2em; }
    25%, 75% { width: calc(7.2em + 21.5em); }
  }
  @keyframes coffee-cup-part-e {
    from, 50%, to {
      box-shadow: 0 0 0 0.2em var(--coffee-fg) inset, 0 1em 0 var(--coffee-bg) inset;
      width: 7em;
    }
    25%, 75% {
      box-shadow: 0 0 0 0.2em var(--coffee-fg) inset, 0 1.5em 0 var(--coffee-bg) inset;
      width: calc(7em + 21.5em);
    }
  }
  @keyframes coffee-cup-part-f {
    from { left: 5.925em; z-index: 0; }
    25% { left: calc(5.925em + 8.35em); z-index: 0; }
    50% { left: 0.525em; z-index: 0; }
    50.01% { left: 0.525em; z-index: 1; }
    75% { left: calc(5.925em + 8.35em); z-index: 1; }
    to { left: 5.925em; z-index: 1; }
  }
  @keyframes coffee-cup-handle {
    from, to {
      animation-timing-function: ease-in;
      d: path("M64,4.413s6.64-2.913,11-2.913c11.739,0,19.5,10.759,19.5,22.497,0,23.475-45,22.497-45,22.497");
      transform: translate(0,0);
    }
    10%, 40%, 60%, 90% {
      animation-timing-function: ease-out;
      d: path("M48.036,4.415s-.03-2.913-.049-2.913c-.052,0-.087,10.759-.087,22.497,0,23.475,.2,22.497,.2,22.497");
      transform: translate(0,15px);
    }
    50% {
      animation-timing-function: ease-in;
      d: path("M32,4.413s-6.64-2.913-11-2.913C9.261,1.5,1.5,12.259,1.5,23.997c0,23.475,45,22.497,45,22.497");
      transform: translate(0,0);
    }
  }
  @keyframes coffee-steam-left {
    from { stroke-dashoffset: 48; }
    25%, to { stroke-dashoffset: -66; }
  }
  @keyframes coffee-steam-right {
    from, 50% { stroke-dashoffset: 35; }
    75%, to { stroke-dashoffset: -76; }
  }
`;

function CoffeeLoader() {
  return (
    <div className="coffee" role="img" aria-label="Coffee cup loading animation">
      <style>{COFFEE_CSS}</style>
      <div className="coffee__cup">
        <div className="coffee__cup-part coffee__cup-part--a"></div>
        <div className="coffee__cup-part coffee__cup-part--b"></div>
        <div className="coffee__cup-part coffee__cup-part--c"></div>
        <div className="coffee__cup-part coffee__cup-part--d"></div>
        <div className="coffee__cup-part coffee__cup-part--e"></div>
        <svg
          className="coffee__cup-part coffee__cup-part--f"
          width="96px"
          height="60px"
          viewBox="0 0 96 60"
          aria-hidden="true"
        >
          <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path
              className="coffee__cup-handle"
              d="M64,4.413s6.64-2.913,11-2.913c11.739,0,19.5,10.759,19.5,22.497,0,23.475-45,22.497-45,22.497"
            />
          </g>
        </svg>
      </div>
      <svg className="coffee__steam" width="56px" height="56px" viewBox="0 0 56 56" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path
            className="coffee__steam-part coffee__steam-part--a"
            d="M13.845,54s-5.62-10.115-4.496-16.859,6.83-11.497,8.992-17.983c1.037-3.11,.161-6.937-1.083-10.158"
          />
          <path
            className="coffee__steam-part coffee__steam-part--b"
            d="M27.844,54s-5.652-10.174-4.522-16.957,6.869-11.564,9.043-18.087c2.261-6.783-4.522-16.957-4.522-16.957"
          />
          <path
            className="coffee__steam-part coffee__steam-part--c"
            d="M40.434,50.999c-1.577-3.486-3.818-9.462-3.071-13.944,1.121-6.723,6.809-11.462,8.964-17.928,1.033-3.1,.161-6.916-1.08-10.127"
          />
        </g>
      </svg>
      <svg
        className="coffee__steam coffee__steam--right"
        width="56px"
        height="56px"
        viewBox="0 0 56 56"
        aria-hidden="true"
      >
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path
            className="coffee__steam-part coffee__steam-part--d"
            d="M19.845,54s-5.62-10.115-4.496-16.859,6.83-11.497,8.992-17.983c1.037-3.11,.161-6.937-1.083-10.158"
          />
          <path
            className="coffee__steam-part coffee__steam-part--e"
            d="M34.434,44c-1.577-3.486-3.818-9.462-3.071-13.944,1.121-6.723,6.809-11.462,8.964-17.928,1.033-3.1,.161-6.916-1.08-10.127"
          />
        </g>
      </svg>
    </div>
  );
}

function ReceiptLoader({ text }: { text: string }) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#e9e9ee",
        fontFamily: MONO,
        overflow: "hidden",
      }}
    >
      <CoffeeLoader />
      <p style={{ marginTop: 24, color: "#333", fontSize: 14, fontWeight: 600 }}>
        {text}
      </p>
    </div>
  );
}

function BillContent() {
  const searchParams = useSearchParams();
  const [bill, setBill] = useState<Bill | null>(null);
  const MIN_DELAY = 1500;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPromo, setShowPromo] = useState(false);

  useEffect(() => {
    const encryptedId = searchParams.get("id");

    if (!encryptedId) {
      setError("No bill ID provided in URL");
      setLoading(false);
      return;
    }

   Promise.all([
  fetch(`/api/bill?id=${encryptedId}`).then((res) => res.json()),
  new Promise((r) => setTimeout(r, 1500)), // ← minimum loading time (ms)
])
  .then(([data]) => {
    if (data.success && data.bill) {
      setBill(data.bill);
      setTimeout(() => setShowPromo(true), 800);
    } else {
      setError(data.error || "Bill not found");
    }
  })
      .catch((err) => {
        console.error("Error fetching bill:", err);
        setError("Failed to load bill");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams]);

  if (loading) {
    return <ReceiptLoader text="Loading your bill..." />;
  }

  if (error || !bill) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#e9e9ee",
          padding: 20,
          fontFamily: MONO,
        }}
      >
        <div
          style={{
            background: "#fff",
            border: `1.5px dashed ${DASH_C}`,
            borderRadius: 8,
            padding: "28px 26px",
            maxWidth: 380,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: INK,
              margin: 0,
            }}
          >
            {error || "Bill not found"}
          </p>
          <p
            style={{
              fontSize: 12.5,
              color: INK_SOFT,
              lineHeight: "20px",
              margin: "10px 0 0",
            }}
          >
            Please contact the restaurant if you believe this link is valid.
          </p>
        </div>
      </div>
    );
  }

  const isTakeaway = bill.orderMode?.toUpperCase() === "TA";
  const boxLabel = isTakeaway
    ? (bill.orderModeDes || "TAKE AWAY").toUpperCase()
    : `TBL : ${bill.tableName}`;
  const showModeLine =
    bill.orderModeDes && !isTakeaway ? bill.orderModeDes : null;

  return (
    <>
      {showPromo && <PromoPopup onClose={() => setShowPromo(false)} />}

      {/* PAGE WRAPPER */}
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          background: "#e9e9ee",
          padding: "30px 12px 60px",
          fontFamily: MONO,
        }}
      >
        {/* RECEIPT CARD */}
        <div
          style={{
            maxWidth: 400,
            margin: "0 auto",
            background: "#fff",
            padding: "28px 22px 30px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
          }}
        >
          {/* ── Restaurant header ── */}
          <div style={{ textAlign: "center" }}>
            <Image
              src={RESTAURANT_INFO.logoPath}
              alt={RESTAURANT_INFO.name}
              width={150}
              height={75}
              style={{
                objectFit: "contain",
                margin: "0 auto 14px",
                display: "block",
              }}
            />
            <h1
              style={{
                margin: 0,
                fontSize: 21,
                fontWeight: 700,
                color: INK,
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}
            >
              {RESTAURANT_INFO.name}
            </h1>
            {RESTAURANT_INFO.city && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: INK,
                }}
              >
                {RESTAURANT_INFO.city}
              </p>
            )}
            {RESTAURANT_INFO.addressLines.map((line) => (
              <p
                key={line}
                style={{
                  margin: "2px 0 0",
                  fontSize: 12.5,
                  color: INK,
                }}
              >
                {line}
              </p>
            ))}
            {bill.locationName && (
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  fontWeight: 700,
                  color: INK,
                }}
              >
                {bill.locationName}
              </p>
            )}
          </div>

          <Dashed />

          {/* ── TBL / TAKEAWAY box ── */}
          <div
            style={{
              border: `1.5px dashed ${DASH_C}`,
              borderRadius: 6,
              padding: "10px 12px",
              textAlign: "center",
              margin: "16px 0",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: 1,
              color: INK,
            }}
          >
            {boxLabel}
          </div>

          <Dashed />

          {/* ── Meta block ── */}
          <div style={{ fontSize: 12.5, color: INK }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 6,
              }}
            >
              <span>
                <b>INV:</b> {bill.billNumber}
              </span>
              <span>
                <b>STS:</b> {statusReceiptWord(bill.status)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 6,
              }}
            >
              <span>
                <b>DAT:</b> {bill.date}
              </span>
              {bill.time && (
                <span>
                  <b>TIM:</b> {bill.time}
                </span>
              )}
            </div>
            {bill.noOfPax != null && bill.noOfPax > 0 && (
              <div style={{ marginBottom: 6 }}>
                <b>PAX:</b> {bill.noOfPax}
              </div>
            )}
            {showModeLine && (
              <div style={{ marginBottom: 6 }}>
                <b>Mode:</b> {showModeLine}
              </div>
            )}

            {/* Steward / Cashier / Customer */}
            {bill.stewardName && (
              <div style={{ marginBottom: 6 }}>
                <b>Steward:</b> {bill.stewardName}
              </div>
            )}
            {bill.cashierName && (
              <div style={{ marginBottom: 6 }}>
                <b>Cashier:</b> {bill.cashierName}
              </div>
            )}
            {!bill.stewardName && !bill.cashierName && bill.serverName && (
              <div style={{ marginBottom: 6 }}>
                <b>Server:</b> {bill.serverName}
              </div>
            )}
            {(bill.customerName || bill.customerPhone) && (
              <div style={{ marginBottom: 6, wordBreak: "break-word" }}>
                <b>Customer:</b>
                {bill.customerName ? ` ${bill.customerName}` : ""}{" "}
                {bill.customerPhone && (
                  <a
                    href={`tel:${bill.customerPhone}`}
                    style={{ color: "#1a0dab" }}
                  >
                    ({bill.customerPhone})
                  </a>
                )}
              </div>
            )}
          </div>

          <Dashed />

          {/* ── Items header ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: 12.5,
              letterSpacing: 0.5,
              color: INK,
              marginBottom: 12,
            }}
          >
            <span>DESCRIPTION</span>
            <span>AMOUNT</span>
          </div>

          {/* ── Items ── */}
          <div
            style={{
              paddingBottom: 4,
            }}
          >
            {bill.items.map((item, idx) => (
              <div key={idx} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13.5,
                      color: INK,
                      lineHeight: "19px",
                    }}
                  >
                    {item.name}
                  </span>
                  <span
                    style={{
                      fontSize: 13.5,
                      color: INK,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtAmt(item.price)}
                  </span>
                </div>
                {item.unitPrice != null && item.qty != null && (
                  <div
                    style={{
                      color: INK_SOFT,
                      fontSize: 11.5,
                      marginTop: 2,
                    }}
                  >
                    {item.qty} x Rs. {fmtAmt(item.unitPrice)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Dashed />

          {/* ── Totals breakdown ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            {getBillTotalRows(bill).map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: INK,
                }}
              >
                <span>{row.label}</span>
                <span>{fmtAmt(row.value)}</span>
              </div>
            ))}
          </div>

          {/* ── Grand total ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: 15.5,
              color: INK,
              marginTop: 12,
              paddingTop: 10,
              borderTop: `1.5px dashed ${DASH_C}`,
            }}
          >
            <span>GRAND TOTAL</span>
            <span>Rs. {fmtAmt(bill.grandTotal)}</span>
          </div>

          {/* ── Payments ── */}
          {bill.payments && bill.payments.length > 0 && (
            <p
              style={{
                margin: "12px 0 0",
                textAlign: "center",
                color: INK_SOFT,
                fontSize: 11.5,
                lineHeight: "18px",
              }}
            >
              Paid via{" "}
              {bill.payments
                .map((p) => `${p.method} (Rs. ${fmtAmt(p.amount)})`)
                .join(", ")}
            </p>
          )}

          <p
            style={{
              margin: "16px 0 0",
              textAlign: "center",
              color: INK_SOFT,
              fontSize: 11.5,
            }}
          >
            Thank you for dining with {RESTAURANT_INFO.name}!
          </p>

          {/* ── PDF download ── */}
          <div
            className="no-print"
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <PDFDownloadButton bill={bill} />
          </div>
        </div>

        {/* ── Promotions ── */}
        <div style={{ maxWidth: 420, margin: "26px auto 0" }}>
          <PromoCards />
        </div>
      </div>
    </>
  );
}


export default function BillPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            width: "100%",
            minHeight: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background:
              "linear-gradient(135deg, #F0F4FF 0%, #F8F9FB 50%, #FFF8F0 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CoffeeLoader />
            <p
              style={{
                marginTop: 24,
                color: "#333",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'Courier New', ui-monospace, monospace",
              }}
            >
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <BillContent />
    </Suspense>
  );
}