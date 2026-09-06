"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import MicroChefLoader from "@/components/MicroChefLoader";
import CupMascot from "@/components/CupMascot";
import { QRCodeSVG } from "qrcode.react";

import {
  getBillTotalRows,
  STATUS_META,
  RESTAURANT_INFO,
  statusReceiptWord,
  type Bill,
} from "@/lib/billFormat";

// =============================================
// WAVE BACKGROUND (UPDATED - only 2 waves)
// =============================================
function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Wave 1 - Top (Light Blue)
      ctx.beginPath();
      ctx.moveTo(0, H * 0.28);
      ctx.bezierCurveTo(W * 0.12, H * 0.12, W * 0.28, H * 0.22, W * 0.42, H * 0.32);
      ctx.bezierCurveTo(W * 0.58, H * 0.44, W * 0.68, H * 0.52, W * 0.72, H * 0.48);
      ctx.bezierCurveTo(W * 0.8, H * 0.42, W * 0.9, H * 0.3, W, H * 0.38);
      ctx.lineTo(W, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fillStyle = "#d4e6ff";
      ctx.fill();

      // Wave 2 - Bottom (Light Yellow)
      ctx.beginPath();
      ctx.moveTo(0, H * 0.55);
      ctx.bezierCurveTo(W * 0.15, H * 0.45, W * 0.32, H * 0.62, W * 0.5, H * 0.52);
      ctx.bezierCurveTo(W * 0.65, H * 0.44, W * 0.78, H * 0.35, W, H * 0.5);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = "#f1ddc9";
      ctx.fill();
    }

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        display: "block",
      }}
    />
  );
}

// =============================================
// PROMOTIONS DATA
// =============================================
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
          <div
            style={{
              height: 5,
              background: `linear-gradient(90deg, #003D9B 0%, ${promo.color} 100%)`,
              transition: "background 0.5s ease",
            }}
          />

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

          <div style={{ padding: "36px 40px 28px" }}>
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
            <div style={{ width: 5, background: promo.color, flexShrink: 0 }} />
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

// =============================================
// PDF DOWNLOAD BUTTON
// =============================================
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
        fontFamily: SANS,
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: 0.5,
        cursor: pdfLoading ? "wait" : "pointer",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      {pdfLoading ? "Preparing PDF..." : "⬇ Download eReceipt (PDF)"}
    </button>
  );
}

// =============================================
// CONSTANTS
// =============================================
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
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
    <div style={{ borderTop: `1.5px dashed ${DASH_C}`, margin: "14px 0" }} />
  );
}

// =============================================
// RECEIPT LOADER
// =============================================
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
        fontFamily: SANS,
        overflow: "hidden",
      }}
    >
      <MicroChefLoader />
      <p style={{ marginTop: 24, color: "#333", fontSize: 14, fontWeight: 600 }}>
        {text}
      </p>
    </div>
  );
}

// =============================================
// BILL CONTENT
// =============================================
function BillContent() {
  const searchParams = useSearchParams();
  const [bill, setBill] = useState<Bill | null>(null);
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

    fetch(`/api/bill?id=${encryptedId}`)
      .then((res) => res.json())
      .then((data) => {
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
      .finally(() => setLoading(false));
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
          padding: 20,
          fontFamily: SANS,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <CupMascot width={300} />
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: INK,
              margin: "18px 0 0",
            }}
          >
            {error || "Bill not found"}
          </p>
          <p
            style={{
              fontSize: 12.5,
              color: INK_SOFT,
              lineHeight: 1.4,
              margin: "8px 0 0",
            }}
          >
            Please contact the restaurant if you believe this link is valid.
          </p>
          <a
            href={`https://wa.me/94772336233?text=${encodeURIComponent(
              "Hi, I can't open my bill. Please help."
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 18,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 20px",
              background: "#16a34a",
              color: "#ffffff",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </svg>
            WhatsApp 077 233 6233
          </a>
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

      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          background: "transparent",
          padding: "30px 12px 60px",
          fontFamily: SANS,
        }}
      >
        <div
          style={{
            maxWidth: 400,
            margin: "0 auto",
            background: "#fff",
            padding: "28px 22px 30px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
            lineHeight: 1.35,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Image
              src={RESTAURANT_INFO.logoPath}
              alt={RESTAURANT_INFO.name}
              width={150}
              height={75}
              style={{
                objectFit: "contain",
                margin: "0 auto 6px",
                display: "block",
              }}
            />
            <h1
              style={{
                margin: 0,
                fontSize: 21,
                fontWeight: 700,
                color: INK,
                letterSpacing: 0.3,
              }}
            >
              {RESTAURANT_INFO.name}
            </h1>
            {RESTAURANT_INFO.city && (
              <p style={{ margin: "4px 0 0", fontSize: 13, color: INK }}>
                {RESTAURANT_INFO.city}
              </p>
            )}
            {RESTAURANT_INFO.addressLines.map((line) => (
              <p key={line} style={{ margin: "2px 0 0", fontSize: 12.5, color: INK }}>
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

          <div
            style={{ borderTop: `1.5px dashed ${DASH_C}`, margin: "8px 0 0" }}
          />

          <div
            style={{
              border: `1.5px dashed ${DASH_C}`,
              borderRadius: 6,
              padding: "9px 12px",
              textAlign: "center",
              margin: "8px 0",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: 1,
              color: INK,
            }}
          >
            {boxLabel}
          </div>

          <div
            style={{ borderTop: `1.5px dashed ${DASH_C}`, margin: "0 0 8px" }}
          />

          <div
            style={{
              fontSize: 12.5,
              color: INK,
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                alignItems: "flex-start",
              }}
            >
              <span>
                <b>INV:</b> {bill.billNumber}
              </span>
              <span>
                <b>Date:</b> {bill.date}
              </span>
              {bill.stewardName && (
                <span>
                  <b>Steward:</b> {bill.stewardName}
                </span>
              )}
              {bill.cashierName && (
                <span>
                  <b>Cashier:</b> {bill.cashierName}
                </span>
              )}
              {!bill.stewardName && !bill.cashierName && bill.serverName && (
                <span>
                  <b>Server:</b> {bill.serverName}
                </span>
              )}
              {(bill.customerName || bill.customerPhone) && (
                <span style={{ wordBreak: "break-word" }}>
                  <b>Customer:</b>
                  {bill.customerName ? ` ${bill.customerName}` : ""}{" "}
                  {bill.customerPhone && (
                    <a href={`tel:${bill.customerPhone}`} style={{ color: "#1a0dab" }}>
                      ({bill.customerPhone})
                    </a>
                  )}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                alignItems: "flex-end",
                textAlign: "right",
              }}
            >
              <span>
                <b>STS:</b> {statusReceiptWord(bill.status)}
              </span>
              {bill.time && (
                <span>
                  <b>Time:</b> {bill.time}
                </span>
              )}
              {showModeLine && (
                <span>
                  <b>Mode:</b> {showModeLine}
                </span>
              )}
              {bill.noOfPax != null && bill.noOfPax > 0 && (
                <span>
                  <b>PAX:</b> {bill.noOfPax}
                </span>
              )}
            </div>
          </div>

          <Dashed />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: 12.5,
              letterSpacing: 0.5,
              color: INK,
              padding: "7px 10px",
              background: "#f7f6f0",
              borderTop: "1px solid #e5e3da",
              borderBottom: "1px solid #e5e3da",
              borderRadius: 4,
              marginBottom: 12,
            }}
          >
            <span>DESCRIPTION</span>
            <span>AMOUNT</span>
          </div>

          <div style={{ paddingBottom: 4 }}>
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
                      lineHeight: 1.2,
                    }}
                  >
                    {item.name}
                  </span>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
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
                      fontStyle: "italic",
                      fontWeight: 400,
                      marginTop: 3,
                    }}
                  >
                    {item.qty} × Rs. {fmtAmt(item.unitPrice)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Dashed />

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
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
                <span
                  style={
                    row.label === "Gross Total" ? { fontWeight: 700 } : undefined
                  }
                >
                  {row.label}
                </span>
                <span style={{ fontWeight: row.label === "Gross Total" ? 700 : 500 }}>
                  {fmtAmt(row.value)}
                </span>
              </div>
            ))}
          </div>

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
            <span>NET TOTAL</span>
            <span>Rs. {fmtAmt(bill.grandTotal)}</span>
          </div>

          {bill.payments && bill.payments.length > 0 && (
            <div
              style={{
                margin: "20px 0 0",
                padding: "13px 0",
                textAlign: "center",
                color: INK_SOFT,
                fontSize: 11.5,
                lineHeight: 1.4,
                borderTop: `1.5px dashed ${DASH_C}`,
                borderBottom: `1.5px dashed ${DASH_C}`,
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, color: INK }}>
                Payment Information
              </p>
              {bill.payments.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    margin: "3px 0 0",
                  }}
                >
                  <span>{p.method}</span>
                  <span>Rs. {fmtAmt(p.amount)}</span>
                </div>
              ))}
            </div>
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

          {RESTAURANT_INFO.reviewUrl && (
            <div
              style={{
                marginTop: 18,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 7,
              }}
            >
              <div
                style={{
                  padding: 8,
                  background: "#ffffff",
                  border: `1.5px dashed ${DASH_C}`,
                  borderRadius: 6,
                }}
              >
                <QRCodeSVG value={RESTAURANT_INFO.reviewUrl} size={92} />
              </div>
              <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: INK }}>
                Scan to rate us
              </p>
              <p style={{ margin: 0, fontSize: 11, color: INK_SOFT }}>
                We&apos;d love your feedback!
              </p>
            </div>
          )}

          <div style={{ borderTop: `2px solid ${INK}`, margin: "20px 0 0" }} />

          <div
            className="no-print"
            style={{ marginTop: 18, display: "flex", justifyContent: "center" }}
          >
            <PDFDownloadButton bill={bill} />
          </div>
        </div>

        <div style={{ maxWidth: 420, margin: "26px auto 0" }}>
          <PromoCards />
        </div>
      </div>
    </>
  );
}

// =============================================
// PAGE EXPORT
// =============================================
export default function BillPage() {
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <WaveBackground />

      <div style={{ position: "relative", zIndex: 1 }}>
        <Suspense
          fallback={
            <div
              style={{
                width: "100%",
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
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
                <MicroChefLoader />
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
      </div>
    </div>
  );
}