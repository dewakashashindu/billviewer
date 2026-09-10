"use client";

// ============================================================
// LOCATION: app/login/forgot/ForgotForm.tsx
// ALUTH FILE — mekamama create karanna
// Forgot password — 3 steps:
//   1. Login name → OTP SMS eken
//   2. OTP code verify
//   3. Aluth password
// ============================================================
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    width: "100%",
    maxWidth: 400,
    background: "#ffffff",
    borderRadius: 18,
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    padding: "34px 30px 30px",
    fontFamily: "Inter, sans-serif",
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
    fontFamily: "inherit",
  };
  const btn: React.CSSProperties = {
    width: "100%",
    height: 46,
    border: "none",
    borderRadius: 10,
    background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
  const errBox = err && (
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
  );

  // ── Step 1: login name → send OTP ──
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
        alert(
          "Password updated successfully. Please sign in with your new password."
        );
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
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg,#1c2f37 0%,#111e25 100%)",
        padding: 20,
      }}
    >
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
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
            }}
          >
            Reset password
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
            {step === 1 && "We'll text a verification code to your phone"}
            {step === 2 && `Code sent via SMS${maskedPhone ? ` to ${maskedPhone}` : ""}`}
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
                color: "#475569",
                marginBottom: 5,
              }}
            >
              Login Name
            </label>
            <input
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoFocus
              style={{ ...input, marginBottom: 16 }}
            />
            <button
              type="submit"
              disabled={busy || !loginName}
              style={{ ...btn, opacity: busy || !loginName ? 0.65 : 1 }}
            >
              {busy ? "Sending..." : "Send verification code"}
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
                  borderRadius: 9,
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
                color: "#475569",
                marginBottom: 5,
              }}
            >
              Verification code (6 digits)
            </label>
            <input
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
              style={{ ...btn, opacity: !smsSent || code.length !== 6 ? 0.65 : 1 }}
            >
              Verify code
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
                background: "#f1f5f9",
                color: "#475569",
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
                color: "#475569",
                marginBottom: 5,
              }}
            >
              New password
            </label>
            <input
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
                color: "#475569",
                marginBottom: 5,
              }}
            >
              Confirm new password
            </label>
            <input
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
                opacity: busy || password.length < 6 || !confirm ? 0.65 : 1,
              }}
            >
              {busy ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        <p style={{ margin: "18px 0 0", textAlign: "center" }}>
          <a
            href="/login"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#1d4ed8",
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
