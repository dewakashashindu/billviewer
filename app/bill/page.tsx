"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

interface BillItem {
  name: string;
  price: number;
}

interface Bill {
  billNumber: string;
  tableName: string;
  serverName: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  tip: number;
  grandTotal: number;
  status: "PAID" | "PENDING" | "CANCELLED";
}

// Promotions data (previous එකේ තියෙන එකම)
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

// PromoPopup component (previous එකේ තියෙන එකම - කෝඩ් දුර කරලා තියෙන්නේ)
function PromoPopup({ onClose }: { onClose: () => void }) {
  // ... (previous code එකම use කරන්න)
  return null; // Replace with your previous PromoPopup code
}

// PromoCards component (previous එකේ තියෙන එකම)
function PromoCards() {
  // ... (previous code එකම use කරන්න)
  return null; // Replace with your previous PromoCards code
}

// Bill Content Component
function BillContent() {
  const searchParams = useSearchParams();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPromo, setShowPromo] = useState(false);

  useEffect(() => {
    const encryptedId = searchParams.get('id');
    
    if (!encryptedId) {
      setError('No bill ID provided in URL');
      setLoading(false);
      return;
    }

    // API call කරලා bill data එක fetch කරනවා
    fetch(`/api/bill?id=${encryptedId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.bill) {
          setBill(data.bill);
          // Bill load වුනාම 800ms වලින් promo popup එක පෙන්නනවා
          setTimeout(() => setShowPromo(true), 800);
        } else {
          setError(data.error || 'Bill not found');
        }
      })
      .catch(err => {
        console.error('Error fetching bill:', err);
        setError('Failed to load bill');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams]);

  const handleDownload = () => window.print();

  // Loading state
  if (loading) {
    return (
      <div style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #F0F4FF 0%, #F8F9FB 50%, #FFF8F0 100%)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 60,
            height: 60,
            border: '4px solid #E8EAF6',
            borderTop: '4px solid #003D9B',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px',
          }} />
          <p style={{
            color: '#434654',
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
          }}>
            Loading your bill...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error || !bill) {
    return (
      <div style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #F0F4FF 0%, #F8F9FB 50%, #FFF8F0 100%)',
        padding: 20,
      }}>
        <div style={{
          maxWidth: 500,
          background: 'white',
          borderRadius: 16,
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            width: 80,
            height: 80,
            background: 'rgba(239,68,68,0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#ef4444"/>
            </svg>
          </div>
          <h2 style={{
            color: '#191C1E',
            fontSize: 24,
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            marginBottom: 12,
          }}>
            Bill Not Found
          </h2>
          <p style={{
            color: '#434654',
            fontSize: 14,
            fontFamily: 'Inter, sans-serif',
            lineHeight: '22px',
            marginBottom: 24,
          }}>
            {error || 'The bill you are looking for does not exist or the link is invalid.'}
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#003D9B',
              color: 'white',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  // Success - Bill එක පෙන්නනවා
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-up { animation: fadeUp 0.55s ease both; }
        .anim-delay-1 { animation-delay: 0.1s; }
        .anim-delay-2 { animation-delay: 0.2s; }
      `}</style>

      {showPromo && <PromoPopup onClose={() => setShowPromo(false)} />}

      {/* NAVBAR */}
      <nav className="no-print" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(255,255,255,0.95)',
        boxShadow: '0 1px 0 #EEEEEE',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 1200,
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/CAPTURE 1.png" alt="MICROECHEF" width={36} height={36} style={{ borderRadius: 8 }} priority />
            <span style={{
              color: '#003D9B',
              fontSize: 20,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
            }}>
              MICROECHEF
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              color: '#434654',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
            }}>
              Order #{bill.billNumber}
            </span>
            <div style={{
              padding: '4px 12px',
              background: bill.status === 'PAID' ? 'rgba(22,163,74,0.10)' : 'rgba(234,179,8,0.10)',
              borderRadius: 9999,
              border: `1px solid ${bill.status === 'PAID' ? 'rgba(22,163,74,0.2)' : 'rgba(234,179,8,0.2)'}`,
            }}>
              <span style={{
                color: bill.status === 'PAID' ? '#16a34a' : '#ca8a04',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
              }}>
                {bill.status === 'PAID' ? '✓ PAID' : '⏳ PENDING'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* PAGE CONTENT */}
      <div style={{
        width: '100%',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F0F4FF 0%, #F8F9FB 50%, #FFF8F0 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          flex: 1,
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 712,
            paddingTop: 110,
            paddingBottom: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* BILL CARD */}
            <div className="anim-up" style={{ width: '100%', maxWidth: 672 }}>
              <div style={{
                width: '100%',
                background: 'rgba(255,255,255,0.96)',
                boxShadow: '0 20px 60px rgba(0,61,155,0.10)',
                borderRadius: 16,
                outline: '1px #EEEEEE solid',
                overflow: 'hidden',
              }}>
                <div style={{ height: 5, background: 'linear-gradient(90deg, #003D9B 0%, #0066FF 50%, #FF8C00 100%)' }} />
                
                <div style={{ padding: '40px 44px' }}>
                  {/* Header */}
                  <div style={{
                    paddingBottom: 24,
                    borderBottom: '1px solid #EEEEEE',
                    marginBottom: 24,
                    textAlign: 'center',
                  }}>
                    <div style={{
                      width: 52,
                      height: 52,
                      margin: '0 auto 16px',
                      borderRadius: 14,
                      overflow: 'hidden',
                      boxShadow: '0 4px 12px rgba(0,61,155,0.15)',
                    }}>
                      <Image src="/CAPTURE 1.png" alt="MICROECHEF" width={52} height={52} />
                    </div>
                    <p style={{
                      color: '#003D9B',
                      fontSize: 13,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}>
                      MICROECHEF
                    </p>
                    <p style={{
                      color: '#191C1E',
                      fontSize: 26,
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 700,
                      marginBottom: 8,
                    }}>
                      Your Bill
                    </p>
                    <p style={{
                      color: '#434654',
                      fontSize: 12,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 500,
                    }}>
                      {bill.tableName} &bull; Server: {bill.serverName} &bull; {bill.date}
                    </p>
                  </div>

                  {/* Items */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    paddingBottom: 24,
                    borderBottom: '1px dashed #DDDDDD',
                    marginBottom: 20,
                  }}>
                    {bill.items.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                      }}>
                        <p style={{
                          color: '#191C1E',
                          fontSize: 14.5,
                          fontFamily: 'Inter, sans-serif',
                        }}>
                          {item.name}
                        </p>
                        <p style={{
                          color: '#191C1E',
                          fontSize: 14.5,
                          fontFamily: "'Courier New', monospace",
                          fontWeight: 600,
                        }}>
                          Rs. {item.price.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Subtotal', value: bill.subtotal },
                      { label: 'Tax (8%)', value: bill.tax },
                      { label: 'Tip', value: bill.tip },
                    ].map((row) => (
                      <div key={row.label} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}>
                        <p style={{ color: '#434654', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
                          {row.label}
                        </p>
                        <p style={{ color: '#434654', fontSize: 14, fontFamily: "'Courier New', monospace" }}>
                          Rs. {row.value.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    ))}

                    {/* Grand Total */}
                    <div style={{
                      marginTop: 12,
                      padding: 20,
                      background: 'linear-gradient(135deg, rgba(0,61,155,0.05) 0%, rgba(0,102,255,0.04) 100%)',
                      borderRadius: 12,
                      border: '1px solid rgba(0,61,155,0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <p style={{
                        color: '#191C1E',
                        fontSize: 20,
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 700,
                      }}>
                        Grand Total
                      </p>
                      <p style={{
                        color: '#003D9B',
                        fontSize: 22,
                        fontFamily: "'Courier New', monospace",
                        fontWeight: 800,
                      }}>
                        Rs. {bill.grandTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Download Button */}
                  <div className="no-print" style={{ marginTop: 28, textAlign: 'center' }}>
                    <button onClick={handleDownload} style={{
                      padding: '15px 32px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #003D9B 0%, #0052CC 100%)',
                      border: 'none',
                      color: 'white',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(0,61,155,0.3)',
                    }}>
                      📥 Download PDF Bill
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PROMO CARDS - Add your PromoCards component here */}
            
          </div>
        </div>
      </div>
    </>
  );
}

// Main Page with Suspense
export default function BillPage() {
  return (
    <Suspense fallback={
      <div style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <p>Loading...</p>
      </div>
    }>
      <BillContent />
    </Suspense>
  );
}