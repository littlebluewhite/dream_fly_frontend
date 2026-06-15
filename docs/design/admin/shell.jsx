/* Dream Fly — Admin / Coach portal · shell (sidebar, topbar, role switch, layout primitives) */
const DS = window.DreamFlyDesignSystem_9975ce;
const { Badge, Avatar, IconButton, Card } = DS;

const PROFILES = {
  admin: { name: "陳怡君", initial: "陳", role: "系統管理員", desc: "可存取全平台後台 · 6 個功能模組", color: "#0066CC" },
  coach: { name: "林雅婷", initial: "林", role: "競技體操總教練", desc: "管理班級、學員出勤與訊息", color: "#0066CC" },
};

const NAV = {
  admin: [
    { id: "home", label: "儀表板總覽", icon: "layout-dashboard" },
    { id: "members", label: "會員管理", icon: "users" },
    { id: "coaches", label: "教練管理", icon: "user-check" },
    { id: "classes", label: "課程管理", icon: "book-open" },
    { id: "orders", label: "訂單管理", icon: "shopping-bag" },
    { id: "venues", label: "場館管理", icon: "building-2" },
    { id: "tickets", label: "票券管理", icon: "ticket" },
    { id: "reports", label: "報表分析", icon: "bar-chart-3" },
    { id: "settings", label: "系統設定", icon: "settings" },
  ],
  coach: [
    { id: "today", label: "工作台", icon: "layout-dashboard" },
    { id: "attendance", label: "點名出勤", icon: "calendar-check" },
    { id: "students", label: "我的學員", icon: "users" },
    { id: "messages", label: "訊息", icon: "message-circle", badge: 2 },
    { id: "csettings", label: "設定", icon: "settings" },
  ],
};

const NAV_GROUPS = {
  admin: [["主要功能", ["home", "members", "coaches", "classes", "orders", "venues", "tickets", "reports", "settings"]]],
  coach: [["今日", ["today", "attendance"]], ["我的班級", ["students", "messages"]], ["系統", ["csettings"]]],
};

/* ---- Role-switch popover (lifted from .pen role menu) ---- */
function RoleMenu({ role, setRole, onClose }) {
  const other = role === "admin" ? "coach" : "admin";
  const cur = PROFILES[role];
  const target = PROFILES[other];
  const targetLabel = other === "coach" ? "教練工作台" : "管理後台";
  const targetTag = other === "coach" ? "教練" : "管理員";
  useLucide();
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
      <div style={{ position: "absolute", bottom: 70, left: 14, width: 264, background: "#fff", borderRadius: 14, boxShadow: "var(--df-shadow-strong)", zIndex: 70, overflow: "hidden", animation: "df-fade-up .16s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 16px 14px" }}>
          <div style={{ width: 34, height: 34, borderRadius: 17, background: "var(--df-primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Ic n="check" s={18} c="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--df-primary-dark)", lineHeight: 1.4 }}>目前以 {cur.role} 身分檢視</div>
            <div style={{ fontSize: 11, color: "var(--df-text-light)", marginTop: 3, lineHeight: 1.4 }}>{cur.desc}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 18px 6px" }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: "var(--df-text-muted)" }}>切換至其他身分</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--df-border-strong)" }}>1 個可用</span>
        </div>
        <div style={{ padding: "0 8px 4px" }}>
          <button onClick={() => { setRole(other); onClose(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--df-accent)", background: "#FFFBEB", cursor: "pointer", textAlign: "left" }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--df-accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Ic n={other === "coach" ? "graduation-cap" : "shield-check"} s={20} c="var(--df-ink)" />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--df-text-dark)" }}>{targetLabel}</span>
                <span style={{ background: "var(--df-warning-bg)", color: "#B45309", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4 }}>{targetTag}</span>
              </span>
              <span style={{ display: "block", fontSize: 11, color: "var(--df-text-light)", marginTop: 3 }}>{target.desc}</span>
            </span>
            <span style={{ width: 28, height: 28, borderRadius: 14, background: "var(--df-primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Ic n="arrow-right" s={14} c="#fff" />
            </span>
          </button>
        </div>
        <div style={{ height: 1, background: "#F1F5F9", margin: "6px 18px" }} />
        {[["user-cog", "個人設定", "編輯個人資料與通知偏好"], ["key-round", "帳號管理", "密碼、雙重驗證、登入紀錄"]].map(([ic, l, d]) => (
          <div key={l} className="df-rowhover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", cursor: "pointer" }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--df-bg-light)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n={ic} s={14} c="var(--df-text-dark)" /></span>
            <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)" }}>{l}</span><span style={{ display: "block", fontSize: 11, color: "var(--df-text-light)" }}>{d}</span></span>
            <Ic n="chevron-right" s={14} c="var(--df-border-strong)" />
          </div>
        ))}
        <div style={{ padding: "4px 8px 12px" }}>
          <div className="df-rowhover" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#FEF2F2", cursor: "pointer" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="log-out" s={14} c="#EF4444" /></span>
              <span><span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#DC2626" }}>登出</span><span style={{ display: "block", fontSize: 11, color: "#F87171" }}>結束目前工作階段</span></span>
            </span>
            <Ic n="chevron-right" s={14} c="#FCA5A5" />
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---- Sidebar ---- */
function Sidebar({ role, setRole, view, setView }) {
  const [menu, setMenu] = React.useState(false);
  const nav = NAV[role];
  const groups = NAV_GROUPS[role];
  const p = PROFILES[role];
  const byId = Object.fromEntries(nav.map((n) => [n.id, n]));
  useLucide();
  return (
    <aside style={{ width: 248, flex: "none", background: "var(--df-ink)", display: "flex", flexDirection: "column", height: "100%", position: "relative", fontFamily: "var(--df-font-admin)" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", gap: 11, padding: "0 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", padding: 3 }}>
          <img src="assets/logo-df-monogram.png" alt="Dream Fly" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ lineHeight: 1.25, whiteSpace: "nowrap" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: 0.3 }}>Dream Fly</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 600, letterSpacing: 1.5 }}>{role === "admin" ? "ADMIN · 後台" : "COACH · 工作台"}</div>
        </div>
      </div>
      <nav style={{ padding: "12px 12px 4px", display: "flex", flexDirection: "column", gap: 14, flex: 1, overflowY: "auto" }}>
        {groups.map(([title, ids]) => (
          <div key={title}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: "rgba(255,255,255,0.34)", padding: "2px 13px 8px" }}>{title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {ids.map((id) => {
                const n = byId[id]; const active = view === id;
                return (
                  <button key={id} className="df-navbtn" onClick={() => setView(id)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "9px 13px", borderRadius: 9, border: "none", cursor: "pointer", width: "100%",
                    backgroundColor: active ? "var(--df-primary)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.62)",
                    fontSize: 14, fontWeight: active ? 600 : 500, fontFamily: "var(--df-font-admin)", textAlign: "left",
                    boxShadow: active ? "0 6px 16px rgba(0,102,204,0.4)" : "none",
                  }}>
                    <Ic n={n.icon} s={18} /> <span style={{ flex: 1 }}>{n.label}</span>
                    {n.badge && <span style={{ background: "var(--df-accent)", color: "var(--df-ink)", fontSize: 11, fontWeight: 800, minWidth: 19, height: 19, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{n.badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {menu && <RoleMenu role={role} setRole={(r) => { setRole(r); }} onClose={() => setMenu(false)} />}
      <button onClick={() => setMenu((m) => !m)} style={{ margin: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 11, background: menu ? "rgba(255,255,255,0.08)" : "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 11, cursor: "pointer", textAlign: "left" }}>
        <Avatar name={p.initial} size="sm" color={p.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.role}</div>
        </div>
        <Ic n="chevrons-up-down" s={16} c="rgba(255,255,255,0.5)" />
      </button>
    </aside>
  );
}

/* ---- Topbar ---- */
function Topbar({ role, title, sub, search, setSearch, onBell }) {
  useLucide();
  return (
    <div style={{ height: 64, flex: "none", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--df-border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", position: "sticky", top: 0, zIndex: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--df-font-admin)", fontSize: 20, fontWeight: 700, color: "var(--df-ink)", lineHeight: 1.2 }}>{title}</h1>
          {sub && <div style={{ fontSize: 12.5, color: "var(--df-text-light)", marginTop: 1 }}>{sub}</div>}
        </div>
        <Badge tone={role === "admin" ? "primary" : "accent"} solid={role !== "admin"}>{role === "admin" ? "系統管理員" : "教練"}</Badge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--df-bg-light)", border: "1px solid var(--df-border)", borderRadius: 9, padding: "0 12px", height: 38, width: 240 }}>
          <Ic n="search" s={16} c="var(--df-text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={role === "coach" ? "搜尋我的學員、訊息…" : "搜尋學員、課程、訂單…"} style={{ border: "none", background: "transparent", outline: "none", fontSize: 13.5, width: "100%", color: "var(--df-text-dark)", fontFamily: "var(--df-font-body)" }} />
        </div>
        <IconButton aria-label="通知" variant="outline" onClick={onBell}><Ic n="bell" s={18} /></IconButton>
        <a href="../client/index.html" title="會員中心（示範切換）" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 13px", borderRadius: 9, border: "1px solid var(--df-border)", background: "var(--df-bg-light)", color: "var(--df-text-light)", textDecoration: "none", fontSize: 13, fontWeight: 600, fontFamily: "var(--df-font-body)" }}>
          <Ic n="user-round" s={16} c="var(--df-text-muted)" /> 會員中心 <Ic n="arrow-up-right" s={13} c="var(--df-text-muted)" />
        </a>
      </div>
    </div>
  );
}

/* ---- Shared layout primitives ---- */
function PageHead({ title, sub, actions }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ margin: 0, fontFamily: "var(--df-font-heading)", fontSize: 24, fontWeight: 800, color: "var(--df-ink)" }}>{title}</h2>
        {sub && <p style={{ margin: "5px 0 0", fontSize: 14, color: "var(--df-text-light)" }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{actions}</div>}
    </div>
  );
}

function StatCard({ icon, label, value, delta, up, tint = "var(--df-primary-bg)", color = "var(--df-primary)" }) {
  return (
    <Card padding={20}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: tint, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n={icon} s={21} c={color} /></div>
        {delta != null && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, color: up ? "var(--df-success-strong)" : "var(--df-error-strong)" }}><Ic n={up ? "trending-up" : "trending-down"} s={14} />{delta}</span>}
      </div>
      <div style={{ fontFamily: "var(--df-font-heading)", fontSize: 30, fontWeight: 800, color: "var(--df-ink)", marginTop: 14, letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--df-text-light)", marginTop: 2 }}>{label}</div>
    </Card>
  );
}

function PanelHead({ title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid var(--df-border)" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--df-ink)" }}>{title}</h3>
        {sub && <div style={{ fontSize: 12.5, color: "var(--df-text-light)", marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function MemberStatusBadge({ s }) {
  const [tone, label] = MEMBER_STATUS[s] || MEMBER_STATUS.active;
  return <Badge tone={tone} dot>{label}</Badge>;
}

Object.assign(window, { PROFILES, Sidebar, Topbar, RoleMenu, PageHead, StatCard, PanelHead, MemberStatusBadge });
