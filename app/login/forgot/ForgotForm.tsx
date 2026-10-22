"use client";

// ============================================================
// LOCATION: app/login/forgot/ForgotForm.tsx
// Forgot password — 3 steps with Mila Mirissa background (/auth-bg.jpg)
//   1. Username (LoginName) → OTP SMS eken
//   2. OTP code verify
//   3. Aluth password
// ============================================================
import { useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_FORGOT_CSS = `
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
`;

export default function ForgotForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loginName, setLoginName] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const card: React.CSSProperties = {
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
    fontFamily: "Inter, sans-serif",
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
    fontFamily: "inherit",
    transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s",
  };
  const btn: React.CSSProperties = {
    width: "100%",
    height: 48,
    border: "none",
    borderRadius: 11,
    background: "linear-gradient(135deg, #45301D 0%, #684830 100%)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 8px 20px rgba(69, 48, 29, 0.25)",
  };
  const errBox = err && (
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
  );

  // ── Step 1: username → send OTP ──
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginName }),
      });
      const data = await res.json();
      if (data.success) {
        setSmsSent(Boolean(data.smsSent));
        setMaskedPhone(data.maskedPhone || "");
        setStep(2);
      } else {
        setErr(data.error || "Request failed");
      }
    } catch {
      setErr("Request failed. Please try again.");
    }
    setBusy(false);
  };

  // ── Step 3: verify + reset ──
  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginName, code, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/login");
      } else {
        setErr(data.error || "Reset failed");
      }
    } catch {
      setErr("Reset failed. Please try again.");
    }
    setBusy(false);
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
        background: "#1b1109",
      }}
    >
      <style>{AUTH_FORGOT_CSS}</style>

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

      <div className="auth-card" style={card}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              width: 84,
              height: 84,
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
            }}
          >
            Reset Password
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#6B543E" }}>
            {step === 1 && "We'll text a verification code to your phone"}
            {step === 2 &&
              `Code sent via SMS${maskedPhone ? ` to ${maskedPhone}` : ""}`}
            {step === 3 && "Choose a new password"}
          </p>
        </div>

        {errBox}

        {step === 1 && (
          <form onSubmit={sendOtp}>
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
              autoFocus
              style={{ ...input, marginBottom: 16 }}
            />
            <button
              type="submit"
              disabled={busy || !loginName}
              style={{ ...btn, opacity: busy || !loginName ? 0.6 : 1 }}
            >
              {busy ? "Sending..." : "Send Verification Code"}
            </button>
          </form>
        )}

        {step === 2 && (
          <div>
            {!smsSent && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  fontSize: 12.5,
                  fontWeight: 500,
                  borderRadius: 10,
                  padding: "10px 13px",
                  marginBottom: 14,
                }}
              >
                SMS gateway is not configured — the code could not be sent.
                Please contact your administrator to reset your password.
              </div>
            )}
            <label
              style={{
                display: "block",
                fontSize: 11.5,
                fontWeight: 700,
                color: "#6B543E",
                marginBottom: 6,
              }}
            >
              Verification code (6 digits)
            </label>
            <input
              className="auth-input"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoFocus
              style={{
                ...input,
                marginBottom: 16,
                letterSpacing: 8,
                fontSize: 18,
                fontWeight: 700,
                textAlign: "center",
              }}
            />
            <button
              onClick={() => {
                if (!smsSent) return;
                setStep(3);
              }}
              disabled={!smsSent || code.length !== 6}
              style={{
                ...btn,
                opacity: !smsSent || code.length !== 6 ? 0.6 : 1,
              }}
            >
              Verify Code
            </button>
            <button
              onClick={() => {
                setStep(1);
                setCode("");
                setErr(null);
              }}
              style={{
                ...btn,
                marginTop: 10,
                background: "#FCF7F3",
                border: "1px solid #E4D6BF",
                boxShadow: "none",
                color: "#6B543E",
              }}
            >
              Back
            </button>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={doReset}>
            <label
              style={{
                display: "block",
                fontSize: 11.5,
                fontWeight: 700,
                color: "#6B543E",
                marginBottom: 6,
              }}
            >
              New password
            </label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              style={{ ...input, marginBottom: 12 }}
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
              Confirm new password
            </label>
            <input
              className="auth-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ ...input, marginBottom: 16 }}
            />
            <button
              type="submit"
              disabled={busy || password.length < 6 || !confirm}
              style={{
                ...btn,
                opacity: busy || password.length < 6 || !confirm ? 0.6 : 1,
              }}
            >
              {busy ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

        <p style={{ margin: "18px 0 0", textAlign: "center" }}>
          <a
            href="/login"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#684830",
              textDecoration: "none",
            }}
          >
            ← Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
