


























































  const lowAtt = s.att < 75;
  return (
    <SCard padding={20} hoverable>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: "50%", background: s.color, color: "#fff", fontWeight: 700, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{s.initial}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--df-ink)" }}>{s.name}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--df-text-light)", marginTop: 2 }}><Ic n="graduation-cap" s={13} c="var(--df-text-muted)" />{s.cls}</div>
        </div>
        <span style={{ background: tint.bg, color: tint.fg, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, flex: "none" }}>{s.level}</span>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--df-text-dark)", fontWeight: 500 }}><Ic n="target" s={14} c="var(--df-primary)" />{s.skill}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--df-text-dark)" }}>{s.pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--df-bg-light)", overflow: "hidden" }}>
          <div style={{ width: s.pct + "%", height: "100%", borderRadius: 999, background: s.pct >= 85 ? "var(--df-success)" : "var(--df-primary)", transition: "width .4s ease" }} />
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--df-border)", marginTop: 16, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Ic n="calendar-check" s={16} c={lowAtt ? "var(--df-error)" : "var(--df-success)"} />
          <span style={{ fontSize: 12, color: "var(--df-text-light)" }}>出席率</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: lowAtt ? "var(--df-error-strong)" : "var(--df-text-dark)" }}>{s.att}%</span>
        </span>
        <button onClick={() => notify("info", s.name + " · 學員檔案", "顯示完整技能評量與出勤紀錄（示範）。")} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "var(--df-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--df-font-body)" }}>查看詳情 <Ic n="chevron-right" s={14} c="var(--df-primary)" /></button>
      </div>























































              <button onClick={() => notify("info", "下一週", "顯示 6/1 – 6/7 課表（示範）。")} aria-label="下一週" style={navArrow}><Ic n="chevron-right" s={16} c="var(--df-text-light)" /></button>
              <button onClick={() => notify("info", "今日", "已回到本週。")} style={{ marginLeft: 4, padding: "7px 14px", border: "1px solid var(--df-border)", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)", cursor: "pointer", fontFamily: "var(--df-font-body)" }}>今日</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Dropdown icon="layers" value="全部課程類型" options={["全部課程類型", "體操", "啦啦隊", "跑酷"]} onChange={() => {}} />
            <Dropdown icon="map-pin" value="所有場館" options={["所有場館", "主場館", "競技訓練館", "副館"]} onChange={() => {}} />
          </div>
        </div>
      </SCard>

      {/* calendar grid */}
      <SCard padding={0} style={{ overflow: "hidden" }}>
        {/* day header */}
        <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid var(--df-border)" }}>
          <div style={{ borderRight: "1px solid var(--df-border)" }} />
          {SCHED_DAYS.map((d) => (
            <div key={d.key} style={{ padding: "12px 8px", textAlign: "center", borderRight: "1px solid var(--df-border)", background: d.today ? "var(--df-primary-bg)" : "#fff" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: d.today ? "var(--df-primary)" : "var(--df-text-light)" }}>{d.zh}</div>
              <div style={{ fontSize: 12, color: d.today ? "var(--df-primary)" : "var(--df-text-muted)", marginTop: 3, fontFamily: "var(--df-font-mono)", fontWeight: d.today ? 700 : 400 }}>{d.date}{d.today ? " 今日" : ""}</div>
            </div>
          ))}
        </div>
        {/* body */}
        <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", position: "relative" }}>
          {/* time column */}
          <div style={{ borderRight: "1px solid var(--df-border)" }}>
            {SCHED_HOURS.map((h) => (
              <div key={h} style={{ height: ROW_H, borderBottom: "1px solid var(--df-border)", display: "flex", justifyContent: "center", paddingTop: 6, fontSize: 11.5, color: "var(--df-text-muted)", fontFamily: "var(--df-font-mono)" }}>{h}</div>
            ))}
          </div>
          {/* day columns */}
          {SCHED_DAYS.map((d) => {
            const courses = SCHED_COURSES.filter((c) => c.day === d.key);
            return (
              <div key={d.key} style={{ position: "relative", borderRight: "1px solid var(--df-border)", background: d.today ? "rgba(234,243,251,0.4)" : "#fff" }}>
                {SCHED_HOURS.map((h) => <div key={h} style={{ height: ROW_H, borderBottom: "1px solid var(--df-border)" }} />)}
                {courses.map((c, i) => {
                  const col = CAT_COLOR[c.cat];
                  return (
                    <div key={i} onClick={() => notify("info", c.name, c.start + "–" + c.end + " · " + c.count + " 位學員")} style={{ position: "absolute", top: toY(c.start) + 2, left: 4, right: 4, height: dur(c.start, c.end) - 4, background: col.bg, borderLeft: "3px solid " + col.bar, borderRadius: 7, padding: "6px 8px", cursor: "pointer", overflow: "hidden" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: col.fg, lineHeight: 1.25 }}>{c.name}</div>
                      <div style={{ fontSize: 10.5, color: col.fg, opacity: 0.85, marginTop: 2, fontFamily: "var(--df-font-mono)" }}>{c.start}-{c.end}</div>
                      <div style={{ fontSize: 10.5, color: col.fg, opacity: 0.85, marginTop: 1 }}>{c.count} 位學員</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </SCard>

      {/* legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--df-text-muted)" }}>課程類別：</span>
          {Object.entries(CAT_COLOR).map(([cat, col]) => (
            <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--df-text-light)" }}><span style={{ width: 12, height: 12, borderRadius: 3, background: col.bar }} />{cat}</span>
          ))}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--df-text-muted)" }}><Ic n="lightbulb" s={14} c="var(--df-accent-dark)" />Tip: 點擊空白時段可新增課程</span>
      </div>
    </div>
  );
}

const navArrow = { width: 34, height: 34, borderRadius: 8, border: "1px solid var(--df-border)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

Object.assign(window, { Students, Schedule });
