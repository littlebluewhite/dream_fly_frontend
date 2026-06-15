





















































            <DBtn variant="primary" fullWidth onClick={() => setView("attendance")}>開始課前檢查</DBtn>
            <div style={{ fontSize: 12, color: "var(--df-text-light)", textAlign: "center" }}>完成後進入點名頁</div>
          </div>
        </div>
      </DCard>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* two column */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, alignItems: "start" }}>
        <PanelCard title="今日課程表" viewAll="查看全部" onViewAll={() => setView("today")}>
          {/* priority strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--df-bg-light)", borderRadius: 8, padding: "9px 12px", marginBottom: 12, flexWrap: "wrap" }}>
            <Ic n="arrow-up-down" s={14} c="var(--df-text-light)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--df-text-light)" }}>依優先排序</span>
            {[["var(--df-primary-bg)", "var(--df-primary)", "下一堂課 14:00 競技體操"], ["var(--df-warning-bg)", "var(--df-warning)", "待點名 2 班"], ["var(--df-error-bg)", "var(--df-error)", "待回覆 3 則"]].map(([bg, dot, t]) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: bg, borderRadius: 999, padding: "5px 10px" }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: dot }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--df-text-dark)" }}>{t}</span>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TODAY_CLASSES.map((c) => <ClassRow key={c.id} c={c} onClick={() => setView("today")} />)}
          </div>
        </PanelCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <PanelCard title="最新訊息" viewAll="查看全部" onViewAll={() => setView("messages")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.map((m, i) => (
                <button key={i} onClick={() => setView("messages")} className="df-rowhover" style={{ display: "flex", gap: 12, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "var(--df-font-body)" }}>
                  <span style={{ width: 32, height: 32, borderRadius: "50%", background: m.color, color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{m.initial}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)" }}>{m.name}</span>
                      <span style={{ fontSize: 11, color: "var(--df-text-light)" }}>{m.time}</span>















              ))}
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}

/* shared class row (time block + info + status) */
function ClassRow({ c, onClick }) {
  const st = CLASS_STATUS[c.status];
  return (
    <div onClick={onClick} className="df-rowhover" style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--df-bg-light)", borderRadius: 8, padding: 14, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ background: "var(--df-primary)", borderRadius: 8, padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "var(--df-font-mono)" }}>{c.start}</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{c.level}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--df-text-dark)" }}>{c.name}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--df-text-light)" }}><Ic n="map-pin" s={13} c="var(--df-text-light)" />{c.room}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--df-text-light)" }}><Ic n="users" s={13} c="var(--df-text-light)" />{c.count} 人</span>
        </div>
      </div>
      <span style={{ background: st.bg, color: st.fg, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, flex: "none" }}>{st.label}</span>
    </div>
  );
}

/* ===== 今日課程 (Today's Classes) ===== */
function TodayClasses({ notify, setView }) {











































































          <PanelCard title="課堂提醒">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reminders.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--df-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n={r.icon} s={15} c="var(--df-primary)" /></span>
                  <span style={{ fontSize: 12.5, color: "var(--df-text-light)", lineHeight: 1.5 }}>{r.text}</span>
                </div>
              ))}
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}

function TodayClassCard({ c, notify, setView }) {
  const st = CLASS_STATUS[c.status];
  const acted = c.status === "done";
  return (
    <div style={{ background: "var(--df-bg-light)", borderRadius: 10, padding: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ background: "var(--df-primary)", borderRadius: 8, padding: "8px 14px", display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "var(--df-font-mono)" }}>{c.start}</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "var(--df-font-mono)" }}>{c.end}</span>
      </div>
      <div style={{ flex: "1 1 180px", minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--df-text-dark)" }}>{c.name}</span>
          <span style={{ background: st.bg, color: st.fg, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>{st.label}</span>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--df-text-light)" }}><Ic n="map-pin" s={12} c="var(--df-text-light)" />{c.room}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--df-text-light)" }}><Ic n="users" s={12} c="var(--df-text-light)" />{c.count} 位</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--df-text-light)" }}><Ic n="signal" s={12} c="var(--df-text-light)" />{c.level}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flex: "none" }}>
        {acted
          ? <button onClick={() => setView("attendance")} style={btnGhost}>查看記錄</button>
          : <button onClick={() => setView("attendance")} style={btnPrimary}>點名</button>}
        <button onClick={() => notify("info", c.name, "顯示班級學員名單（示範）。")} style={btnGhost}>查看名單</button>
        <button onClick={() => setView("messages")} aria-label="傳訊息" style={{ ...btnGhost, padding: "8px 10px" }}><Ic n="message-circle" s={15} c="var(--df-text-light)" /></button>
      </div>
    </div>
  );
}

const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--df-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--df-font-body)" };
const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "var(--df-text-light)", border: "1px solid var(--df-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--df-font-body)" };

Object.assign(window, { Dashboard, TodayClasses, ClassRow });

