"use client";

// ============================================================
// LOCATION: app/login/LoginForm.tsx
// Login form — Mila Mirissa coastal sunset background (/auth-bg.jpg)
// Verifies against Tbl_UserDetails.LoginName + Password
// ============================================================
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const AUTH_CSS = `
  @keyframes authBgDrift {
    0%   { transform: scale(1.03) translate3d(0, 0, 0); }
    50%  { transform: scale(1.08) translate3d(-1.2%, -0.8%, 0); }
    100% { transform: scale(1.03) translate3d(0, 0, 0); }
  }
  @keyframes authCardIn {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .auth-bg-photo {
    animation: authBgDrift 26s ease-in-out infinite;
    will-change: transform;
  }
  .auth-card {
    animation: authCardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .auth-input:focus {
    border-color: #684830 !important;
    box-shadow: 0 0 0 3px rgba(104, 72, 48, 0.14);
    background: #ffffff !important;
  }
  .auth-submit-btn:hover:not(:disabled) {
    filter: brightness(1.07);
    transform: translateY(-1px);
  }
  .auth-submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }
`;

export default function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextUrl = sp.get("next") || "/dashboard";

  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginName, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(nextUrl);
        router.refresh();
      } else {
        setErr(data.error || "Login failed");
        setBusy(false);
      }
    } catch {
      setErr("Login failed. Please try again.");
      setBusy(false);
    }
  };

  const input: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    height: 46,
    border: "1px solid #DFCDBA",
    borderRadius: 10,
    padding: "0 13px",
    fontSize: 13.5,
    color: "#45301D",
    background: "#FCF7F3",
    outline: "none",
    fontFamily: "Inter, sans-serif",
    transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s",
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: 20,
        fontFamily: "Inter, sans-serif",
        background: "#1b1109",
      }}
    >
      <style>{AUTH_CSS}</style>

      {/* Full-bleed background photo + warm coastal vignette */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <div
          className="auth-bg-photo"
          style={{
            position: "absolute",
            inset: "-4%",
            backgroundImage: "url('/auth-bg.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(160deg, rgba(24, 14, 7, 0.62) 0%, rgba(48, 30, 16, 0.44) 48%, rgba(20, 12, 6, 0.72) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 42%, rgba(235, 175, 105, 0.14) 0%, rgba(0, 0, 0, 0.35) 75%)",
          }}
        />
      </div>

      {/* Frosted Sign-In Card */}
      <div
        className="auth-card"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 410,
          background: "rgba(255, 252, 248, 0.94)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(228, 214, 191, 0.85)",
          borderRadius: 20,
          boxShadow: "0 28px 80px rgba(12, 7, 3, 0.55)",
          padding: "34px 32px 28px",
        }}
      >
        {/* Logo + Title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              margin: "0 auto 12px",
              borderRadius: "50%",
              padding: 4,
              background: "linear-gradient(135deg, #E8D5B7 0%, #B8956A 100%)",
              boxShadow: "0 8px 22px rgba(69, 48, 29, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/millamirissa.png"
              alt="Mila Mirissa"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
                background: "#FCF7F3",
                display: "block",
              }}
            />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: "#45301D",
              letterSpacing: -0.3,
            }}
          >
            Welcome Back
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#6B543E" }}>
            Sign in to Reports &amp; Back Office
          </p>
        </div>

        {err && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 12.5,
              fontWeight: 500,
              borderRadius: 10,
              padding: "10px 13px",
              marginBottom: 15,
            }}
          >
            {err}
          </div>
        )}

        <form onSubmit={submit}>
          <label
            style={{
              display: "block",
              fontSize: 11.5,
              fontWeight: 700,
              color: "#6B543E",
              marginBottom: 6,
            }}
          >
            Username
          </label>
          <input
            className="auth-input"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
            autoFocus
            style={{ ...input, marginBottom: 15 }}
          />

          <label
            style={{
              display: "block",
              fontSize: 11.5,
              fontWeight: 700,
              color: "#6B543E",
              marginBottom: 6,
            }}
          >
            Password
          </label>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input
              className="auth-input"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{ ...input, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              style={{
                position: "absolute",
                right: 9,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#6B543E",
                padding: 4,
                display: "flex",
              }}
              title={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <div style={{ textAlign: "right", marginBottom: 18 }}>
            <a
              href="/login/forgot"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#684830",
                textDecoration: "none",
              }}
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={busy || !loginName || !password}
            style={{
              width: "100%",
              height: 48,
              border: "none",
              borderRadius: 11,
              background: "linear-gradient(135deg, #45301D 0%, #684830 100%)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: busy || !loginName || !password ? "default" : "pointer",
              opacity: busy || !loginName || !password ? 0.6 : 1,
              fontFamily: "inherit",
              boxShadow: "0 8px 20px rgba(69, 48, 29, 0.28)",
              transition: "filter 0.18s, transform 0.15s, opacity 0.18s",
            }}
          >
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p
          style={{
            margin: "18px 0 0",
            textAlign: "center",
            fontSize: 11,
            color: "#8A725A",
          }}
        >
          Customer e-bill links open directly — no sign-in needed.
        </p>
      </div>
    </div>
  );
}
