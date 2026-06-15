/* Dream Fly — Admin / Coach portal · app root */
const RootDS = window.DreamFlyDesignSystem_9975ce;
const { Toast: RToast } = RootDS;

const TITLES = {
  home: ["營運總覽", "全館即時概況"], classes: ["課程管理", "班級與招生"], members: ["學員管理", "報名與出席"],
  coaches: ["教練團隊", "專任教練"], orders: ["訂單與金流", "繳費紀錄"],
  venues: ["場館管理", "場地與器材"], tickets: ["票券管理", "方案與銷售"], reports: ["報表分析", "營運數據概覽"],
  settings: ["系統設定", "場館與權限"],
  today: ["教練工作台", "今日課堂概況"], attendance: ["課堂點名", "出勤紀錄"], students: ["我的學員", "技能評量"],
  messages: ["訊息", "家長與館務溝通"], csettings: ["個人設定", "帳號與通知"],
};
const DEFAULT_VIEW = { admin: "home", coach: "today" };

function ToastStack({ toasts, dismiss }) {
  const icons = { success: "check-circle", info: "info", warning: "alert-triangle", error: "x-circle" };
  React.useEffect(() => { window.lucide && window.lucide.createIcons(); });
  return (
    <div style={{ position: "fixed", right: 24, bottom: 24, zIndex: 2000, display: "flex", flexDirection: "column", gap: 12 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ animation: "df-toast-in .2s ease" }}>
          <RToast tone={t.tone} title={t.title} icon={<Ic n={icons[t.tone]} s={18} />} onClose={() => dismiss(t.id)}>{t.body}</RToast>
        </div>
      ))}
    </div>
  );
}

function Portal() {
  const [role, setRoleRaw] = React.useState("admin");
  const [view, setView] = React.useState("home");
  const [search, setSearch] = React.useState("");
  const [toasts, setToasts] = React.useState([]);
  const idRef = React.useRef(1);

  const notify = React.useCallback((tone, title, body) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, tone, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const setRole = (r) => { setRoleRaw(r); setView(DEFAULT_VIEW[r]); setSearch(""); notify("info", r === "coach" ? "已切換至教練工作台" : "已切換至管理後台", r === "coach" ? "林雅婷 教練 · 管理班級與出勤" : "陳怡君 · 系統管理員"); };

  React.useEffect(() => { window.lucide && window.lucide.createIcons(); });

  const [title, sub] = TITLES[view] || ["", ""];

  let content;
  if (role === "admin") {
    content = view === "classes" ? <ClassesView notify={notify} search={search} />
      : view === "members" ? <MembersView notify={notify} search={search} />
      : view === "coaches" ? <CoachesView notify={notify} />
      : view === "orders" ? <OrdersView notify={notify} search={search} />
      : view === "venues" ? <VenuesView notify={notify} />
      : view === "tickets" ? <TicketsView notify={notify} />
      : view === "reports" ? <ReportsView notify={notify} />
      : view === "settings" ? <SettingsView notify={notify} />
      : <AdminHome notify={notify} setView={setView} />;
  } else {
    content = view === "attendance" ? <AttendanceView notify={notify} />
      : view === "students" ? <CoachStudents notify={notify} search={search} />
      : view === "messages" ? <CoachMessages notify={notify} search={search} />
      : view === "csettings" ? <CoachSettings notify={notify} />
      : <CoachToday notify={notify} setView={setView} />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--df-bg-light)", fontFamily: "var(--df-font-body)" }}>
      <Sidebar role={role} setRole={setRole} view={view} setView={setView} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar role={role} title={title} sub={sub} search={search} setSearch={setSearch} onBell={() => notify("info", "通知中心", "目前有 3 則新通知。")} />
        <div style={{ flex: 1, overflow: "auto", padding: 26 }}>
          {content}
        </div>
      </div>
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<Portal />);
