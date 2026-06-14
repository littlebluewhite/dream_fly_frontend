/* Dream Fly — Marketing sections part 2: Courses, Coaches, Pricing, Voices, FAQ, CTA, Footer */
const { Button: Btn2, Badge: Badge2, Tag: Tag2, Card: Card2 } = window.DreamFlyDesignSystem_9975ce;

function Categories({ onBook }) {
  return (
    <section id="courses" style={{ background: "var(--df-bg-light)", borderTop: "1px solid var(--df-border)", borderBottom: "1px solid var(--df-border)" }}>
      <div style={{ maxWidth: SECTION_MAX, margin: "0 auto", padding: "84px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <Kicker>COURSES · 課程分類</Kicker>
          <h2 style={{ margin: "10px 0 0", fontFamily: "var(--df-font-heading)", fontSize: 36, fontWeight: 700, color: "var(--df-ink)" }}>找到適合的起點</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
          {DF_CATS.map((c) => (
            <Card2 key={c.name} hoverable onClick={onBook} padding={28} className="df-lift" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--df-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                <I n={c.icon} s={28} c="var(--df-primary)" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--df-ink)" }}>{c.name}</h3>
                <Badge2 tone="primary">{c.age}</Badge2>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--df-text-light)", lineHeight: 1.6 }}>{c.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
                {c.points.map((p) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--df-text-dark)" }}>
                    <I n="check" s={15} c="var(--df-success)" />{p}
                  </div>
                ))}
              </div>
              <span style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--df-primary)" }}>了解課程 <I n="arrow-right" s={15} /></span>
            </Card2>
          ))}
        </div>
      </div>
    </section>
  );
}

function Coaches() {
  return (
    <section id="coaches" style={{ maxWidth: SECTION_MAX, margin: "0 auto", padding: "84px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 44 }}>
        <div>
          <Kicker>COACHES · 教練團隊</Kicker>
          <h2 style={{ margin: "10px 0 0", fontFamily: "var(--df-font-heading)", fontSize: 36, fontWeight: 700, color: "var(--df-ink)" }}>陪孩子安全成長的人</h2>
        </div>
        <Btn2 variant="secondary">看所有教練</Btn2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
        {DF_COACHES.map((c) => (
          <Card2 key={c.name} padding={0} hoverable className="df-lift" style={{ overflow: "hidden" }}>
            <div style={{ height: 240, background: `#E5E7EB url('${c.img}') center/cover` }} />
            <div style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--df-ink)" }}>{c.name}</h3>
                <Badge2 tone="primary">資歷 {c.years}</Badge2>
              </div>
              <div style={{ fontSize: 14, color: "var(--df-text-light)", margin: "5px 0 12px" }}>{c.role}</div>
              <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
                {Array.from({ length: 5 }).map((_, i) => <I key={i} n="star" s={16} c="var(--df-accent)" />)}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {c.tags.map((t) => <Tag2 key={t}>{t}</Tag2>)}
              </div>
            </div>
          </Card2>
        ))}
      </div>
    </section>
  );
}

function Pricing({ onBook }) {
  return (
    <section id="pricing" style={{ background: "var(--df-bg-light)", borderTop: "1px solid var(--df-border)", borderBottom: "1px solid var(--df-border)" }}>
      <div style={{ maxWidth: SECTION_MAX, margin: "0 auto", padding: "84px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <Kicker>PRICING · 收費方案</Kicker>
          <h2 style={{ margin: "10px 0 0", fontFamily: "var(--df-font-heading)", fontSize: 36, fontWeight: 700, color: "var(--df-ink)" }}>先試上，再選方案</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, alignItems: "start" }}>
          {DF_PLANS.map((p) => (
            <Card2 key={p.name} padding={32} style={{ position: "relative", border: p.popular ? "2px solid var(--df-primary)" : "1px solid var(--df-border)", boxShadow: p.popular ? "var(--df-shadow-lifted)" : "var(--df-shadow-card)" }}>
              {p.popular && <span style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "var(--df-accent)", color: "var(--df-primary-dark)", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 999 }}>最受歡迎</span>}
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--df-ink)" }}>{p.name}</h3>
              <div style={{ margin: "14px 0 20px", display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 16, color: "var(--df-text-light)" }}>NT$</span>
                <span style={{ fontFamily: "var(--df-font-heading)", fontSize: 40, fontWeight: 800, color: "var(--df-ink)" }}>{p.price}</span>
                <span style={{ fontSize: 15, color: "var(--df-text-light)" }}>{p.unit}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 24 }}>
                {p.feats.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--df-text-dark)" }}>
                    <I n="check" s={17} c="var(--df-success)" />{f}
                  </div>
                ))}
              </div>
              <Btn2 variant={p.popular ? "primary" : "secondary"} fullWidth onClick={onBook}>{p.cta}</Btn2>
            </Card2>
          ))}
        </div>
      </div>
    </section>
  );
}

function Voices() {
  return (
    <section id="voices" style={{ maxWidth: SECTION_MAX, margin: "0 auto", padding: "84px 32px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <Kicker>VOICES · 學員回饋</Kicker>
        <h2 style={{ margin: "10px 0 0", fontFamily: "var(--df-font-heading)", fontSize: 36, fontWeight: 700, color: "var(--df-ink)" }}>家長與學員怎麼說</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
        {DF_VOICES.map((v) => (
          <Card2 key={v.name} padding={28} className="df-lift" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
              {Array.from({ length: 5 }).map((_, i) => <I key={i} n="star" s={16} c="var(--df-accent)" />)}
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 16, color: "var(--df-text-dark)", lineHeight: 1.7 }}>「{v.quote}」</p>
            <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "var(--df-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>{v.name[0]}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--df-ink)" }}>{v.name}</div>
                <div style={{ fontSize: 13, color: "var(--df-text-light)" }}>{v.meta}</div>
              </div>
            </div>
          </Card2>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = React.useState(0);
  return (
    <section id="faq" style={{ background: "var(--df-bg-light)", borderTop: "1px solid var(--df-border)", borderBottom: "1px solid var(--df-border)" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "84px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <Kicker>FAQ · 常見問題</Kicker>
          <h2 style={{ margin: "10px 0 0", fontFamily: "var(--df-font-heading)", fontSize: 36, fontWeight: 700, color: "var(--df-ink)" }}>報名前想知道的事</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DF_FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <Card2 key={f.q} padding={0} style={{ overflow: "hidden", border: isOpen ? "1px solid var(--df-border-strong)" : "1px solid var(--df-border)" }}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 24px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--df-ink)" }}>{f.q}</span>
                  <span style={{ flexShrink: 0, transition: "transform .18s ease", transform: isOpen ? "rotate(180deg)" : "none" }}><I n="chevron-down" s={20} c="var(--df-primary)" /></span>
                </button>
                {isOpen && <div style={{ padding: "0 24px 22px", fontSize: 15, color: "var(--df-text-light)", lineHeight: 1.7 }}>{f.a}</div>}
              </Card2>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CtaBanner({ onBook }) {
  return (
    <section style={{ position: "relative", overflow: "hidden", background: "var(--df-ink)" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, #004D99 0%, #0066CC 60%, #0F172A 100%)", opacity: 0.96 }} />
      <div style={{ position: "relative", maxWidth: SECTION_MAX, margin: "0 auto", padding: "72px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 12px", fontFamily: "var(--df-font-heading)", fontSize: 38, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>先試一堂，再決定孩子的體操路線</h2>
          <p style={{ margin: 0, fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, maxWidth: 560 }}>免費預約 15 分鐘評估與 60 分鐘體驗，教練會給出最適合的班級與時段建議。</p>
        </div>
        <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
          <Btn2 variant="accent" size="lg" onClick={onBook}>預約免費試上</Btn2>
          <Btn2 variant="secondary" size="lg" onClick={onBook} style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}>聯絡我們</Btn2>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: "var(--df-ink)", color: "#fff" }}>
      <div style={{ maxWidth: SECTION_MAX, margin: "0 auto", padding: "56px 32px 32px", display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 40 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <img src="assets/logo-df-monogram.png" alt="Dream Fly" style={{ height: 32 }} />
            <div style={{ fontFamily: "var(--df-font-heading)", fontWeight: 800, fontSize: 20 }}>Dream Fly 體操館</div>
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, maxWidth: 280 }}>專業體操訓練中心，提供幼兒體操、競技啦啦隊、成人體操與跑酷課程。</p>
        </div>
        {DF_FOOTER.map(([h, links]) => (
          <div key={h}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{h}</div>
            {links.map((l) => <div key={l} style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>{l}</div>)}
          </div>
        ))}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>追蹤我們</div>
          <div style={{ display: "flex", gap: 10 }}>
            {["FB", "IG", "Line"].map((s) => <span key={s} className="df-social" style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{s}</span>)}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", textAlign: "center", padding: "20px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>© 2026 Dream Fly 夢飛體操館. All rights reserved.</div>
    </footer>
  );
}

Object.assign(window, { Categories, Coaches, Pricing, Voices, Faq, CtaBanner, Footer });
