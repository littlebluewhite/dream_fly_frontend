/* Dream Fly — Admin portal views */
const AdsDS = window.DreamFlyDesignSystem_9975ce;
const { Button: ABtn, Badge: ABadge, Card: ACard, Avatar: AAvatar, IconButton: AIconBtn, ProgressBar: AProg, Tabs: ATabs, Dialog: ADialog, Tag: ATag, Switch: ASwitch, Select: ASelect, Input: AInput } = AdsDS;

const LEVELS = ["啟蒙", "入門", "基礎", "進階", "選手"];
const CATS = ["幼兒體操", "兒童基礎", "競技啦啦隊", "競技體操", "成人體操", "跑酷"];
const CLASS_STATUS = ["招生中", "候補", "額滿"];
const COACH_NAMES = COACHES.map((c) => c.name);
const CLASS_NAMES = CLASSES.map((c) => c.name);
const MEMBER_STATUS_OPTS = [["active", "在學中"], ["warning", "出席偏低"], ["paused", "暫停中"]];
const MEMBER_COLORS = ["#0066CC", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
const blankMember = () => ({ name: "", initial: "", color: "#0066CC", course: CLASS_NAMES[0], coach: COACH_NAMES[0], status: "active", age: "", parent: "", phone: "", att: 100, points: 0, joined: "2026/06", pay: "trial", remain: 0, lastSeen: "—", recent: [], emName: "", emPhone: "" });

/* Edit-form shell — scrollable body inside a modal */
function EditModal({ open, onClose, title, sub, icon, onSave, saveLabel = "儲存變更", children }) {
  useLucide();
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--df-font-body)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 16, boxShadow: "var(--df-shadow-strong)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "88vh" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--df-border)", display: "flex", alignItems: "center", gap: 12 }}>
          {icon && <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--df-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n={icon} s={20} c="var(--df-primary)" /></div>}
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--df-font-heading)", fontSize: 19, fontWeight: 800, color: "var(--df-ink)" }}>{title}</h3>
            {sub && <div style={{ fontSize: 12.5, color: "var(--df-text-light)", marginTop: 2 }}>{sub}</div>}
          </div>
          <AIconBtn aria-label="關閉" variant="ghost" onClick={onClose}><Ic n="x" s={20} /></AIconBtn>
        </div>
        <div style={{ padding: 24, overflowY: "auto" }}>{children}</div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--df-border)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <ABtn variant="secondary" onClick={onClose}>取消</ABtn>
          <ABtn variant="primary" iconLeft={<Ic n="check" s={16} />} onClick={onSave}>{saveLabel}</ABtn>
        </div>
      </div>
    </div>
  );
}

const blankClass = () => ({ name: "", level: "基礎", cat: CATS[0], coach: COACH_NAMES[0], room: "", day: "", time: "", age: "", cap: 12, price: 3200, status: "招生中", enrolled: 0, wait: 0, term: "2026 春季", sessions: 16 });

function ClassEditDialog({ k, isNew, onClose, onSave }) {
  const [f, setF] = React.useState(k);
  React.useEffect(() => { setF(k); }, [k]);
  if (!k || !f) return null;
  const set = (key) => (e) => setF((p) => ({ ...p, [key]: e.target.value }));
  return (
    <EditModal open={!!k} onClose={onClose} title={isNew ? "新增班級" : "編輯課程"} sub={isNew ? "建立新的開課班級" : "班級編號 " + k.id} icon="calendar-days" saveLabel={isNew ? "建立班級" : "儲存課程"}
      onSave={() => onSave({ ...f, cap: parseInt(f.cap, 10) || 0, price: parseInt(f.price, 10) || 0, enrolled: parseInt(f.enrolled, 10) || 0, sessions: parseInt(f.sessions, 10) || 0, wait: parseInt(f.wait, 10) || 0 })}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <AInput label="班級名稱" value={f.name} onChange={set("name")} style={{ gridColumn: "span 2" }} />
        <ASelect label="分級" value={f.level} onChange={set("level")} options={LEVELS} />
        <ASelect label="課程類別" value={f.cat} onChange={set("cat")} options={CATS} />
        <ASelect label="授課教練" value={f.coach} onChange={set("coach")} options={COACH_NAMES} />
        <AInput label="教室 / 場地" value={f.room} onChange={set("room")} />
        <AInput label="上課日" value={f.day} onChange={set("day")} />
        <AInput label="時段" value={f.time} onChange={set("time")} />
        <AInput label="適合年齡" value={f.age} onChange={set("age")} />
        <AInput label="人數上限" value={String(f.cap)} onChange={set("cap")} />
        <AInput label="本期期別" value={f.term} onChange={set("term")} />
        <AInput label="本期堂數" value={String(f.sessions)} onChange={set("sessions")} />
        <AInput label="季費 (NT$)" value={String(f.price)} onChange={set("price")} />
        <ASelect label="招生狀態" value={f.status} onChange={set("status")} options={CLASS_STATUS} />
      </div>
    </EditModal>
  );
}

function ClassDialog({ k, onClose, onEdit }) {
  if (!k) return null;
  const full = k.enrolled >= k.cap;
  const pct = Math.round((k.enrolled / k.cap) * 100);
  const rows = [["clock", "上課時段", k.day + " · " + k.time], ["user-round", "授課教練", k.coach + " 教練"], ["map-pin", "教室 / 場地", k.room], ["cake", "適合年齡", k.age], ["layers", "課程類別", k.cat], ["calendar-range", "本期期別", k.term], ["calendar-plus", "開課日期", k.startDate], ["repeat-2", "本期堂數", k.sessions + " 堂"], ["percent", "平均到課率", k.checkinRate + "%"], ["user-plus", "候補人數", k.wait + " 人"], ["history", "補課名額", k.makeup + " 位"], ["circle-dollar-sign", "季費", fmtNT(k.price)]];
  return (
    <ADialog open={!!k} onClose={onClose} title="課程資料" width={480}
      primaryAction={{ label: "編輯課程", onClick: () => onEdit(k) }}
      secondaryAction={{ label: "關閉", onClick: onClose }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0 8px" }}>
        <ABadge tone={LEVEL_TONE[k.level] || "primary"}>{k.level}</ABadge>
        <ABadge tone={STATUS_TONE[k.status]} solid={k.status === "額滿"}>{k.status}</ABadge>
        <span style={{ fontSize: 12, color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)" }}>{k.id}</span>
      </div>
      <h3 style={{ margin: "0 0 14px", fontFamily: "var(--df-font-heading)", fontSize: 21, fontWeight: 800, color: "var(--df-ink)" }}>{k.name}</h3>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span style={{ color: "var(--df-text-light)" }}>報名人數</span><span style={{ fontWeight: 700, color: full ? "var(--df-warning)" : "var(--df-text-dark)" }}>{k.enrolled} / {k.cap} 人</span></div>
        <AProg value={pct} height={7} tone={full ? "warning" : "primary"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 18px", borderTop: "1px solid var(--df-border)", paddingTop: 16 }}>
        {rows.map(([ic, kk, v]) => (
          <div key={kk} style={{ display: "flex", alignItems: "center", gap: 9 }}><Ic n={ic} s={16} c="var(--df-primary)" /><div><div style={{ fontSize: 11.5, color: "var(--df-text-muted)" }}>{kk}</div><div style={{ fontSize: 14, color: "var(--df-text-dark)", fontWeight: 500 }}>{v}</div></div></div>
        ))}
      </div>
    </ADialog>
  );
}

function MemberEditDialog({ m, isNew, onClose, onSave }) {
  const [f, setF] = React.useState(m);
  React.useEffect(() => { setF(m); }, [m]);
  if (!m || !f) return null;
  const set = (key) => (e) => setF((p) => ({ ...p, [key]: e.target.value }));
  const statusLabel = (MEMBER_STATUS_OPTS.find(([v]) => v === f.status) || [])[1];
  return (
    <EditModal open={!!m} onClose={onClose} title={isNew ? "新增學員" : "編輯學員資料"} sub={isNew ? "建立新的會員報名資料" : "會員編號 " + m.id} icon="user-round" saveLabel={isNew ? "建立學員" : "儲存資料"}
      onSave={() => { const st = (MEMBER_STATUS_OPTS.find(([, l]) => l === statusLabel) || ["active"])[0]; onSave({ ...f, age: parseInt(f.age, 10) || f.age, status: st, initial: (f.name.trim().charAt(0) || f.initial || "學") }); }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <AAvatar name={(f.name.trim().charAt(0) || f.initial || "學")} size="lg" color={f.color} />
        <div style={{ fontSize: 13, color: "var(--df-text-light)" }}>頭像以姓氏首字顯示{isNew ? "，建立後可隨時編輯" : <React.Fragment><br />入會時間 {m.joined} · {m.points} 點</React.Fragment>}</div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)", marginBottom: 8 }}>代表色 / 頭像底色</div>
        <div style={{ display: "flex", gap: 11 }}>
          {MEMBER_COLORS.map((c) => <button key={c} type="button" aria-label={"選擇 " + c} onClick={() => setF((p) => ({ ...p, color: c }))} style={{ width: 30, height: 30, borderRadius: 999, background: c, border: f.color === c ? "3px solid var(--df-ink)" : "2px solid #fff", boxShadow: "0 0 0 1px var(--df-border)", cursor: "pointer", flex: "none" }} />)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <AInput label="學員姓名" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value, initial: e.target.value.trim().charAt(0) || p.initial }))} />
        <AInput label="年齡" value={String(f.age)} onChange={set("age")} />
        <ASelect label="報名課程" value={f.course} onChange={set("course")} options={CLASS_NAMES} style={{ gridColumn: "span 2" }} />
        <ASelect label="授課教練" value={f.coach} onChange={set("coach")} options={COACH_NAMES} />
        <ASelect label="在學狀態" value={statusLabel} onChange={(e) => { const st = (MEMBER_STATUS_OPTS.find(([, l]) => l === e.target.value) || ["active"])[0]; setF((p) => ({ ...p, status: st })); }} options={MEMBER_STATUS_OPTS.map(([, l]) => l)} />
        <AInput label="家長" value={f.parent} onChange={set("parent")} />
        <AInput label="聯絡電話" value={f.phone} onChange={set("phone")} />
      </div>
    </EditModal>
  );
}

/* ===== 總覽 ===== */
function AdminHome({ notify, setView }) {
  useLucide();
  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="營運總覽" sub="2026 年 6 月 10 日 · 全館即時概況" actions={
        <React.Fragment>
          <ABtn variant="secondary" size="sm" iconLeft={<Ic n="download" s={15} />} onClick={() => notify("info", "報表匯出中", "本月營運報表將於背景產生並寄送至您的信箱。")}>匯出報表</ABtn>
          <ABtn variant="primary" size="sm" iconLeft={<Ic n="plus" s={15} />} onClick={() => setView("classes")}>新增課程</ABtn>
        </React.Fragment>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <StatCard icon="users" label="在學學員" value="248" delta="+12" up tint="var(--df-primary-bg)" color="var(--df-primary)" />
        <StatCard icon="calendar-check" label="本週課堂" value="64" delta="+4" up tint="var(--df-success-bg)" color="var(--df-success)" />
        <StatCard icon="receipt" label="本月營收" value="NT$182K" delta="+8%" up tint="#FFF8DB" color="var(--df-accent-dark)" />
        <StatCard icon="user-x" label="出席偏低" value="6" delta="-2" up tint="var(--df-warning-bg)" color="var(--df-warning)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, alignItems: "start" }}>
        <MembersTable notify={notify} compact />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <TodayPanel data={TODAY} sub="全館 5 堂課" notify={notify} />
          <ActivityPanel />
        </div>
      </div>
    </div>
  );
}

function TodayPanel({ data, sub, notify }) {
  return (
    <ACard padding={0} style={{ overflow: "hidden" }}>
      <PanelHead title="今日課表" sub={sub} right={<Ic n="calendar-days" s={18} c="var(--df-text-muted)" />} />
      <div style={{ padding: "6px 22px 14px" }}>
        {data.map((t, i) => (
          <div key={i} className="df-rowhover" style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 0", borderBottom: i < data.length - 1 ? "1px solid var(--df-border)" : "none" }}>
            <div style={{ fontFamily: "var(--df-font-mono)", fontSize: 14, fontWeight: 600, color: "var(--df-ink)", width: 46 }}>{t.time}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--df-text-dark)" }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "var(--df-text-light)" }}>{t.coach} 教練 · {t.room} · {t.count} 人</div>
            </div>
            <ABadge tone={t.tone} dot>{t.label}</ABadge>
          </div>
        ))}
      </div>
    </ACard>
  );
}

function ActivityPanel() {
  return (
    <ACard padding={0} style={{ overflow: "hidden" }}>
      <PanelHead title="最新動態" right={<Ic n="activity" s={18} c="var(--df-text-muted)" />} />
      <div style={{ padding: "8px 22px 16px" }}>
        {ACTIVITY.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: i < ACTIVITY.length - 1 ? "1px solid var(--df-border)" : "none" }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n={a.icon} s={16} c={a.tone} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "var(--df-text-dark)", lineHeight: 1.5 }}>{a.text}</div>
              <div style={{ fontSize: 11.5, color: "var(--df-text-muted)", marginTop: 2 }}>{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </ACard>
  );
}

/* ===== Members table (shared by 總覽 + 學員) ===== */
function MemberDialog({ m, onClose, onEdit }) {
  if (!m) return null;
  const rows = [["會員編號", m.id], ["年齡", m.age + " 歲"], ["所屬分校", m.campus], ["會員分級", m.tier], ["報名課程", m.course], ["授課教練", m.coach + " 教練"], ["繳費狀態", (PAY_STATUS[m.pay] || ["", "-"])[1]], ["剩餘堂數", m.remain + " 堂"], ["續費到期", m.renewDue], ["最近出席", m.lastSeen], ["報名來源", m.source], ["生日", m.birthday], ["家長", m.parent], ["聯絡電話", m.phone], ["LINE", m.lineId], ["緊急聯絡人", m.emName + " · " + m.emPhone], ["入會時間", m.joined], ["會員點數", m.points + " 點"]];
  return (
    <ADialog open={!!m} onClose={onClose} title="學員資料" width={460}
      primaryAction={{ label: "編輯資料", onClick: () => onEdit(m) }}
      secondaryAction={{ label: "關閉", onClick: onClose }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "4px 0 18px" }}>
        <AAvatar name={m.initial} size="lg" color={m.color} />
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>{m.name}</div>
          <div style={{ marginTop: 5 }}><MemberStatusBadge s={m.status} /></div>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span style={{ color: "var(--df-text-light)" }}>本月出席率</span><span style={{ fontWeight: 700, color: "var(--df-text-dark)" }}>{m.att}%</span></div>
        <AProg value={m.att} height={7} tone={m.att >= 80 ? "success" : "warning"} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--df-text-muted)", marginBottom: 6 }}><span>近六堂出席</span><span>出 · 缺 · 遲 · 假</span></div>
        <div style={{ display: "flex", gap: 6 }}>{(m.recent || []).map((mk, i) => { const [c, lbl] = (ATT_MARK[mk] || ATT_MARK.p); return <span key={i} style={{ width: 24, height: 24, borderRadius: 7, background: c + "1F", color: c, fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{lbl}</span>; })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 18px", borderTop: "1px solid var(--df-border)", paddingTop: 16 }}>
        {rows.map(([k, v]) => (
          <div key={k}><div style={{ fontSize: 11.5, color: "var(--df-text-muted)", marginBottom: 2 }}>{k}</div><div style={{ fontSize: 14, color: "var(--df-text-dark)", fontWeight: 500, fontFamily: k === "會員編號" ? "var(--df-font-mono)" : "inherit" }}>{v}</div></div>
        ))}
      </div>
    </ADialog>
  );
}

function MembersTable({ notify, compact = false, search = "" }) {
  const [tab, setTab] = React.useState("all");
  const [active, setActive] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [addNew, setAddNew] = React.useState(false);
  const [members, setMembers] = React.useState(MEMBERS);
  const [sort, setSort] = React.useState({ key: null, dir: "desc" });
  useLucide();
  const counts = { all: members.length, active: members.filter((m) => m.status === "active").length, warning: members.filter((m) => m.status === "warning").length, paused: members.filter((m) => m.status === "paused").length };
  let rows = members.filter((m) => tab === "all" || m.status === tab);
  if (search) rows = rows.filter((m) => (m.name + m.id + m.course).toLowerCase().includes(search.toLowerCase()));
  if (sort.key) { const f = (m) => m[sort.key]; rows = [...rows].sort((a, b) => sort.dir === "desc" ? f(b) - f(a) : f(a) - f(b)); }
  if (compact) rows = rows.slice(0, 6);
  const cols = compact ? ["學員", "課程", "出席率", "狀態", ""] : ["學員", "課程", "分校", "授課教練", "出席率", "繳費", "狀態", ""];
  return (
    <ACard padding={0} style={{ overflow: "hidden" }}>
      <PanelHead title="學員名單" sub={compact ? "最近活躍 6 位" : counts.all + " 位在學學員"} right={<ABtn size="sm" variant="primary" iconLeft={<Ic n="plus" s={15} />} onClick={() => { setActive(null); setEditing(blankMember()); setAddNew(true); }}>新增學員</ABtn>} />
      {!compact && (
        <div style={{ padding: "4px 22px 0" }}>
          <ATabs value={tab} onChange={setTab} tabs={[{ value: "all", label: "全部", count: counts.all }, { value: "active", label: "在學中", count: counts.active }, { value: "warning", label: "出席偏低", count: counts.warning }, { value: "paused", label: "暫停中", count: counts.paused }]} />
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--df-bg-light)" }}>
            {cols.map((h, i) => { const sortable = !compact && h === "出席率"; const onSort = () => setSort((s) => ({ key: "att", dir: s.key === "att" && s.dir === "desc" ? "asc" : "desc" })); return <th key={i} onClick={sortable ? onSort : undefined} style={{ textAlign: i === cols.length - 1 ? "right" : "left", padding: "11px 22px", fontSize: 11.5, fontWeight: 600, color: sortable ? "var(--df-text-dark)" : "var(--df-text-light)", letterSpacing: "0.03em", cursor: sortable ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>{h}{sortable && <span style={{ marginLeft: 4, opacity: sort.key === "att" ? 1 : 0.35 }}>{sort.key === "att" && sort.dir === "asc" ? "↑" : "↓"}</span>}</th>; })}
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => (
            <tr key={m.id} className="df-rowhover" onClick={() => setActive(m)} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--df-border)" : "none", cursor: "pointer" }}>
              <td style={{ padding: "13px 22px" }}><div style={{ display: "flex", alignItems: "center", gap: 11 }}><AAvatar name={m.initial} size="sm" color={m.color} /><div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--df-text-dark)" }}>{m.name}</div><div style={{ fontSize: 11.5, color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)" }}>{m.id}</div></div></div></td>
              <td style={{ padding: "13px 22px", fontSize: 13.5, color: "var(--df-text-light)" }}>{m.course}</td>
              {!compact && <td style={{ padding: "13px 22px", fontSize: 13.5, color: "var(--df-text-light)" }}>{m.campus}</td>}
              {!compact && <td style={{ padding: "13px 22px", fontSize: 13.5, color: "var(--df-text-light)" }}>{m.coach}</td>}
              <td style={{ padding: "13px 22px", width: 150 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1 }}><AProg value={m.att} height={6} tone={m.att >= 80 ? "success" : "warning"} /></div><span style={{ fontSize: 13, fontWeight: 700, color: "var(--df-text-dark)", width: 34, textAlign: "right" }}>{m.att}%</span></div></td>
              {!compact && <td style={{ padding: "13px 22px" }}><ABadge tone={(PAY_STATUS[m.pay] || ["neutral"])[0]}>{(PAY_STATUS[m.pay] || ["", "-"])[1]}</ABadge></td>}
              <td style={{ padding: "13px 22px" }}><MemberStatusBadge s={m.status} /></td>
              <td style={{ padding: "13px 22px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}><AIconBtn aria-label="檢視" variant="ghost" onClick={() => setActive(m)}><Ic n="chevron-right" s={18} c="var(--df-text-light)" /></AIconBtn></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: "40px 22px", textAlign: "center", color: "var(--df-text-muted)", fontSize: 14 }}>找不到符合的學員</td></tr>}
        </tbody>
      </table>
      <MemberDialog m={active} onClose={() => setActive(null)} onEdit={(m) => { setActive(null); setAddNew(false); setEditing(m); }} />
      <MemberEditDialog m={editing} isNew={addNew} onClose={() => { setEditing(null); setAddNew(false); }} onSave={(updated) => {
        if (addNew) { const id = "GY2026" + String(members.length + 1).padStart(3, "0"); setMembers((ms) => [{ ...updated, id }, ...ms]); notify("success", "已新增學員", updated.name + " 已建立報名資料。"); }
        else { setMembers((ms) => ms.map((x) => (x.id === updated.id ? updated : x))); notify("success", "已儲存", updated.name + " 的資料已更新。"); }
        setEditing(null); setAddNew(false);
      }} />
    </ACard>
  );
}

function MembersView({ notify, search }) {
  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="學員管理" sub="管理報名、出席與會員資料" actions={<ABtn variant="secondary" size="sm" iconLeft={<Ic n="filter" s={15} />}>進階篩選</ABtn>} />
      <MembersTable notify={notify} search={search} />
    </div>
  );
}

/* ===== 課程管理 ===== */
const LEVEL_TONE = { 啟蒙: "info", 入門: "info", 基礎: "primary", 進階: "warning", 選手: "accent" };
const STATUS_TONE = { "招生中": "success", "候補": "warning", "額滿": "neutral" };

function ClassCard({ k, notify, onEdit, onOpen }) {
  const full = k.enrolled >= k.cap;
  const pct = Math.round((k.enrolled / k.cap) * 100);
  return (
    <ACard padding={0} hoverable style={{ overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--df-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div onClick={onOpen} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <ABadge tone={LEVEL_TONE[k.level] || "primary"}>{k.level}</ABadge>
              <ABadge tone={STATUS_TONE[k.status]} solid={k.status === "額滿"}>{k.status}</ABadge>
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>{k.name}</h3>
          </div>
          <AIconBtn aria-label="詳情" variant="ghost" onClick={onOpen}><Ic n="more-horizontal" s={18} c="var(--df-text-light)" /></AIconBtn>
        </div>
      </div>
      <div onClick={onOpen} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 11, cursor: "pointer" }}>
        {[["user", k.coach + " 教練"], ["calendar-days", k.day + " · " + k.time], ["map-pin", k.room + " · " + k.age]].map(([ic, txt]) => (
          <div key={txt} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--df-text-light)" }}><Ic n={ic} s={15} c="var(--df-text-muted)" />{txt}</div>
        ))}
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}><span style={{ color: "var(--df-text-light)" }}>報名人數</span><span style={{ fontWeight: 700, color: full ? "var(--df-warning)" : "var(--df-text-dark)" }}>{k.enrolled} / {k.cap} 人</span></div>
          <AProg value={pct} height={7} tone={full ? "warning" : "primary"} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 20px 18px" }}>
        <ABtn variant="secondary" size="sm" fullWidth iconLeft={<Ic n="users" s={14} />} onClick={() => notify("info", k.name, "顯示班級學員名單（" + k.enrolled + " 人）。")}>學員</ABtn>
        <ABtn variant="primary" size="sm" fullWidth iconLeft={<Ic n="pencil-line" s={14} />} onClick={onEdit}>編輯</ABtn>
      </div>
    </ACard>
  );
}

function ClassesView({ notify, search }) {
  const [cat, setCat] = React.useState("全部");
  const [classes, setClasses] = React.useState(CLASSES);
  const [edit, setEdit] = React.useState(null);
  const [addNew, setAddNew] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const cats = ["全部", "幼兒體操", "兒童基礎", "競技啦啦隊", "競技體操", "成人體操", "跑酷"];
  let list = classes.filter((k) => cat === "全部" || k.cat === cat);
  if (search) list = list.filter((k) => (k.name + k.coach).toLowerCase().includes(search.toLowerCase()));
  useLucide();
  const openEdit = (k) => { setDetail(null); setAddNew(false); setEdit(k); };
  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="課程管理" sub={classes.length + " 個開課班級 · 本季招生中"} actions={<ABtn variant="primary" size="sm" iconLeft={<Ic n="plus" s={15} />} onClick={() => { setDetail(null); setEdit(blankClass()); setAddNew(true); }}>新增班級</ABtn>} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {cats.map((c) => <ATag key={c} selected={cat === c} onClick={() => setCat(c)}>{c}</ATag>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16 }}>
        {list.map((k) => <ClassCard key={k.id} k={k} notify={notify} onEdit={() => openEdit(k)} onOpen={() => setDetail(k)} />)}
      </div>
      <ClassDialog k={detail} onClose={() => setDetail(null)} onEdit={openEdit} />
      <ClassEditDialog k={edit} isNew={addNew} onClose={() => { setEdit(null); setAddNew(false); }} onSave={(updated) => {
        if (addNew) { const id = "k" + (classes.length + 1); setClasses((cs) => [{ ...updated, id }, ...cs]); notify("success", "已新增班級", "「" + updated.name + "」已建立。"); }
        else { setClasses((cs) => cs.map((c) => (c.id === updated.id ? updated : c))); notify("success", "已儲存課程", "「" + updated.name + "」已更新。"); }
        setEdit(null); setAddNew(false);
      }} />
    </div>
  );
}

/* ===== 教練 ===== */
const COACH_STATUS_OPTS = [["online", "線上"], ["busy", "忙碌"], ["offline", "離線"]];
const blankCoach = () => ({ name: "", initial: "", color: "#0066CC", title: "", tagsText: "", years: 0, students: 0, classes: 0, awards: 0, phone: "", status: "online" });

function CoachEditDialog({ c, isNew, onClose, onSave }) {
  const [f, setF] = React.useState(null);
  React.useEffect(() => { setF(c ? { ...c, tagsText: c.tagsText != null ? c.tagsText : (c.tags || []).join("、") } : null); }, [c]);
  if (!c || !f) return null;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const stLabel = (COACH_STATUS_OPTS.find(([v]) => v === f.status) || ["", "線上"])[1];
  const save = () => onSave({
    ...f, initial: (f.name.trim().charAt(0) || f.initial || "教"),
    tags: f.tagsText.split(/[、,，]/).map((t) => t.trim()).filter(Boolean),
    years: parseInt(f.years, 10) || 0, students: parseInt(f.students, 10) || 0, classes: parseInt(f.classes, 10) || 0, awards: parseInt(f.awards, 10) || 0,
  });
  return (
    <EditModal open={!!c} onClose={onClose} title={isNew ? "新增教練" : "編輯教練"} sub={isNew ? "建立教練檔案" : f.name + " 教練"} icon="user-check" saveLabel={isNew ? "建立教練" : "儲存"} onSave={save}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <AAvatar name={(f.name.trim().charAt(0) || f.initial || "教")} size="lg" color={f.color} />
        <div style={{ display: "flex", gap: 9 }}>
          {MEMBER_COLORS.map((col) => <button key={col} type="button" aria-label={"選擇 " + col} onClick={() => setF((p) => ({ ...p, color: col }))} style={{ width: 28, height: 28, borderRadius: 999, background: col, border: f.color === col ? "3px solid var(--df-ink)" : "2px solid #fff", boxShadow: "0 0 0 1px var(--df-border)", cursor: "pointer", flex: "none" }} />)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <AInput label="教練姓名" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value, initial: e.target.value.trim().charAt(0) || p.initial }))} />
        <ASelect label="目前狀態" value={stLabel} onChange={(e) => { const code = (COACH_STATUS_OPTS.find(([, l]) => l === e.target.value) || ["online"])[0]; setF((p) => ({ ...p, status: code })); }} options={COACH_STATUS_OPTS.map(([, l]) => l)} />
        <AInput label="職稱 / 專業" value={f.title} onChange={set("title")} style={{ gridColumn: "span 2" }} />
        <AInput label="專長標籤（以、分隔）" value={f.tagsText} onChange={set("tagsText")} style={{ gridColumn: "span 2" }} />
        <AInput label="年資（年）" value={String(f.years)} onChange={set("years")} />
        <AInput label="聯絡電話" value={f.phone} onChange={set("phone")} />
        <AInput label="學員數" value={String(f.students)} onChange={set("students")} />
        <AInput label="班級數" value={String(f.classes)} onChange={set("classes")} />
        <AInput label="競賽獲獎數" value={String(f.awards)} onChange={set("awards")} />
      </div>
    </EditModal>
  );
}

function CoachesView({ notify }) {
  const [coaches, setCoaches] = React.useState(COACHES);
  const [edit, setEdit] = React.useState(null);
  const [addNew, setAddNew] = React.useState(false);
  useLucide();
  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="教練團隊" sub={coaches.length + " 位專任教練"} actions={<ABtn variant="primary" size="sm" iconLeft={<Ic n="user-plus" s={15} />} onClick={() => { setEdit(blankCoach()); setAddNew(true); }}>新增教練</ABtn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
        {coaches.map((c) => (
          <ACard key={c.id} padding={0} hoverable style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 14, padding: "20px 20px 16px" }}>
              <AAvatar name={c.initial} size="lg" color={c.color} status={c.status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>{c.name} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--df-text-muted)" }}>教練</span></div>
                <div style={{ fontSize: 12.5, color: "var(--df-primary)", marginTop: 3, lineHeight: 1.4 }}>{c.title}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>{c.tags.map((t) => <ATag key={t}>{t}</ATag>)}</div>
              </div>
              <AIconBtn aria-label="編輯教練" variant="ghost" onClick={() => { setAddNew(false); setEdit(c); }}><Ic n="pencil-line" s={17} c="var(--df-text-light)" /></AIconBtn>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderTop: "1px solid var(--df-border)" }}>
              {[[c.years, "年資"], [c.students, "學員"], [c.classes, "班級"], [c.awards, "獲獎"]].map(([v, l], i) => (
                <div key={l} style={{ padding: "14px 0", textAlign: "center", borderLeft: i ? "1px solid var(--df-border)" : "none" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>{v}</div>
                  <div style={{ fontSize: 11.5, color: "var(--df-text-light)", marginTop: 1 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--df-border)" }}>
              <ABtn variant="secondary" size="sm" fullWidth iconLeft={<Ic n="phone" s={14} />} onClick={() => notify("info", c.name + " 教練", c.phone)}>聯絡</ABtn>
              <ABtn variant="secondary" size="sm" fullWidth iconLeft={<Ic n="calendar-days" s={14} />} onClick={() => notify("info", "課表", "顯示 " + c.name + " 教練的授課時段。")}>課表</ABtn>
            </div>
          </ACard>
        ))}
      </div>
      <CoachEditDialog c={edit} isNew={addNew} onClose={() => { setEdit(null); setAddNew(false); }} onSave={(updated) => {
        if (addNew) { const id = "c" + (coaches.length + 1); setCoaches((cs) => [...cs, { ...updated, id }]); notify("success", "已新增教練", updated.name + " 教練已建檔。"); }
        else { setCoaches((cs) => cs.map((x) => (x.id === updated.id ? updated : x))); notify("success", "已儲存", updated.name + " 教練資料已更新。"); }
        setEdit(null); setAddNew(false);
      }} />
    </div>
  );
}

/* ===== 訂單 ===== */
function OrderDialog({ o, onClose, onMarkPaid, onRemind }) {
  if (!o) return null;
  const [tone, label] = ORDER_STATUS[o.status];
  const rows = [["訂單編號", o.id, "var(--df-font-mono)"], ["學員", o.member], ["項目", o.item], ["所屬分校", o.campus], ["優惠", o.discount], ["付款方式", o.method], ["收款時間", o.paidAt, "var(--df-font-mono)"], ["未稅金額", fmtNT(o.net), "var(--df-font-mono)"], ["營業稅 5%", fmtNT(o.tax), "var(--df-font-mono)"], ["發票號碼", o.invoice, "var(--df-font-mono)"], ["統一編號", o.taxId, "var(--df-font-mono)"], ["經手人", o.handler], ["建立時間", o.date, "var(--df-font-mono)"]];
  if (o.reason) rows.push(["退款原因", o.reason]);
  return (
    <ADialog open={!!o} onClose={onClose} title="訂單明細" width={460}
      primaryAction={o.status === "pending" ? { label: "標記已付款", onClick: () => onMarkPaid(o) } : { label: "關閉", onClick: onClose }}
      secondaryAction={o.status === "pending" ? { label: "發送催繳", onClick: () => onRemind(o) } : null}>
      <div style={{ textAlign: "center", padding: "2px 0 14px" }}>
        <div style={{ fontSize: 12.5, color: "var(--df-text-light)" }}>訂單金額</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)", margin: "4px 0 8px" }}>{fmtNT(o.amount)}</div>
        <ABadge tone={tone} dot>{label}</ABadge>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 18px", borderTop: "1px solid var(--df-border)", paddingTop: 16 }}>
        {rows.map(([k, v, fnt]) => (
          <div key={k}><div style={{ fontSize: 11.5, color: "var(--df-text-muted)", marginBottom: 2 }}>{k}</div><div style={{ fontSize: 14, color: "var(--df-text-dark)", fontWeight: 500, fontFamily: fnt || "inherit" }}>{v}</div></div>
        ))}
      </div>
    </ADialog>
  );
}

function OrdersView({ notify, search }) {
  const [tab, setTab] = React.useState("all");
  const [orders, setOrders] = React.useState(ORDERS);
  const [active, setActive] = React.useState(null);
  useLucide();
  const counts = { all: orders.length, paid: orders.filter((o) => o.status === "paid").length, pending: orders.filter((o) => o.status === "pending").length, refunded: orders.filter((o) => o.status === "refunded").length };
  let rows = orders.filter((o) => tab === "all" || o.status === tab);
  if (search) rows = rows.filter((o) => (o.id + o.member + o.item).toLowerCase().includes(search.toLowerCase()));
  const revenue = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount, 0);
  const markPaid = (o) => { setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status: "paid" } : x))); setActive(null); notify("success", "已標記收款", o.id + " · " + fmtNT(o.amount) + " 已入帳。"); };
  const remind = (o) => { setActive(null); notify("info", "已發送催繳", o.member + " 將收到繳費提醒。"); };
  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="訂單與金流" sub="報名繳費紀錄" actions={<ABtn variant="secondary" size="sm" iconLeft={<Ic n="download" s={15} />} onClick={() => notify("info", "匯出對帳單", "本月對帳單將寄送至財務信箱。")}>匯出對帳單</ABtn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <StatCard icon="circle-dollar-sign" label="本月已收" value={fmtNT(revenue)} tint="var(--df-success-bg)" color="var(--df-success)" />
        <StatCard icon="clock" label="待付款" value={counts.pending + " 筆"} tint="var(--df-warning-bg)" color="var(--df-warning)" />
        <StatCard icon="receipt" label="本月訂單" value={counts.all + " 筆"} tint="var(--df-primary-bg)" color="var(--df-primary)" />
        <StatCard icon="rotate-ccw" label="退款" value={counts.refunded + " 筆"} tint="var(--df-bg-light)" color="var(--df-text-light)" />
      </div>
      <ACard padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "12px 22px 0" }}>
          <ATabs value={tab} onChange={setTab} tabs={[{ value: "all", label: "全部", count: counts.all }, { value: "paid", label: "已付款", count: counts.paid }, { value: "pending", label: "待付款", count: counts.pending }, { value: "refunded", label: "已退款", count: counts.refunded }]} />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--df-bg-light)" }}>
              {["訂單編號", "學員", "項目", "優惠", "金額", "付款方式", "經手人", "狀態", "時間"].map((h, i) => <th key={h} style={{ textAlign: i === 4 ? "right" : "left", padding: "11px 22px", fontSize: 11.5, fontWeight: 600, color: "var(--df-text-light)" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((o, i) => {
              const [tone, label] = ORDER_STATUS[o.status];
              return (
                <tr key={o.id} className="df-rowhover" onClick={() => setActive(o)} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--df-border)" : "none", cursor: "pointer" }}>
                  <td style={{ padding: "13px 22px", fontFamily: "var(--df-font-mono)", fontSize: 13, fontWeight: 600, color: "var(--df-primary)" }}>{o.id}</td>
                  <td style={{ padding: "13px 22px" }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><AAvatar name={o.initial} size="xs" color={o.color} /><span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--df-text-dark)" }}>{o.member}</span></div></td>
                  <td style={{ padding: "13px 22px", fontSize: 13, color: "var(--df-text-light)" }}>{o.item}</td>
                  <td style={{ padding: "13px 22px", fontSize: 13, color: o.discount === "—" ? "var(--df-text-muted)" : "var(--df-text-light)" }}>{o.discount}</td>
                  <td style={{ padding: "13px 22px", textAlign: "right", fontFamily: "var(--df-font-mono)", fontSize: 13.5, fontWeight: 700, color: "var(--df-text-dark)" }}>{fmtNT(o.amount)}</td>
                  <td style={{ padding: "13px 22px", fontSize: 13, color: "var(--df-text-light)" }}>{o.method}</td>
                  <td style={{ padding: "13px 22px", fontSize: 13, color: "var(--df-text-light)" }}>{o.handler}</td>
                  <td style={{ padding: "13px 22px" }}><ABadge tone={tone} dot>{label}</ABadge></td>
                  <td style={{ padding: "13px 22px", fontSize: 12.5, color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)" }}>{o.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ACard>
      <OrderDialog o={active} onClose={() => setActive(null)} onMarkPaid={markPaid} onRemind={remind} />
    </div>
  );
}

/* ===== 設定 ===== */
function SettingsRow({ title, desc, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, padding: "16px 0", borderBottom: "1px solid var(--df-border)" }}>
      <div><div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--df-text-dark)" }}>{title}</div><div style={{ fontSize: 12.5, color: "var(--df-text-light)", marginTop: 2 }}>{desc}</div></div>
      <div style={{ flex: "none" }}>{children}</div>
    </div>
  );
}

function SettingsView({ notify }) {
  const [s, setS] = React.useState({ email: true, sms: false, lowAtt: true, autoWait: true });
  const [twoFA, setTwoFA] = React.useState(true);
  const [pwOpen, setPwOpen] = React.useState(false);
  const set = (k) => (v) => setS((p) => ({ ...p, [k]: v }));
  useLucide();
  const LOGINS = [
    { icon: "monitor", device: "MacBook · Chrome", place: "台中 · 办公室", time: "目前使用中", now: true },
    { icon: "smartphone", device: "iPhone · Dream Fly App", place: "台中 · 行動網路", time: "今天 08:14", now: false },
    { icon: "tablet", device: "iPad · Safari", place: "台中 · 場館 Wi-Fi", time: "昨天 19:32", now: false },
  ];
  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      <PageHead title="系統設定" sub="場館資訊、通知與權限" />
      <ACard padding={24}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--df-ink)" }}>場館資訊</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--df-text-light)" }}>顯示於官網與報名通知</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <AInput label="場館名稱" value="Dream Fly 夢飛體操館" onChange={() => {}} />
          <AInput label="聯絡電話" value="04-2376-1688" onChange={() => {}} />
          <AInput label="地址" value="台中市西區美村路一段 168 號" onChange={() => {}} style={{ gridColumn: "span 2" }} />
          <ASelect label="預設師生比" value="1:6" onChange={() => {}} options={["1:4", "1:6", "1:8"]} />
          <ASelect label="每班人數上限" value="12 人" onChange={() => {}} options={["8 人", "10 人", "12 人"]} />
        </div>
      </ACard>
      <ACard padding={24}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "var(--df-ink)" }}>通知與自動化</h3>
        <SettingsRow title="Email 通知" desc="報名、繳費與請假以 Email 通知家長"><ASwitch checked={s.email} onChange={set("email")} /></SettingsRow>
        <SettingsRow title="簡訊提醒" desc="課前一日發送簡訊提醒（需加購點數）"><ASwitch checked={s.sms} onChange={set("sms")} /></SettingsRow>
        <SettingsRow title="出席偏低警示" desc="學員出席率低於 75% 時通知管理員"><ASwitch checked={s.lowAtt} onChange={set("lowAtt")} /></SettingsRow>
        <SettingsRow title="自動候補遞補" desc="額滿班級有人退出時自動通知候補學員"><ASwitch checked={s.autoWait} onChange={set("autoWait")} /></SettingsRow>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <ABtn variant="primary" iconLeft={<Ic n="check" s={16} />} onClick={() => notify("success", "已儲存", "系統設定已更新。")}>儲存變更</ABtn>
        </div>
      </ACard>
      <ACard padding={24}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "var(--df-ink)" }}>帳號與安全</h3>
        <SettingsRow title="變更密碼" desc="上次更新於 2026/03/12"><ABtn variant="secondary" size="sm" onClick={() => setPwOpen(true)}>變更密碼</ABtn></SettingsRow>
        <SettingsRow title="雙重驗證（2FA）" desc={twoFA ? "已啟用 · 登入時需輸入動態驗證碼" : "建議啟用以提升帳號安全"}><ASwitch checked={twoFA} onChange={(v) => { setTwoFA(v); notify(v ? "success" : "warning", v ? "已啟用雙重驗證" : "已關閉雙重驗證", v ? "下次登入將需要動態驗證碼。" : "您的帳號安全性已降低。"); }} /></SettingsRow>
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--df-text-dark)" }}>登入裝置</div>
            <button onClick={() => notify("warning", "已登出其他裝置", "除目前裝置外，所有工作階段已結束。")} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--df-border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, color: "var(--df-error)", cursor: "pointer", fontFamily: "var(--df-font-body)" }}><Ic n="log-out" s={14} c="var(--df-error)" />登出其他裝置</button>
          </div>
          {LOGINS.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 0", borderBottom: i < LOGINS.length - 1 ? "1px solid var(--df-border)" : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--df-bg-light)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n={l.icon} s={17} c="var(--df-text-light)" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--df-text-dark)" }}>{l.device}</div>
                <div style={{ fontSize: 12, color: "var(--df-text-light)", marginTop: 1 }}>{l.place}</div>
              </div>
              {l.now ? <ABadge tone="success" dot>{l.time}</ABadge> : <span style={{ fontSize: 12.5, color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)" }}>{l.time}</span>}
            </div>
          ))}
        </div>
      </ACard>
      <EditModal open={pwOpen} onClose={() => setPwOpen(false)} title="變更密碼" icon="key-round" saveLabel="更新密碼" onSave={() => { setPwOpen(false); notify("success", "密碼已更新", "請於下次登入使用新密碼。"); }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AInput label="目前密碼" type="password" placeholder="••••••••" />
          <AInput label="新密碼" type="password" placeholder="至少 8 碼，含英數" />
          <AInput label="確認新密碼" type="password" placeholder="再次輸入新密碼" />
        </div>
      </EditModal>
    </div>
  );
}

Object.assign(window, { AdminHome, MembersView, ClassesView, CoachesView, OrdersView, SettingsView });
