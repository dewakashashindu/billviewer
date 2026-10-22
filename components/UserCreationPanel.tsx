"use client";

// ============================================================
// LOCATION: components/UserCreationPanel.tsx
// User Creation Form + Existing Users Table (Admin only)
//   • Username -> Tbl_UserDetails.LoginName (never LogName)
//   • Password -> Tbl_UserDetails.Password  (scrypt hash)
// ============================================================
import { useCallback, useEffect, useState } from "react";

export type UserRow = {
  UserId: string;
  LoginName: string;
  UserName: string;
  GroupId: string;
  LocCode: string;
  ContNo: string;
  Email: string;
  Enable: number;
};

const ACCENT = "#684830";

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

const IconKey = () => (
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
    <path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const IconX = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <path d="M18 6L6 18M6 6l12 12" />
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
  const [meId, setMeId] = useState("");

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [groupId, setGroupId] = useState<"USER" | "ADMIN">("USER");
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  // Users list state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);

  // Modals
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [toggleFor, setToggleFor] = useState<UserRow | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setListErr(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.data || []);
      } else {
        setListErr(data.error || "Failed to load users");
      }
    } catch {
      setListErr("Failed to load users");
    }
    setLoadingUsers(false);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const u = d.user || d.data;
        const admin = Boolean(u?.isAdmin);
        setIsAdmin(admin);
        setMeId(String(u?.userId ?? ""));
        setAuthChecked(true);
        if (admin) loadUsers();
      })
      .catch(() => {
        if (alive) setAuthChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [loadUsers]);

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
        loadUsers();
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
            Only administrators can create new users or manage existing accounts.
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
          marginBottom: 22,
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
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 16,
            }}
          >
            <span style={{ fontSize: 11.5, color: "#8A725A" }}>
              Saves Username to <b>LoginName</b> and hashed Password to{" "}
              <b>Password</b>.
            </span>

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

      {/* Existing Users List */}
      {!embedded && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #E4D6BF",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(104, 72, 48, 0.04)",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #E4D6BF",
              background: "#FCF7F3",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#45301D" }}>
              Existing Accounts ({users.length})
            </span>
          </div>

          {loadingUsers ? (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                fontSize: 13,
                color: "#6B543E",
              }}
            >
              Loading users...
            </div>
          ) : listErr ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                fontSize: 13,
                color: "#b91c1c",
              }}
            >
              {listErr}
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                fontSize: 13,
                color: "#6B543E",
              }}
            >
              No web login accounts found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#FCF7F3",
                      borderBottom: "1px solid #EFE4D4",
                    }}
                  >
                    {["Username (LoginName)", "Role", "Status", ""].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "11px 16px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#6B543E",
                          letterSpacing: 0.4,
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const rowAdmin =
                      String(u.GroupId).toUpperCase() === "ADMIN" ||
                      String(u.UserId).toUpperCase() === "UADMIN" ||
                      String(u.LoginName).toLowerCase() === "admin";
                    const isSelf =
                      meId &&
                      String(u.UserId).trim().toUpperCase() ===
                        meId.trim().toUpperCase();

                    return (
                      <tr
                        key={u.UserId}
                        style={{ borderBottom: "1px solid #FCF7F3" }}
                      >
                        <td
                          style={{
                            padding: "12px 16px",
                            fontWeight: 700,
                            color: "#45301D",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {u.LoginName}
                          {u.UserName &&
                            u.UserName.toLowerCase() !==
                              u.LoginName.toLowerCase() && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontWeight: 500,
                                  fontSize: 12,
                                  color: "#8A725A",
                                }}
                              >
                                ({u.UserName})
                              </span>
                            )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: rowAdmin ? "#F0E8D8" : "#F8F4EE",
                              color: rowAdmin ? "#45301D" : "#6B543E",
                              border: "1px solid #E4D6BF",
                            }}
                          >
                            {rowAdmin ? "Admin" : u.GroupId || "User"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background:
                                u.Enable === 1 ? "#ecfdf5" : "#fef2f2",
                              color: u.Enable === 1 ? "#047857" : "#b91c1c",
                            }}
                          >
                            {u.Enable === 1 ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <button
                            onClick={() => setResetFor(u)}
                            title="Reset password"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              border: "1px solid #E4D6BF",
                              background: "#fff",
                              color: "#684830",
                              borderRadius: 8,
                              padding: "6px 11px",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              marginRight: 6,
                            }}
                          >
                            <IconKey />
                            Reset Password
                          </button>
                          {!isSelf &&
                            String(u.UserId).toUpperCase() !== "UADMIN" && (
                              <button
                                onClick={() => setToggleFor(u)}
                                title={
                                  u.Enable === 1
                                    ? "Disable user"
                                    : "Enable user"
                                }
                                style={{
                                  border: "1px solid #E4D6BF",
                                  background: "#fff",
                                  color:
                                    u.Enable === 1 ? "#b91c1c" : "#047857",
                                  borderRadius: 8,
                                  padding: "6px 11px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                {u.Enable === 1 ? "Disable" : "Enable"}
                              </button>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {resetFor && (
        <ResetPasswordModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={(msg) => {
            setResetFor(null);
            setFormOk(msg);
          }}
        />
      )}
      {toggleFor && (
        <ToggleModal
          user={toggleFor}
          onClose={() => setToggleFor(null)}
          onDone={() => {
            setToggleFor(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

/* ─────────── Modal Shell ─────────── */
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(38, 24, 12, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 15,
          boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
          padding: "22px 24px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 800,
              color: "#45301D",
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6B543E",
              padding: 4,
              display: "flex",
            }}
          >
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─────────── Reset Password Modal ─────────── */
function ResetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: UserRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.UserId,
          action: "reset",
          password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onDone(`Password updated for "${user.LoginName}".`);
      } else {
        setErr(data.error || "Reset failed");
        setBusy(false);
      }
    } catch {
      setErr("Reset failed");
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={`Reset Password — ${user.LoginName}`}
      onClose={onClose}
    >
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
        <label style={fieldLabel}>New Password * (min 4)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={4}
          style={{ ...fieldInput, marginBottom: 12 }}
        />
        <label style={fieldLabel}>Confirm New Password *</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={4}
          style={{ ...fieldInput, marginBottom: 14 }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            height: 44,
            border: "none",
            borderRadius: 10,
            background: ACCENT,
            color: "#fff",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {busy ? "Updating..." : "Update Password"}
        </button>
      </form>
    </ModalShell>
  );
}

/* ─────────── Enable / Disable Modal ─────────── */
function ToggleModal({
  user,
  onClose,
  onDone,
}: {
  user: UserRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const disabling = user.Enable === 1;

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.UserId, action: "toggle" }),
      });
      const data = await res.json();
      if (data.success) onDone();
      else {
        setErr(data.error || "Failed to update user");
        setBusy(false);
      }
    } catch {
      setErr("Failed to update user");
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={disabling ? "Disable User" : "Enable User"}
      onClose={onClose}
    >
      {err && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: 12.5,
            borderRadius: 9,
            padding: "9px 12px",
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}
      <p
        style={{
          margin: "0 0 18px",
          fontSize: 13,
          color: "#684830",
          lineHeight: 1.55,
        }}
      >
        {disabling ? (
          <>
            <b>{user.LoginName}</b> will no longer be able to sign in. Their
            bill history and reports are not affected.
          </>
        ) : (
          <>
            <b>{user.LoginName}</b> will be able to sign in again with their
            existing password.
          </>
        )}
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            height: 43,
            border: "1px solid #E4D6BF",
            borderRadius: 9,
            background: "#fff",
            color: "#684830",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
        <button
          onClick={go}
          disabled={busy}
          style={{
            flex: 1,
            height: 43,
            border: "none",
            borderRadius: 9,
            background: disabling ? "#b91c1c" : "#047857",
            color: "#fff",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            opacity: busy ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {busy ? "Working..." : disabling ? "Disable" : "Enable"}
        </button>
      </div>
    </ModalShell>
  );
}
