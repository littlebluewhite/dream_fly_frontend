/* Dream Fly — Admin portal · 報表分析 / 場館管理 / 票券管理
   報表分析 is a faithful recreation of SEC/AdminBackend · 報表分析 from the source .pen. */
const RepDS = window.DreamFlyDesignSystem_9975ce;
const { Button: RBtn, Badge: RBadge, Card: RCard, Tag: RTag, ProgressBar: RProg, IconButton: RIconBtn } = RepDS;

/* ---- small report stat card (tighter than the dashboard StatCard) ---- */
function ReportKpi({ k }) {
  return (
    <RCard padding={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: k.tint, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n={k.icon} s={22} c={k.color} /></div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#10B9811A", color: "var(--df-success-strong)", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}><Ic n="trending-up" s={13} />{k.delta}</span>
        </div>
        <div style={{ fontFamily: "var(--df-font-heading)", fontSize: 27, fontWeight: 800, color: "var(--df-ink)", letterSpacing: -0.5 }}>{k.value}</div>
        <div style={{ fontSize: 13, color: "var(--df-text-light)", marginTop: -4 }}>{k.label}</div>
      </div>
    </RCard>
  );
}

/* ---- revenue breakdown / drill-down card ---- */
function RevenueBreakdown({ notify }) {
  return (
    <RCard padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "14px 18px", background: "#0066CC0A", borderBottom: "1px solid var(--df-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#0066CC14", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n="dollar-sign" s={18} c="var(--df-primary)" /></div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)" }}>本月營收 {REVENUE_TOTAL} · 來源拆解</div>
            <div style={{ fontSize: 12, color: "var(--df-text-light)", marginTop: 2 }}>點任一來源可下鑽至原始訂單／班級／票券，每個數字皆可追溯</div>
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--df-primary-bg)", color: "var(--df-primary)", fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 999, flex: "none" }}><Ic n="scan-line" s={13} />可追溯來源</span>
      </div>
      <div>
        {REVENUE_BREAKDOWN.map((r, i) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: i < REVENUE_BREAKDOWN.length - 1 ? "1px solid #F3F4F6" : "none" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: r.dot, flex: "none" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--df-text-dark)" }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "var(--df-text-light)", marginTop: 1 }}>{r.meta}</div>
              </div>
            </div>
            <div style={{ width: 120, textAlign: "right", fontSize: 14, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-mono)" }}>{r.amount}</div>
            <button onClick={() => notify("info", r.name, "下鑽至原始資料：" + r.drill + "（示範）。")} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#0066CC0F", color: "var(--df-primary)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "7px 12px", borderRadius: 8, fontFamily: "var(--df-font-body)", flex: "none" }}>{r.drill}<Ic n="arrow-right" s={14} /></button>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: "var(--df-bg-light)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)" }}>合計（本月）</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-mono)" }}>{REVENUE_TOTAL}</span>
        </div>
      </div>
    </RCard>
  );
}

/* ---- monthly revenue bar chart ---- */
function RevenueTrend() {
  const max = Math.max(...REVENUE_TREND.map((d) => d.h));
  return (
    <RCard padding={18} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)" }}>月營收趨勢</div>
          <div style={{ fontSize: 12, color: "var(--df-text-light)", marginTop: 2 }}>單位：新台幣（仟元）</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--df-primary)" }}>總計 NT$ 4.51M</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 190 }}>
        {REVENUE_TREND.map((d) => (
          <div key={d.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, justifyContent: "flex-end", height: "100%" }}>
            <div title={d.m} style={{ width: "100%", maxWidth: 26, height: (d.h / max) * 160, background: d.peak ? "var(--df-primary-dark)" : "var(--df-primary)", borderRadius: "5px 5px 0 0", transition: "height .4s ease" }} />
            <span style={{ fontSize: 11, color: "var(--df-text-light)" }}>{d.m}</span>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- course category donut ---- */
function CategoryDonut() {
  let acc = 0;
  const stops = CATEGORY_SPLIT.map((c) => {
    const start = acc; acc += c.pct;
    return `${c.color} ${start}% ${acc}%`;
  }).join(", ");
  return (
    <RCard padding={18} style={{ width: 360, flex: "none" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", marginBottom: 10 }}>課程分類占比</div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <div style={{ width: 150, height: 150, borderRadius: "50%", background: `conic-gradient(${stops})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ width: 93, height: 93, borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", lineHeight: 1 }}>142</div>
            <div style={{ fontSize: 11, color: "var(--df-text-light)", marginTop: 3 }}>總課程數</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {CATEGORY_SPLIT.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: c.color, flex: "none" }} />
            <span style={{ flex: 1, fontSize: 13, color: "var(--df-text-dark)" }}>{c.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--df-text-dark)" }}>{c.pct}%</span>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- top courses ranking ---- */
function TopCourses() {
  const max = Math.max(...TOP_COURSES.map((c) => c.count));
  return (
    <RCard padding={18} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)" }}>熱門課程排行</div>
        <span style={{ fontSize: 12, color: "var(--df-text-light)" }}>依報名人數</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {TOP_COURSES.map((c) => (
          <div key={c.rank} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 20, textAlign: "center", fontSize: 14, fontWeight: 800, color: c.rank === 1 ? "var(--df-primary)" : "var(--df-text-light)", fontFamily: "var(--df-font-heading)" }}>{c.rank}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)" }}>{c.name}</span>
                <span style={{ fontSize: 12, color: "var(--df-text-light)" }}>{c.count} 人</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "#EEF2F6", overflow: "hidden" }}>
                <div style={{ height: "100%", width: (c.count / max) * 100 + "%", borderRadius: 4, background: c.rank === 1 ? "var(--df-primary)" : "var(--df-primary-light)" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- income-source analysis ---- */
function IncomeSources() {
  return (
    <RCard padding={18} style={{ width: 380, flex: "none" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", marginBottom: 16 }}>收入來源分析</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {INCOME_SOURCES.map((s) => (
          <div key={s.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 5, background: s.color }} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)" }}>{s.label}</span></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--df-text-dark)", fontFamily: "var(--df-font-mono)" }}>{s.amount}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "#EEF2F6", overflow: "hidden" }}>
              <div style={{ height: "100%", width: s.pct + "%", borderRadius: 4, background: s.color }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--df-text-light)", marginTop: 4 }}>{s.pct}% 占比</div>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- per-coach performance ranking ---- */
function CoachPerf() {
  return (
    <RCard padding={18} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)" }}>教練表現排行</div>
        <span style={{ fontSize: 12, color: "var(--df-text-light)" }}>營收 · 學員數 · 出席率</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {COACH_PERF.map((c, i) => (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, background: c.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, fontFamily: "var(--df-font-heading)", flex: "none" }}>{c.initial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--df-text-dark)" }}>{c.name} <span style={{ fontSize: 11.5, color: "var(--df-text-muted)" }}>· {c.students} 位 · 出席 {c.att}%</span></span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-mono)" }}>{c.revenue}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "#EEF2F6", overflow: "hidden" }}><div style={{ height: "100%", width: c.revPct + "%", borderRadius: 4, background: c.color }} /></div>
            </div>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- venue utilisation ---- */
function VenueUsage() {
  return (
    <RCard padding={18} style={{ width: 380, flex: "none" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", marginBottom: 16 }}>場館使用率</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {VENUE_USAGE.map((v) => (
          <div key={v.name}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 5, background: v.color }} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)" }}>{v.name}</span></span>
              <span style={{ fontSize: 12.5, color: "var(--df-text-light)" }}><b style={{ color: "var(--df-text-dark)" }}>{v.pct}%</b> · {v.hours}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "#EEF2F6", overflow: "hidden" }}><div style={{ height: "100%", width: v.pct + "%", borderRadius: 4, background: v.color }} /></div>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- attendance-rate distribution (vertical bars) ---- */
function AttDist() {
  const maxC = Math.max(...ATT_DIST.map((d) => d.count));
  return (
    <RCard padding={18} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", marginBottom: 6 }}>出席率分布</div>
      <div style={{ fontSize: 12, color: "var(--df-text-light)", marginBottom: 16 }}>全館學員人數分布</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 168 }}>
        {ATT_DIST.map((d) => (
          <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)" }}>{d.count}</span>
            <div style={{ width: "100%", maxWidth: 54, height: (d.count / maxC * 110) + "px", borderRadius: "6px 6px 0 0", background: d.color }} />
            <span style={{ fontSize: 11.5, color: "var(--df-text-light)", textAlign: "center" }}>{d.label}</span>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- new vs returning (stacked bars) ---- */
function RetentionTrend() {
  const maxR = Math.max(...RETENTION.map((d) => d.nu + d.re));
  return (
    <RCard padding={18} style={{ width: 380, flex: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)" }}>新生 vs 續報</div>
          <div style={{ fontSize: 12, color: "var(--df-text-light)", marginTop: 2 }}>近 6 個月 · 報名人數</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0EA5E9" }}>留存 88.4%</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150 }}>
        {RETENTION.map((d) => (
          <div key={d.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
            <div style={{ width: "100%", maxWidth: 30, height: ((d.nu + d.re) / maxR * 116) + "px", borderRadius: "5px 5px 0 0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ height: (d.nu / (d.nu + d.re) * 100) + "%", background: "var(--df-accent)" }} />
              <div style={{ flex: 1, background: "var(--df-primary)" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--df-text-light)" }}>{d.m}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 12, color: "var(--df-text-light)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--df-accent)" }} />新生學員</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--df-primary)" }} />續報學員</span>
      </div>
    </RCard>
  );
}

/* ---- age-band distribution ---- */
function AgeDist() {
  return (
    <RCard padding={18} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", marginBottom: 16 }}>年齡層分布</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {AGE_DIST.map((a) => (
          <div key={a.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 5, background: a.color }} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)" }}>{a.label}</span></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--df-text-dark)" }}>{a.pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "#EEF2F6", overflow: "hidden" }}><div style={{ height: "100%", width: a.pct + "%", borderRadius: 4, background: a.color }} /></div>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- per-campus revenue (分校別營收) ---- */
function CampusRevenue() {
  return (
    <RCard padding={18} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)" }}>分校別營收</div>
        <span style={{ fontSize: 12, color: "var(--df-text-light)" }}>本月 · 含在學人數</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {CAMPUS_REVENUE.map((c) => (
          <div key={c.name}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 5, background: c.color }} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)" }}>{c.name}</span><span style={{ fontSize: 11.5, color: "var(--df-text-muted)" }}>{c.students} 位學員</span></span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-mono)" }}>{c.amount}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "#EEF2F6", overflow: "hidden" }}><div style={{ height: "100%", width: c.pct + "%", borderRadius: 4, background: c.color }} /></div>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- payment-method donut (付款方式占比) ---- */
function PaymentSplit() {
  let acc = 0;
  const stops = PAYMENT_SPLIT.map((p) => { const s = acc; acc += p.pct; return `${p.color} ${s}% ${acc}%`; }).join(", ");
  return (
    <RCard padding={18} style={{ width: 380, flex: "none" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", marginBottom: 14 }}>付款方式占比</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(${stops})`, flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", lineHeight: 1 }}>{PAYMENT_SPLIT.length}</div>
            <div style={{ fontSize: 10.5, color: "var(--df-text-light)", marginTop: 2 }}>種管道</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
          {PAYMENT_SPLIT.map((p) => (
            <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: p.color, flex: "none" }} />
              <span style={{ flex: 1, fontSize: 12.5, color: "var(--df-text-dark)" }}>{p.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--df-text-dark)" }}>{p.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </RCard>
  );
}

/* ---- conversion funnel (體驗→報名→續報) ---- */
function ConversionFunnel() {
  return (
    <RCard padding={18} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)" }}>體驗 → 報名 轉換漏斗</div>
        <span style={{ fontSize: 12, color: "var(--df-text-light)" }}>本季</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {FUNNEL.map((f, i) => (
          <div key={f.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-text-dark)" }}>{f.label}</span>
              <span style={{ fontSize: 12.5, color: "var(--df-text-light)" }}><b style={{ color: "var(--df-text-dark)", fontFamily: "var(--df-font-mono)" }}>{f.count}</b> 人 · {f.pct}%{i > 0 && <span style={{ color: "var(--df-text-muted)" }}> · 轉化 {Math.round(f.pct / FUNNEL[i - 1].pct * 100)}%</span>}</span>
            </div>
            <div style={{ height: 24, borderRadius: 7, background: "#EEF2F6", overflow: "hidden" }}><div style={{ height: "100%", width: f.pct + "%", borderRadius: 7, background: f.color }} /></div>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- weekday class load + attendance (星期別負載) ---- */
function WeekdayLoad() {
  const maxC = Math.max(...WEEKDAY_LOAD.map((d) => d.classes));
  return (
    <RCard padding={18} style={{ width: 380, flex: "none" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", marginBottom: 4 }}>星期別課堂負載</div>
      <div style={{ fontSize: 12, color: "var(--df-text-light)", marginBottom: 16 }}>長條為課堂數 · 數字為平均出席率</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 158 }}>
        {WEEKDAY_LOAD.map((d) => (
          <div key={d.d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--df-primary)" }}>{d.rate}%</span>
            <div style={{ width: "100%", maxWidth: 30, height: (d.classes / maxC * 104) + "px", borderRadius: "5px 5px 0 0", background: d.classes === maxC ? "var(--df-primary-dark)" : "var(--df-primary)" }} />
            <span style={{ fontSize: 11.5, color: "var(--df-text-light)" }}>{d.d}</span>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ---- membership-tier distribution (會員分級分布) ---- */
function TierDist() {
  const maxC = Math.max(...TIER_DIST.map((d) => d.count));
  return (
    <RCard padding={18} style={{ width: 380, flex: "none" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)", marginBottom: 4 }}>會員分級分布</div>
      <div style={{ fontSize: 12, color: "var(--df-text-light)", marginBottom: 16 }}>依累積點數分級 · 學員人數</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 158 }}>
        {TIER_DIST.map((d) => (
          <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--df-text-dark)", fontFamily: "var(--df-font-heading)" }}>{d.count}</span>
            <div style={{ width: "100%", maxWidth: 48, height: (d.count / maxC * 100) + "px", borderRadius: "6px 6px 0 0", background: d.color }} />
            <span style={{ fontSize: 12, color: "var(--df-text-light)" }}>{d.label}</span>
          </div>
        ))}
      </div>
    </RCard>
  );
}

/* ===== 報表分析 ===== */
function ReportsView({ notify }) {
  useLucide();
  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="報表分析" sub="檢視營運數據、營收趨勢與課程分析報表" actions={
        <React.Fragment>
          <button onClick={() => notify("info", "選擇期間", "可切換不同統計期間（示範）。")} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid var(--df-border)", background: "#fff", color: "var(--df-text-dark)", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "var(--df-font-body)" }}>
            <Ic n="calendar" s={16} c="var(--df-text-light)" />2026 上半年<Ic n="chevron-down" s={14} c="var(--df-text-light)" />
          </button>
          <RBtn variant="primary" size="sm" iconLeft={<Ic n="download" s={15} />} onClick={() => notify("success", "報表匯出中", "2026 上半年營運報表將寄送至您的信箱。")}>匯出報表</RBtn>
        </React.Fragment>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {REPORT_KPIS.map((k) => <ReportKpi key={k.label} k={k} />)}
      </div>
      <RevenueBreakdown notify={notify} />
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        <RevenueTrend />
        <CategoryDonut />
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        <TopCourses />
        <IncomeSources />
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        <CoachPerf />
        <VenueUsage />
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        <AttDist />
        <RetentionTrend />
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        <AgeDist />
        <TierDist />
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        <CampusRevenue />
        <PaymentSplit />
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        <ConversionFunnel />
        <WeekdayLoad />
      </div>
    </div>
  );
}

/* ===== 場館管理 ===== */
const VENUE_STATUS = { available: ["success", "可預約"], maintenance: ["warning", "維護中"] };
function VenuesView({ notify }) {
  useLucide();
  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="場館管理" sub="教室、訓練場地與器材配置" actions={<RBtn variant="primary" size="sm" iconLeft={<Ic n="plus" s={15} />} onClick={() => notify("success", "新增場地", "已開啟新場地建立表單。")}>新增場地</RBtn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {VENUES.map((v) => {
          const [tone, label] = VENUE_STATUS[v.status];
          return (
            <RCard key={v.id} padding={0} hoverable style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px 14px", borderBottom: "1px solid var(--df-border)" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--df-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontFamily: "var(--df-font-heading)", fontSize: 20, fontWeight: 800, color: "var(--df-primary)" }}>{v.id}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>{v.name}</h3>
                    <RBadge tone={tone} dot>{label}</RBadge>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--df-text-light)", marginTop: 3 }}>{v.type}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: "1px solid var(--df-border)" }}>
                {[[v.area, "面積"], [v.cap + " 人", "容納"], [v.today + " 堂", "今日排課"]].map(([val, lbl], i) => (
                  <div key={lbl} style={{ padding: "12px 0", textAlign: "center", borderLeft: i ? "1px solid var(--df-border)" : "none" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>{val}</div>
                    <div style={{ fontSize: 11.5, color: "var(--df-text-light)", marginTop: 1 }}>{lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--df-text-muted)", letterSpacing: "0.04em" }}>器材配置</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{v.equip.map((e) => <RTag key={e}>{e}</RTag>)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, padding: "0 20px 18px" }}>
                <RBtn variant="secondary" size="sm" fullWidth iconLeft={<Ic n="calendar-days" s={14} />} onClick={() => notify("info", v.name, "顯示 " + v.name + " 的排課時段。")}>排課表</RBtn>
                <RBtn variant="primary" size="sm" fullWidth iconLeft={<Ic n="pencil-line" s={14} />} onClick={() => notify("info", v.name, "編輯場地資訊（示範）。")}>編輯</RBtn>
              </div>
            </RCard>
          );
        })}
      </div>
    </div>
  );
}

/* ===== 票券管理 ===== */
function TicketsView({ notify }) {
  useLucide();
  const totalSold = TICKETS.reduce((s, t) => s + t.sold, 0);
  const revenue = TICKETS.reduce((s, t) => s + t.sold * t.price, 0);
  return (
    <div className="df-view" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="票券管理" sub="月票、體驗券與活動票券" actions={<RBtn variant="primary" size="sm" iconLeft={<Ic n="plus" s={15} />} onClick={() => notify("success", "新增票券", "已開啟票券建立表單。")}>新增票券</RBtn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        <StatCard icon="ticket" label="已售票券" value={totalSold + " 張"} tint="#8B5CF614" color="#8B5CF6" />
        <StatCard icon="circle-dollar-sign" label="票券營收" value={fmtNT(revenue)} tint="var(--df-success-bg)" color="var(--df-success)" />
        <StatCard icon="layers" label="販售方案" value={TICKETS.length + " 種"} tint="var(--df-primary-bg)" color="var(--df-primary)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
        {TICKETS.map((t) => {
          const pct = Math.round((t.sold / t.quota) * 100);
          const [tone, label] = TICKET_TYPE[t.type] || TICKET_TYPE.pass;
          return (
            <RCard key={t.id} padding={0} hoverable style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 20px 16px" }}>
                <div style={{ width: 46, height: 46, borderRadius: 11, background: t.color + "1A", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic n={t.icon} s={22} c={t.color} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--df-ink)", fontFamily: "var(--df-font-heading)" }}>{t.name}</h3>
                  <div style={{ fontSize: 12.5, color: "var(--df-text-light)", marginTop: 4 }}>{t.desc}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "none" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--df-ink)", fontFamily: "var(--df-font-mono)", whiteSpace: "nowrap" }}>{fmtNT(t.price)}</div>
                  <RBadge tone={tone}>{label}</RBadge>
                </div>
              </div>
              <div style={{ padding: "0 20px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                  <span style={{ color: "var(--df-text-light)" }}>已售 / 配額</span>
                  <span style={{ fontWeight: 700, color: "var(--df-text-dark)", whiteSpace: "nowrap" }}>{t.sold} / {t.quota} 張</span>
                </div>
                <RProg value={pct} height={7} tone={pct >= 80 ? "warning" : "primary"} />
              </div>
              <div style={{ display: "flex", gap: 8, padding: "0 20px 18px", borderTop: "1px solid var(--df-border)", paddingTop: 14 }}>
                <RBtn variant="secondary" size="sm" fullWidth iconLeft={<Ic n="bar-chart-3" s={14} />} onClick={() => notify("info", t.name, "已售 " + t.sold + " 張 · 營收 " + fmtNT(t.sold * t.price) + "。")}>銷售明細</RBtn>
                <RBtn variant="primary" size="sm" fullWidth iconLeft={<Ic n="pencil-line" s={14} />} onClick={() => notify("info", t.name, "編輯票券方案（示範）。")}>編輯</RBtn>
              </div>
            </RCard>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { ReportsView, VenuesView, TicketsView });
