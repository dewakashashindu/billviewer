"use client";

// ============================================================
// LOCATION: app/settings/page.tsx
// ALUTH FILE — mekamama create karanna
// User management — list / create / reset password / enable toggle
// OKKOMA icons inline SVG (emoji naha)
// ============================================================
import { useCallback, useEffect, useState } from "react";

type UserRow = {
  UserId: string;
  LoginName: string;
  UserName: string;
  GroupId: string;
  LocCode: string;
  ContNo: string;
  Email: string;
  Enable: number;
};

const ACCENT = "#eb9b46";

/* ── inline SVG icons ── */
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconKey = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export default function SettingsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<string>("");

  const [showCreate, setShowCreate] = useState(false);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [toggleFor, setToggleFor] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) setUsers(data.data || []);
      else setErr(data.error || "Failed to load users");
    } catch {
      setErr("Failed to load users");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMe(d.data.userName);
      })
      .catch(() => {});
  }, [load]);

  return (
    <div style={{ padding: "26px 30px 40px", fontFamily: "Inter, sans-serif" }}>
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#0f172a", letterSpacing: -0.3 }}>
            Users
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
            {me ? `Signed in as ${me}` : "Manage application users and passwords"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: ACCENT,
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(235,155,70,0.4)",
          }}
        >
          <IconPlus />
          New User
        </button>
      </div>

      {/* table card */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "46px 0", textAlign: "center", fontSize: 13, color: "#64748b" }}>
            Loading users...
          </div>
        ) : err ? (
          <div style={{ padding: "46px 0", textAlign: "center", fontSize: 13, color: "#b91c1c" }}>
            {err}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: "46px 0", textAlign: "center", fontSize: 13, color: "#64748b" }}>
            No users found.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["Login Name", "User Name", "Group", "Location", "Contact No", "Status", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "11px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
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
              {users.map((u) => (
                <tr key={u.UserId} style={{ borderBottom: "1px solid #eef2f7" }}>
                  <td style={{ padding: "11px 14px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                    {u.LoginName}
                  </td>
                  <td style={{ padding: "11px 14px", color: "#334155", whiteSpace: "nowrap" }}>
                    {u.UserName}
                  </td>
                  <td style={{ padding: "11px 14px", color: "#334155" }}>
                    {u.GroupId}
                  </td>
                  <td style={{ padding: "11px 14px", color: "#334155" }}>
                    {u.LocCode}
                  </td>
                  <td style={{ padding: "11px 14px", color: "#334155", whiteSpace: "nowrap" }}>
                    {u.ContNo}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: u.Enable === 1 ? "#ecfdf5" : "#fef2f2",
                        color: u.Enable === 1 ? "#047857" : "#b91c1c",
                      }}
                    >
                      {u.Enable === 1 ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => setResetFor(u)}
                      title="Reset password"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        border: "1px solid #dbe3ec",
                        background: "#fff",
                        color: "#334155",
                        borderRadius: 7,
                        padding: "6px 10px",
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
                    {String(u.UserId).toUpperCase() !== "UADMIN" && (
                      <button
                        onClick={() => setToggleFor(u)}
                        title={u.Enable === 1 ? "Disable user" : "Enable user"}
                        style={{
                          border: "1px solid #dbe3ec",
                          background: "#fff",
                          color: u.Enable === 1 ? "#b91c1c" : "#047857",
                          borderRadius: 7,
                          padding: "6px 10px",
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {resetFor && (
        <ResetPasswordModal
          user={resetFor}
          onClose={() => setResetFor(null)}
        />
      )}
      {toggleFor && (
        <ToggleModal
          user={toggleFor}
          onClose={() => setToggleFor(null)}
          onDone={() => {
            setToggleFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ─────────── modal shell ─────────── */
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
        background: "rgba(15,23,42,0.45)",
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
          maxWidth: 440,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 14,
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
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#64748b",
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

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  color: "#475569",
  marginBottom: 5,
};
const fieldInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 40,
  border: "1px solid #dbe3ec",
  borderRadius: 8,
  padding: "0 11px",
  fontSize: 13,
  color: "#0f172a",
  background: "#f8fafc",
  outline: "none",
  fontFamily: "inherit",
  marginBottom: 12,
};
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  height: 43,
  border: "none",
  borderRadius: 9,
  background: ACCENT,
  color: "#fff",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.6 : 1,
  fontFamily: "inherit",
});

/* ─────────── create user ─────────── */
function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [f, setF] = useState({
    loginName: "",
    userName: "",
    password: "",
    nic: "",
    contNo: "",
    email: "",
    groupId: "STAFF",
    locCode: "",
    dob: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (data.success) {
        alert(`User "${f.userName}" created successfully.`);
        onCreated();
      } else {
        setErr(data.error || "Failed to create user");
        setBusy(false);
      }
    } catch {
      setErr("Failed to create user");
      setBusy(false);
    }
  };

  return (
    <ModalShell title="New User" onClose={onClose}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <div>
            <label style={fieldLabel}>Login Name *</label>
            <input value={f.loginName} onChange={set("loginName")} required style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>User Name *</label>
            <input value={f.userName} onChange={set("userName")} required style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Password * (min 6)</label>
            <input type="password" value={f.password} onChange={set("password")} required minLength={6} style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>NIC *</label>
            <input value={f.nic} onChange={set("nic")} required style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Contact No</label>
            <input value={f.contNo} onChange={set("contNo")} placeholder="07xxxxxxxx" style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Email</label>
            <input type="email" value={f.email} onChange={set("email")} style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Group</label>
            <select value={f.groupId} onChange={set("groupId")} style={fieldInput}>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="STAFF">STAFF</option>
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Location Code</label>
            <input value={f.locCode} onChange={set("locCode")} placeholder="e.g. 001" style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Date of Birth</label>
            <input type="date" value={f.dob} onChange={set("dob")} style={fieldInput} />
          </div>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 11, color: "#94a3b8" }}>
          The password is stored securely (scrypt hash) — it cannot be viewed later.
        </p>
        <button
          type="submit"
          disabled={busy}
          style={primaryBtn(busy)}
        >
          {busy ? "Creating..." : "Create User"}
        </button>
      </form>
    </ModalShell>
  );
}

/* ─────────── reset password ─────────── */
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
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
        body: JSON.stringify({ userId: user.UserId, action: "reset", password }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Password reset for "${user.UserName}".`);
        onClose();
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
    <ModalShell title={`Reset Password — ${user.UserName}`} onClose={onClose}>
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
        <label style={fieldLabel}>New password * (min 6)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={fieldInput}
        />
        <label style={fieldLabel}>Confirm new password *</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          style={fieldInput}
        />
        <p style={{ margin: "0 0 14px", fontSize: 11, color: "#94a3b8" }}>
          Stored as a scrypt hash — the old password stops working immediately.
        </p>
        <button type="submit" disabled={busy} style={primaryBtn(busy)}>
          {busy ? "Updating..." : "Update Password"}
        </button>
      </form>
    </ModalShell>
  );
}

/* ─────────── enable/disable confirm ─────────── */
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
  const disabling = user.Enable === 1;

  const go = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.UserId, action: "toggle" }),
      });
      const data = await res.json();
      if (data.success) onDone();
      else {
        alert(data.error || "Failed to update user");
        setBusy(false);
      }
    } catch {
      alert("Failed to update user");
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={disabling ? "Disable User" : "Enable User"}
      onClose={onClose}
    >
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#334155", lineHeight: 1.55 }}>
        {disabling ? (
          <>
            <b>{user.UserName}</b> ({user.LoginName}) will no longer be able to
            sign in. Their bill history and reports are not affected.
          </>
        ) : (
          <>
            <b>{user.UserName}</b> ({user.LoginName}) will be able to sign in
            again with their existing password.
          </>
        )}
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            height: 43,
            border: "1px solid #dbe3ec",
            borderRadius: 9,
            background: "#fff",
            color: "#334155",
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
