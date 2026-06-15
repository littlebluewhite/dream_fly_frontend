/* Dream Fly — 教練端 · 訊息中心 (list + thread + info panel) */
const MsDS = window.DreamFlyDesignSystem_9975ce;
const { Card: MCard } = MsDS;

const SLA_TONE = {
  warning: { fg: "var(--df-warning)", icon: "clock" },
  error: { fg: "var(--df-error)", icon: "alert-triangle" },
  success: { fg: "var(--df-success-strong)", icon: "check" },
  muted: { fg: "var(--df-text-muted)", icon: "clock" },
};

function Messages({ notify, search = "" }) {
  useLucide();
  const [tab, setTab] = React.useState("全部");
  const [sel, setSel] = React.useState("v1");
  const [reply, setReply] = React.useState("");
  const q = search.trim().toLowerCase();

  const tabs = [
    { k: "全部", label: "全部" },
    { k: "緊急", label: "緊急 2" },
    { k: "未讀", label: "未讀" },
    { k: "家長", label: "家長" },
  ];
  const list = CONVERSATIONS.filter((c) => {
    if (tab === "緊急" && !c.urgent) return false;
    if (tab === "未讀" && !c.badge) return false;
    if (tab === "家長" && c.kind !== "家長") return false;
    if (q && !(c.name + c.preview).toLowerCase().includes(q)) return false;
    return true;
  });
  React.useEffect(() => { if (list.length && !list.some((c) => c.id === sel)) setSel(list[0].id); }, [tab, q]);
  const cur = CONVERSATIONS.find((c) => c.id === sel) || CONVERSATIONS[0];
  const showThread = cur.id === "v1";

  return (
    <div className="df-view" style={{ height: "calc(100vh - 68px - 52px)", minHeight: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr 300px", gap: 0, height: "100%", background: "#fff", border: "1px solid var(--df-border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--df-shadow-card)" }}>
        {/* ---- conversation list ---- */}
        <div style={{ borderRight: "1px solid var(--df-border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid var(--df-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>訊息</span>
              <button onClick={() => notify("info", "撰寫訊息", "建立新的對話（示範）。")} aria-label="撰寫" style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "var(--df-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Ic n="pen-line" s={16} c="var(--df-primary)" /></button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--df-bg-light)", border: "1px solid var(--df-border)", borderRadius: 8, padding: "0 12px", height: 36 }}>
              <Ic n="search" s={15} c="var(--df-text-muted)" /><span style={{ fontSize: 12.5, color: "var(--df-text-muted)" }}>搜尋家長或學員</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              {tabs.map((t) => {
                const on = tab === t.k;
                return <button key={t.k} onClick={() => setTab(t.k)} style={{ padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--df-font-body)", background: on ? "var(--df-primary)" : "var(--df-bg-light)", color: on ? "#fff" : "var(--df-text-light)" }}>{t.label}</button>;
              })}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {list.length === 0 && <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "var(--df-text-muted)" }}>沒有符合的對話</div>}
            {list.map((c) => {
              const on = sel === c.id;
              const sla = SLA_TONE[c.slaTone] || SLA_TONE.muted;
              return (
                <button key={c.id} onClick={() => setSel(c.id)} style={{ display: "flex", gap: 11, padding: "13px 16px", width: "100%", textAlign: "left", border: "none", borderBottom: "1px solid var(--df-border)", borderLeft: on ? "3px solid var(--df-primary)" : "3px solid transparent", background: on ? "var(--df-primary-bg)" : "#fff", cursor: "pointer", fontFamily: "var(--df-font-body)" }}>
                  <div style={{ position: "relative", flex: "none" }}>
                    <span style={{ width: 40, height: 40, borderRadius: "50%", background: c.color, color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.initial}</span>
                    {c.badge && <span style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 999, background: "#dc2626", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: "2px solid #fff" }}>{c.badge}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--df-text-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{c.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--df-text-muted)", background: "var(--df-bg-light)", borderRadius: 4, padding: "1px 6px", flex: "none" }}>{c.kind}</span>
                      <span style={{ fontSize: 11, color: "var(--df-text-muted)", flex: "none" }}>{c.time}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--df-text-light)", marginTop: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.preview}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                      {c.urgent && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: "var(--df-error)", background: "var(--df-error-bg)", borderRadius: 4, padding: "1px 6px" }}><Ic n="flame" s={11} c="var(--df-error)" />緊急</span>}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: sla.fg }}><Ic n={sla.icon} s={11} c={sla.fg} />{c.sla}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- thread ---- */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "var(--df-bg-light)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--df-border)", background: "#fff" }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", background: cur.color, color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{cur.initial}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--df-ink)" }}>{cur.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--df-text-light)" }}>{showThread ? "王小明 的家長 · 兒童體操初階班" : cur.kind}</div>
            </div>
            {["phone", "video", "more-horizontal"].map((ic) => (
              <button key={ic} onClick={() => notify("info", "功能", "（示範）")} aria-label={ic} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--df-border)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Ic n={ic} s={16} c="var(--df-text-light)" /></button>
            ))}
          </div>

          {showThread && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: "var(--df-warning-bg)", borderBottom: "1px solid var(--df-border)" }}>
              <Ic n="clock" s={15} c="#92400E" />
              <span style={{ flex: 1, fontSize: 12.5, color: "#92400E", fontWeight: 500 }}>緊急對話 · 需於 30 分鐘內回覆（回覆 SLA）</span>
              <button onClick={() => notify("success", "已標記", "對話已標記為已處理。")} style={{ border: "none", background: "#fff", color: "#92400E", borderRadius: 7, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--df-font-body)" }}>標記已處理</button>
