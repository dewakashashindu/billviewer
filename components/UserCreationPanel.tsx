"use client";

// ============================================================
// LOCATION: components/UserCreationPanel.tsx
// User Creation Form (Admin only)
//   • Username -> Tbl_UserDetails.LoginName (never LogName)
//   • Password -> Tbl_UserDetails.Password  (scrypt hash)
// ============================================================
import { useEffect, useState } from "react";

/* ── Inline SVG icons ── */
const IconUserPlus = () => (
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
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const IconEye = ({ open }: { open: boolean }) =>
  open ? (
    <svg
      width="16"
      height="16"
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
      width="16"
      height="16"
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
  );

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#5C432D",
  marginBottom: 6,
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 44,
  border: "1px solid #E4D6BF",
  borderRadius: 10,
  padding: "0 13px",
  fontSize: 13.5,
  color: "#45301D",
  background: "#FCF7F3",
  outline: "none",
  fontFamily: "Inter, sans-serif",
};

export default function UserCreationPanel({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [groupId, setGroupId] = useState<"USER" | "ADMIN">("USER");
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const u = d.user || d.data;
        setIsAdmin(Boolean(u?.isAdmin));
        setAuthChecked(true);
      })
      .catch(() => {
        if (alive) setAuthChecked(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    setFormOk(null);

    const trimmed = username.trim();
    if (!trimmed || !password) {
      setFormErr("Username and password are required.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmed,
          password,
          groupId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFormOk(`User "${trimmed}" created successfully.`);
        setUsername("");
        setPassword("");
        setGroupId("USER");
      } else {
        setFormErr(data.error || "Failed to create user.");
      }
    } catch {
      setFormErr("Failed to create user. Please try again.");
    }
    setCreating(false);
  };

  if (!authChecked) {
    if (embedded) return null;
    return (
      <div
        style={{
          padding: "44px 30px",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          color: "#6B543E",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    if (embedded) return null;
    return (
      <div style={{ padding: "32px 30px", fontFamily: "Inter, sans-serif" }}>
        <div
          style={{
            maxWidth: 520,
            background: "#fff",
            border: "1px solid #E4D6BF",
            borderRadius: 14,
            padding: "24px 26px",
          }}
        >
          <h2
            style={{
              margin: "0 0 6px",
              fontSize: 17,
              fontWeight: 800,
              color: "#45301D",
            }}
          >
            Administrator Access Required
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#6B543E", lineHeight: 1.55 }}>
            Only administrators can create new users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: embedded ? "28px 0 0" : "26px 30px 44px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "#F0E8D8",
              border: "1px solid #E4D6BF",
              color: "#684830",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconUserPlus />
          </span>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: embedded ? 18 : 21,
                fontWeight: 800,
                color: "#45301D",
                letterSpacing: -0.3,
              }}
            >
              User Creation
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6B543E" }}>
              Enter a username and password to create a new login account
            </p>
          </div>
        </div>
      </div>

      {/* Create User Form Card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E4D6BF",
          borderRadius: 14,
          padding: "22px 24px",
          boxShadow: "0 1px 4px rgba(104, 72, 48, 0.05)",
          maxWidth: embedded ? "100%" : 760,
        }}
      >
        {formErr && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 15,
            }}
          >
            {formErr}
          </div>
        )}
        {formOk && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 15,
            }}
          >
            {formOk}
          </div>
        )}

        <form onSubmit={handleCreate}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 14,
              alignItems: "end",
            }}
          >
            {/* Username -> LoginName */}
            <div>
              <label style={fieldLabel}>Username *</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. cashier1"
                autoComplete="off"
                required
                style={fieldInput}
              />
            </div>

            {/* Password -> Password */}
            <div>
              <label style={fieldLabel}>Password *</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 4 chars)"
                  autoComplete="new-password"
                  required
                  minLength={4}
                  style={{ ...fieldInput, paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  title={showPw ? "Hide password" : "Show password"}
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
                >
                  <IconEye open={showPw} />
                </button>
              </div>
            </div>

            {/* Role (User / Admin) */}
            <div>
              <label style={fieldLabel}>Role</label>
              <select
                value={groupId}
                onChange={(e) =>
                  setGroupId(e.target.value === "ADMIN" ? "ADMIN" : "USER")
                }
                style={fieldInput}
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: 18,
            }}
          >
            <button
              type="submit"
              disabled={creating || !username.trim() || password.length < 4}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 44,
                padding: "0 22px",
                border: "none",
                borderRadius: 10,
                background: "linear-gradient(135deg, #45301D 0%, #684830 100%)",
                color: "#fff",
                fontSize: 13.5,
                fontWeight: 700,
                cursor:
                  creating || !username.trim() || password.length < 4
                    ? "default"
                    : "pointer",
                opacity:
                  creating || !username.trim() || password.length < 4 ? 0.6 : 1,
                fontFamily: "inherit",
                boxShadow: "0 4px 12px rgba(69, 48, 29, 0.25)",
              }}
            >
              <IconUserPlus />
              {creating ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
