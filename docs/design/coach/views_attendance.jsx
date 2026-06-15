























  const init = React.useMemo(() => Object.fromEntries(ATT_ROSTER.map((r) => [r.mid, r.def])), []);
  const [marks, setMarks] = React.useState(init);
  const [notes, setNotes] = React.useState({});
  const [noteFor, setNoteFor] = React.useState(null);
  const [noteText, setNoteText] = React.useState("");
  const [state, setState] = React.useState("dirty"); // dirty | saving | saved
  const [savedAt, setSavedAt] = React.useState(null);
  const dirtyCount = React.useRef(3);

  const setMark = (mid, v) => { setMarks((p) => ({ ...p, [mid]: v })); setState("dirty"); dirtyCount.current += 1; };
  const openNote = (r) => { setNoteFor(r); setNoteText(notes[r.mid] || ""); };
  const saveNote = () => { setNotes((p) => ({ ...p, [noteFor.mid]: noteText })); setNoteFor(null); };

  const tally = ATT_ROSTER.reduce((a, r) => { const k = marks[r.mid]; a[k] = (a[k] || 0) + 1; return a; }, {});
  const chips = [
    { key: "present", label: "出席", color: "var(--df-success)", n: tally.present || 0 },
    { key: "late", label: "遲到", color: "var(--df-warning)", n: tally.late || 0 },
    { key: "leave", label: "請假", color: "var(--df-info)", n: tally.leave || 0 },
    { key: "absent", label: "缺席", color: "var(--df-error)", n: tally.absent || 0 },
    { key: "total", label: "共 " + ATT_ROSTER.length + " 人", color: "var(--df-text-muted)", n: ATT_ROSTER.length },
  ];

  const doSave = () => {
    setState("saving");
    setTimeout(() => {
      setState("saved");
      const t = "14:" + String(30 + Math.floor(Math.random() * 9)).padStart(2, "0");
      setSavedAt(t);
      dirtyCount.current = 0;
      notify("success", "點名已儲存", ATT_CLASS.name + " · " + ATT_ROSTER.length + " 位學員出勤已同步至雲端。");
    }, 1100);
  };
  const markAll = () => { setMarks(Object.fromEntries(ATT_ROSTER.map((r) => [r.mid, r.def === "leave" ? "leave" : "present"]))); setState("dirty"); };

  const SS = {
    dirty: { icon: "circle-alert", tone: "var(--df-warning)", bg: "var(--df-warning-bg)", title: "尚未儲存", desc: dirtyCount.current + " 筆出席變更尚未儲存，離開前請記得儲存" },
    saving: { icon: "loader", tone: "var(--df-primary)", bg: "var(--df-primary-bg)", title: "儲存中…", desc: "正在同步至雲端，請勿關閉頁面" },
    saved: { icon: "circle-check-big", tone: "var(--df-success)", bg: "var(--df-success-bg)", title: "已儲存", desc: (savedAt || "14:32") + " 已同步至雲端 · 全部 " + ATT_ROSTER.length + " 位學員" },
  }[state];

  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>
      {/* class selector */}
      <ACard padding={20}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--df-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n="dumbbell" s={24} c="var(--df-primary)" /></div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>{ATT_CLASS.name}</div>
              <div style={{ display: "flex", gap: 14, marginTop: 5, flexWrap: "wrap" }}>
                {[["clock", ATT_CLASS.time], ["map-pin", ATT_CLASS.room], ["user", "授課教練：" + ATT_CLASS.coach]].map(([ic, t]) => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--df-text-light)" }}><Ic n={ic} s={13} c="var(--df-text-muted)" />{t}</span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => notify("info", "切換班級", "選擇其他今日班級進行點名（示範）。")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--df-border)", background: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)", cursor: "pointer", fontFamily: "var(--df-font-body)" }}>切換班級 <Ic n="chevron-down" s={15} c="var(--df-text-muted)" /></button>
        </div>
      </ACard>

      {/* summary strip */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {chips.map((c) => (
          <div key={c.key} style={{ flex: "1 1 120px", background: "#fff", border: "1px solid var(--df-border)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: c.color, flex: "none" }} />
            <span style={{ fontSize: 13, color: "var(--df-text-light)", flex: 1 }}>{c.label}</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>{c.n}</span>
          </div>
        ))}
      </div>

      {/* roster */}
      <ACard padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--df-border)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--df-ink)" }}>學員名單</h3>
            <div style={{ fontSize: 12.5, color: "var(--df-text-light)", marginTop: 2 }}>點選狀態以記錄出席</div>
          </div>
          <button onClick={markAll} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--df-border)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "var(--df-text-light)", cursor: "pointer", fontFamily: "var(--df-font-body)" }}><Ic n="check-check" s={15} />全部標記出席</button>
        </div>
        <div>
          {ATT_ROSTER.map((r, i) => {
            const onLeave = r.def === "leave";
            return (
              <div key={r.mid} className="df-rowhover" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: i < ATT_ROSTER.length - 1 ? "1px solid var(--df-border)" : "none" }}>
                <span style={{ fontFamily: "var(--df-font-mono)", fontSize: 14, fontWeight: 600, color: "var(--df-text-muted)", width: 24 }}>{r.n}</span>
                <span style={{ width: 38, height: 38, borderRadius: "50%", background: r.color, color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{r.initial}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--df-text-dark)" }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)" }}>會員編號：{r.mid}</div>
                </div>
                {notes[r.mid] && <span title={notes[r.mid]} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--df-bg-light)", border: "1px solid var(--df-border)", borderRadius: 6, padding: "4px 9px", fontSize: 12, color: "var(--df-text-light)", maxWidth: 160, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}><Ic n="sticky-note" s={13} c="var(--df-text-muted)" />{notes[r.mid]}</span>}
                {onLeave
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#E0F2FE", color: "#075985", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600 }}><Ic n="calendar-off" s={14} c="#075985" />已請假</span>
                  : <AttSegment value={marks[r.mid]} onChange={(v) => setMark(r.mid, v)} />}
                <button onClick={() => openNote(r)} aria-label="備註" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--df-border)", background: notes[r.mid] ? "var(--df-primary-bg)" : "var(--df-bg-light)", borderRadius: 8, padding: "7px 12px", fontSize: 13, color: notes[r.mid] ? "var(--df-primary)" : "var(--df-text-light)", cursor: "pointer", fontFamily: "var(--df-font-body)", fontWeight: 500 }}><Ic n="pencil-line" s={15} />備註</button>
              </div>
            );
          })}
        </div>
      </ACard>

      {/* save state card */}
      <ACard padding={20}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--df-ink)" }}>出席保存狀態</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--df-text-light)", lineHeight: 1.5 }}>即時顯示儲存進度，支援離線暫存與多裝置衝突處理，資料不遺失。</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: SS.bg, borderRadius: 12, padding: 16 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <span style={{ display: "inline-flex", animation: state === "saving" ? "df-spin 1s linear infinite" : "none" }}><Ic n={SS.icon} s={20} c={SS.tone} /></span>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--df-text-dark)" }}>{SS.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--df-text-light)", marginTop: 2 }}>{SS.desc}</div>
          </div>
          {state === "saved" && <button onClick={() => { setState("dirty"); dirtyCount.current = 1; notify("info", "已復原", "已回到上一個版本（示範）。"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--df-border)", background: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "var(--df-text-light)", cursor: "pointer", fontFamily: "var(--df-font-body)" }}><Ic n="rotate-ccw" s={15} />復原</button>}
        </div>
      </ACard>

      {/* bottom action bar */}
      <div style={{ position: "fixed", left: 240, right: 0, bottom: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(8px)", borderTop: "1px solid var(--df-border)", padding: "12px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, zIndex: 30, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--df-text-light)" }}>
          <Ic n={state === "saved" ? "cloud-check" : "cloud"} s={16} c={state === "saved" ? "var(--df-success)" : "var(--df-text-muted)"} />
          {state === "saved" ? (savedAt || "14:32") + " 已同步至雲端 · 全部 " + ATT_ROSTER.length + " 位學員" : "尚未儲存 · " + dirtyCount.current + " 筆變更 · 已自動暫存於本機 14:30"}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={markAll} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--df-border)", background: "#fff", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "var(--df-text-dark)", cursor: "pointer", fontFamily: "var(--df-font-body)" }}><Ic n="check-check" s={16} />全部標記出席</button>
          <button onClick={doSave} disabled={state === "saving"} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "var(--df-primary)", color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: state === "saving" ? "default" : "pointer", opacity: state === "saving" ? 0.7 : 1, fontFamily: "var(--df-font-body)" }}><Ic n="save" s={16} c="#fff" />{state === "saving" ? "儲存中…" : state === "saved" ? "已儲存 ✓" : "儲存點名"}</button>
        </div>
      </div>

