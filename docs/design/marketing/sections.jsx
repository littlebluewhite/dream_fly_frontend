/* Dream Fly — Marketing sections part 1: Header, Hero, Proof, Why */
const { Button, Badge, Tag, Card, Avatar, IconButton } = window.DreamFlyDesignSystem_9975ce;

const I = ({ n, s = 20, c = "currentColor", sw = 2 }) =>
  React.createElement("i", { "data-lucide": n, style: { width: s, height: s, color: c, display: "inline-flex", strokeWidth: sw } });

const SECTION_MAX = 1240;

function Kicker({ children }) {
  return <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.12em", color: "var(--df-primary)" }}>{children}</span>;
}

function Header({ onNav }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--df-border)" }}>
      <div style={{ maxWidth: SECTION_MAX, margin: "0 auto", height: 72, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <img src="assets/logo-df-monogram.png" alt="Dream Fly" style={{ height: 38 }} />
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontFamily: "var(--df-font-heading)", fontWeight: 800, fontSize: 19, color: "var(--df-ink)", letterSpacing: "0.01em" }}>DREAM FLY</div>
            <div style={{ fontSize: 11, color: "var(--df-text-light)", letterSpacing: "0.18em" }}>夢飛體操館</div>
          </div>
        </a>
        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {DF_NAV.map((n) => (
            <a key={n.label} href={n.href} className="df-navlink" style={{ fontSize: 15, fontWeight: 500, color: "var(--df-text-dark)", textDecoration: "none" }}>{n.label}</a>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onNav} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "var(--df-text-dark)", fontFamily: "var(--df-font-body)" }}>
            <I n="ticket" s={18} /> 購票
          </button>
          <Button variant="primary" size="sm" onClick={onNav}>登入 / 註冊</Button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onBook }) {
  return (
    <section id="top" style={{ position: "relative", height: 560, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "#0F172A url('https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=70') center/cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #0F172AF2 0%, #0F172ACC 55%, #0F172A55 100%)" }} />
      <div style={{ position: "relative", maxWidth: SECTION_MAX, margin: "0 auto", height: "100%", padding: "0 32px", display: "flex", alignItems: "center", gap: 48 }}>
        <div className="df-reveal" style={{ width: 660 }}>
          <span style={{ display: "inline-block", padding: "8px 16px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 22 }}>3 歲起・初學到進階・先試上再報名</span>
          <h1 style={{ margin: 0, fontFamily: "var(--df-font-body)", fontSize: 52, fontWeight: 700, lineHeight: 1.25, color: "#fff" }}>先試一堂，<br />再決定孩子的體操路線</h1>
          <p style={{ margin: "20px 0 28px", fontSize: 18, lineHeight: 1.6, color: "rgba(255,255,255,0.9)", maxWidth: 560 }}>
            Dream Fly 依年齡、程度與安全需求安排幼兒體操、兒童基礎、競技啦啦隊與成人體操。第一次來館會先評估，再推薦適合班級。
          </p>
          <div style={{ display: "flex", gap: 16, marginBottom: 26 }}>
            <Button variant="primary" size="lg" onClick={onBook}>預約免費試上</Button>
            <Button variant="secondary" size="lg" onClick={() => { const el = document.getElementById("courses"); el && el.scrollIntoView(); }} style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}>查看課程與時段</Button>
          </div>
          <div style={{ display: "flex", gap: 22, color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 500 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><I n="users" s={16} c="var(--df-accent)" />小班制</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><I n="shield-check" s={16} c="var(--df-accent)" />安全保護</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><I n="calendar-days" s={16} c="var(--df-accent)" />平日/週末時段</span>
          </div>
        </div>
        <div className="df-reveal" style={{ width: 340, background: "rgba(255,255,255,0.96)", borderRadius: 12, padding: 28, boxShadow: "var(--df-shadow-strong)", animationDelay: ".12s" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--df-primary)" }}>試上流程</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--df-text-dark)", margin: "8px 0 10px", lineHeight: 1.3 }}>15 分鐘評估<br />+ 60 分鐘體驗</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--df-text-light)", lineHeight: 1.6 }}>教練會確認孩子年齡、柔軟度、力量與是否有基礎動作，體驗後給出適合班級與時段建議。</p>
          <div style={{ display: "flex", gap: 24, marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--df-border)" }}>
            <div><div style={{ fontSize: 24, fontWeight: 700, color: "var(--df-primary)" }}>3+</div><div style={{ fontSize: 12, color: "var(--df-text-light)" }}>歲可試上</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 700, color: "var(--df-primary)" }}>4</div><div style={{ fontSize: 12, color: "var(--df-text-light)" }}>類課程</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 700, color: "var(--df-primary)" }}>1:6</div><div style={{ fontSize: 12, color: "var(--df-text-light)" }}>師生比</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofStrip() {
  return (
    <div style={{ background: "var(--df-ink)" }}>
      <div style={{ maxWidth: SECTION_MAX, margin: "0 auto", padding: "28px 32px", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
        {DF_PROOF.map(([t, s], i) => (
          <div key={t} style={{ padding: "0 24px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.18)" : "none" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{t}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhyUs() {
  return (
    <section id="why" style={{ maxWidth: SECTION_MAX, margin: "0 auto", padding: "84px 32px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 56, alignItems: "start" }}>
        <div>
          <Kicker>WHY DREAM FLY · 為什麼選我們</Kicker>
          <h2 style={{ margin: "12px 0 16px", fontFamily: "var(--df-font-heading)", fontSize: 36, fontWeight: 700, color: "var(--df-ink)", lineHeight: 1.3 }}>讓家長放心，<br />讓孩子有自信</h2>
          <p style={{ margin: 0, fontSize: 16, color: "var(--df-text-light)", lineHeight: 1.7 }}>
            我們相信好的體操訓練是循序漸進、以安全為前提的。從第一次到館的評估，到每一堂課的進度紀錄，每一步都讓你看得見孩子的成長。
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {DF_WHY.map((w) => (
            <Card key={w.title} padding={24} className="df-lift">
              <div style={{ width: 52, height: 52, borderRadius: 12, background: "var(--df-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <I n={w.icon} s={26} c="var(--df-primary)" />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "var(--df-ink)" }}>{w.title}</h3>
              <p style={{ margin: 0, fontSize: 14, color: "var(--df-text-light)", lineHeight: 1.65 }}>{w.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { I, Kicker, SECTION_MAX, Header, Hero, ProofStrip, WhyUs });
