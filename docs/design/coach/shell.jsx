/* Dream Fly — 教練端 · shell (sidebar + topbar + shared primitives)
   Faithful to SEC/CoachPortal: navy sidebar, blue DF circle, gold 教練端 pill,
   flat 7-item nav, gold profile card; white 68px topbar w/ breadcrumb + title. */
const DS = window.DreamFlyDesignSystem_9975ce;
const { Badge, Avatar, IconButton, Card } = DS;

const NAV = [
  { id: "dashboard", label: "儀表板", icon: "layout-dashboard" },
  { id: "today", label: "今日課程", icon: "calendar-clock" },
  { id: "students", label: "我的學員", icon: "users" },
  { id: "schedule", label: "排課管理", icon: "calendar-days" },
  { id: "attendance", label: "出勤記錄", icon: "clipboard-check" },
  { id: "messages", label: "訊息中心", icon: "message-circle", badge: 3 },
  { id: "settings", label: "個人設定", icon: "settings" },
];

const PAGES = {
  dashboard: { crumb: "首頁 / 儀表板", title: "教練儀表板" },
  today: { crumb: "首頁 / 今日課程", title: "今日課程" },
  students: { crumb: "首頁 / 我的學員", title: "我的學員" },
  schedule: { crumb: "首頁 / 排課管理", title: "排課管理" },
  attendance: { crumb: "首頁 / 出勤記錄", title: "點名" },
  messages: { crumb: "首頁 / 訊息中心", title: "訊息中心" },
  settings: { crumb: "首頁 / 個人設定", title: "個人設定" },
};

/* gold coach avatar with navy initial (design: $accent fill, $bg-dark text) */
function CoachAvatar({ size = 40, online }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--df-accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--df-ink)", fontWeight: 800, fontSize: size * 0.42, fontFamily: "var(--df-font-body)" }}>{COACH.initial}</div>
      {online && <span style={{ position: "absolute", right: 0, bottom: 0, width: size * 0.28, height: size * 0.28, borderRadius: "50%", background: "var(--df-success)", border: "2px solid var(--df-ink-soft)" }} />}
    </div>
  );
}

/* blue circle avatar (topbar) */
function BlueDot({ size = 36 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--df-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.4, flex: "none", fontFamily: "var(--df-font-body)" }}>{COACH.initial}</div>;
}

/* ---- Sidebar ---- */
function Sidebar({ view, setView, notify }) {
  const [menu, setMenu] = React.useState(false);
  useLucide();
  return (
    <aside style={{ width: 240, flex: "none", background: "var(--df-bg-dark)", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", position: "relative", padding: "20px 16px", fontFamily: "var(--df-font-admin)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, minHeight: 0 }}>
        {/* logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--df-primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>DF</span>
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "var(--df-font-body)" }}>Dream Fly</span>
          <span style={{ background: "var(--df-accent)", color: "var(--df-ink)", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999 }}>教練端</span>
        </div>
        {/* nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button key={n.id} className="df-navbtn" onClick={() => setView(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                backgroundColor: active ? "var(--df-primary)" : "transparent", color: active ? "#fff" : "#94A3B8",
                fontSize: 14, fontWeight: active ? 600 : 500, fontFamily: "var(--df-font-admin)",
              }}>
                <Ic n={n.icon} s={18} c={active ? "#fff" : "#94A3B8"} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.badge && <span style={{ background: active ? "rgba(255,255,255,0.25)" : "#dc2626", color: "#fff", fontSize: 11, fontWeight: 800, minWidth: 20, height: 20, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{n.badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>
      {/* profile card */}
      {menu && <ProfileMenu setView={setView} notify={notify} onClose={() => setMenu(false)} />}
      <button onClick={() => setMenu((m) => !m)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, background: menu ? "#243149" : "var(--df-ink-soft)", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}>
        <CoachAvatar size={40} online />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "var(--df-font-body)" }}>{COACH.display}</div>
          <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: "var(--df-font-body)" }}>{COACH.role}</div>
        </div>
        <Ic n="log-out" s={18} c="#94A3B8" />
      </button>
    </aside>
  );
}

/* ---- Profile menu (pops above the profile card) ---- */
function ProfileMenu({ onClose, setView, notify }) {
  useLucide();
  const item = (ic, l, d, onClick) => (
    <button onClick={onClick} className="df-rowhover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "var(--df-font-body)" }}>
      <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--df-bg-light)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n={ic} s={15} c="var(--df-text-dark)" /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--df-text-dark)" }}>{l}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--df-text-light)" }}>{d}</span>
      </span>
      <Ic n="chevron-right" s={14} c="var(--df-border-strong)" />
    </button>
  );
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
      <div style={{ position: "absolute", bottom: 86, left: 16, width: 256, background: "#fff", borderRadius: 14, boxShadow: "var(--df-shadow-strong)", zIndex: 70, overflow: "hidden", animation: "df-fade-up .16s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px", borderBottom: "1px solid var(--df-border)" }}>
          <CoachAvatar size={40} online />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--df-ink)" }}>{COACH.full}</div>
            <div style={{ fontSize: 11.5, color: "var(--df-text-light)", marginTop: 2 }}>{COACH.id}</div>
          </div>
        </div>
        <div style={{ padding: "6px 4px" }}>
          {item("user-cog", "個人設定", "編輯個人資料與偏好", () => { setView("settings"); onClose(); })}
          {item("calendar-days", "排課管理", "查看本週授課時段", () => { setView("schedule"); onClose(); })}
          {item("shield-check", "帳號安全", "密碼、雙重驗證、登入紀錄", () => { setView("settings"); onClose(); })}
        </div>
        <div style={{ padding: "4px 8px 12px", borderTop: "1px solid var(--df-border)" }}>
          <button onClick={() => { notify && notify("info", "登出", "您已安全登出（示範）。"); onClose(); }} className="df-rowhover" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px", borderRadius: 8, background: "#FEF2F2", border: "none", cursor: "pointer", fontFamily: "var(--df-font-body)" }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="log-out" s={14} c="#EF4444" /></span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>登出目前工作階段</span>
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---- Notifications ---- */
const NOTIFS = [
  { icon: "clipboard-check", tone: "var(--df-warning)", bg: "var(--df-warning-bg)", title: "點名提醒", body: "青少年體操中級班 上課中，尚未完成點名", time: "5 分鐘前", unread: true, to: "attendance" },
  { icon: "message-circle", tone: "var(--df-primary)", bg: "var(--df-primary-bg)", title: "王媽媽（小明家長）", body: "老師您好，小明明天的課可以調整時間嗎？", time: "18 分鐘前", unread: true, to: "messages" },
  { icon: "alert-triangle", tone: "var(--df-error)", bg: "var(--df-error-bg)", title: "緊急訊息逾時", body: "黃媽媽的訊息已逾回覆時效 1.5 小時", time: "1 小時前", unread: true, to: "messages" },
  { icon: "award", tone: "var(--df-accent-dark)", bg: "#FFF8DB", title: "評核待更新", body: "競技選手培訓班 3 位學員技能評量待更新", time: "昨天 16:05", unread: false, to: "students" },
];

function NotifMenu({ onClose, setView }) {
  useLucide();
  const unread = NOTIFS.filter((n) => n.unread).length;
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
      <div style={{ position: "absolute", top: 50, right: 0, width: 360, background: "#fff", borderRadius: 14, boxShadow: "var(--df-shadow-strong)", zIndex: 70, overflow: "hidden", animation: "df-fade-up .16s ease both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 18px", borderBottom: "1px solid var(--df-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--df-ink)" }}>通知</span>
            {unread > 0 && <span style={{ background: "var(--df-primary)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 999 }}>{unread} 則未讀</span>}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--df-primary)", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--df-font-body)" }}>全部標為已讀</button>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {NOTIFS.map((n, i) => (
            <button key={i} onClick={() => { setView(n.to); onClose(); }} className="df-rowhover" style={{ display: "flex", gap: 12, width: "100%", padding: "13px 18px", border: "none", borderBottom: i < NOTIFS.length - 1 ? "1px solid var(--df-border)" : "none", background: n.unread ? "var(--df-primary-bg)" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: "var(--df-font-body)" }}>
              <span style={{ width: 36, height: 36, borderRadius: 9, background: n.bg, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n={n.icon} s={17} c={n.tone} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--df-text-dark)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
                  {n.unread && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--df-primary)", flex: "none" }} />}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--df-text-light)", marginTop: 3, lineHeight: 1.45 }}>{n.body}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--df-text-muted)", marginTop: 4 }}>{n.time}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---- Topbar ---- */
function Topbar({ view, search, setSearch, setView, action }) {
  const [notif, setNotif] = React.useState(false);
  const p = PAGES[view] || {};
  useLucide();
  return (
    <div style={{ height: 68, flex: "none", background: "#fff", borderBottom: "1px solid var(--df-border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 20 }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--df-text-light)", fontFamily: "var(--df-font-body)" }}>{p.crumb}</div>
        <h1 style={{ margin: "2px 0 0", fontFamily: "var(--df-font-body)", fontSize: 19, fontWeight: 700, color: "var(--df-text-dark)", lineHeight: 1.2 }}>{p.title}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {action}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--df-bg-light)", border: "1px solid var(--df-border)", borderRadius: 8, padding: "0 14px", height: 40, width: 280 }}>
          <Ic n="search" s={16} c="var(--df-text-light)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋學員或課程" style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, width: "100%", color: "var(--df-text-dark)", fontFamily: "var(--df-font-body)" }} />
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setNotif((v) => !v)} aria-label="通知" style={{ position: "relative", width: 40, height: 40, borderRadius: 8, border: "none", background: notif ? "var(--df-primary-bg)" : "var(--df-bg-light)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Ic n="bell" s={18} c={notif ? "var(--df-primary)" : "var(--df-text-dark)"} />
            <span style={{ position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: 999, background: "#dc2626" }} />
          </button>
          {notif && <NotifMenu setView={setView} onClose={() => setNotif(false)} />}
        </div>
        <BlueDot size={36} />
      </div>
    </div>
  );
}

/* ---- Shared primitives ---- */
function KpiCard({ label, value, sub, subTone = "var(--df-primary)", icon, iconColor = "var(--df-primary)" }) {
  return (
    <Card padding={20}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--df-text-light)" }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--df-text-dark)", marginTop: 8, fontFamily: "var(--df-font-body)", letterSpacing: -0.5 }}>{value}</div>
          {sub && <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: subTone, marginTop: 8 }}>{icon && <Ic n={icon} s={14} c={subTone} />}{sub}</div>}
        </div>
        {icon && <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--df-bg-light)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n={icon} s={20} c={iconColor} /></div>}
      </div>
    </Card>
  );
}

function PanelCard({ title, viewAll, onViewAll, children, padding = 20, right }) {
  return (
    <Card padding={0}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--df-text-dark)", fontFamily: "var(--df-font-body)" }}>{title}</h3>
        {right || (viewAll && <button onClick={onViewAll} style={{ border: "none", background: "transparent", color: "var(--df-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--df-font-body)" }}>{viewAll} →</button>)}
      </div>
      <div style={{ padding: "0 " + padding + "px " + padding + "px" }}>{children}</div>
    </Card>
  );
}

Object.assign(window, { Sidebar, Topbar, ProfileMenu, NotifMenu, CoachAvatar, BlueDot, KpiCard, PanelCard, PAGES });

