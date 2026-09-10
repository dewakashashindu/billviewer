"use client";

// ============================================================
// LOCATION: app/login/LoginForm.tsx
// ALUTH FILE — mekamama create karanna
// Login form — MicroEChef branding, dark gradient bg
// ============================================================
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    height: 44,
    border: "1px solid #dbe3ec",
    borderRadius: 9,
    padding: "0 12px",
    fontSize: 13.5,
    color: "#0f172a",
    background: "#f8fafc",
    outline: "none",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg,#1c2f37 0%,#111e25 100%)",
        padding: 20,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
          padding: "34px 30px 30px",
        }}
      >
        {/* logo + title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/CAPTURE 1.png"
            alt="MicroEChef"
            style={{
              height: 46,
              objectFit: "contain",
              margin: "0 auto 10px",
              display: "block",
            }}
          />
          <h1
            style={{
              margin: 0,
              fontSize: 19,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.2,
            }}
          >
            Sign in
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
            Reports &amp; dashboard access
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
              borderRadius: 9,
              padding: "10px 13px",
              marginBottom: 14,
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
              color: "#475569",
              marginBottom: 5,
            }}
          >
            Login Name
          </label>
          <input
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            autoComplete="username"
            autoFocus
            style={{ ...input, marginBottom: 14 }}
          />

          <label
            style={{
              display: "block",
              fontSize: 11.5,
              fontWeight: 700,
              color: "#475569",
              marginBottom: 5,
            }}
          >
            Password
          </label>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ ...input, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#64748b",
                padding: 4,
                display: "flex",
              }}
              title={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                color: "#1d4ed8",
                textDecoration: "none",
              }}
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={busy || !loginName || !password}
            style={{
              width: "100%",
              height: 46,
              border: "none",
              borderRadius: 10,
              background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: busy || !loginName || !password ? "default" : "pointer",
              opacity: busy || !loginName || !password ? 0.65 : 1,
              fontFamily: "inherit",
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
            color: "#94a3b8",
          }}
        >
          Bill links open directly — no sign-in needed.
        </p>
      </div>
    </div>
  );
}
