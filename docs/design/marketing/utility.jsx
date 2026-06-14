/* Dream Fly — 系統工具頁 System / Utility (404 · 搜尋結果 · 詳情範本 · 隱私權政策) */
const { Button: UBtn, Badge: UBadge, Tag: UTag, Card: UCard } = window.DreamFlyDesignSystem_9975ce;

/* ---------------- shared content data ---------------- */
const U_RESULTS = [
  { tag: "課程", tagBg: "#E8F0FE", tagFg: "var(--df-primary)", thumb: "#E0E7FF", icon: "baby",
    title: "幼兒體操 — 快樂翻滾入門班", desc: "專為 4-7 歲幼兒設計的體操啟蒙課程，透過遊戲化教學培養孩子的運動興趣與基本體能。" },
  { tag: "課程", tagBg: "#E8F0FE", tagFg: "var(--df-primary)", thumb: "#FEF3C7", icon: "dumbbell",
    title: "成人體操 — 基礎體能訓練班", desc: "針對成人設計的體操訓練課程，從零開始學習翻滾、平衡與體能訓練，適合所有體能水準。" },
  { tag: "教練", tagBg: "#FEF3C7", tagFg: "#92400E", thumb: "#DCFCE7", icon: "user-round",
    title: "王教練 — 體操專業教學 15 年經驗", desc: "曾任國家隊體操選手，具備豐富教學經驗，專精地板動作與跳馬訓練。" },
  { tag: "場館", tagBg: "#E8F5E9", tagFg: "#2E7D32", thumb: "#FCE7F3", icon: "building-2",
    title: "Dream Fly 體操館 — 場館設施介紹", desc: "配備專業彈簧地板、海綿池與各式體操器材，提供安全舒適的訓練環境。" },
];

const U_SPECS = [
  ["專業證照", "國際跑酷教練認證"],
  ["教學年資", "8 年以上"],
  ["專長項目", "跑酷、極限運動"],
  ["授課對象", "12 歲以上，初級至進階"],
  ["授課時段", "週二、四、六"],
  ["學員好評", "4.9 / 5.0（120+ 評價）"],
];

const U_GALLERY = [
  "https://images.unsplash.com/photo-1619107401314-4647479d4844?auto=format&fit=crop&w=720&q=70",
  "https://images.unsplash.com/photo-1621976954090-4495b538d9ef?auto=format&fit=crop&w=720&q=70",
  "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=720&q=70",
  "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=720&q=70",
  "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=720&q=70",
  "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=720&q=70",
];

const U_PRIVACY = [
  { id: "p1", t: "1. 資料蒐集", b: "當您註冊會員、購買票券或預約課程時，我們可能蒐集以下資料：\n• 姓名、電子信箱、手機號碼\n• 生日、性別、聯絡地址\n• 付款資訊（信用卡後四碼、付款方式）\n• 課程預約與出席紀錄\n• 裝置資訊與瀏覽紀錄" },
  { id: "p2", t: "2. 資料使用", b: "您的個人資料將用於以下目的：\n• 處理訂單、預約及付款事宜\n• 提供客戶服務與技術支援\n• 發送課程提醒、活動通知與電子報\n• 改善我們的服務品質與使用者體驗\n• 遵循法律要求與規範" },
  { id: "p3", t: "3. 資料保護", b: "我們採取適當的技術與組織措施保護您的個人資料，包括：\n• SSL 加密傳輸\n• 定期安全稽核與弱點掃描\n• 存取權限控管與身份驗證機制\n• 員工資料保護教育訓練" },
  { id: "p4", t: "4. Cookie 使用", b: "本網站使用 Cookie 及類似技術來提升您的瀏覽體驗。Cookie 用途包括：\n• 維持登入狀態與偏好設定\n• 分析網站流量與使用行為\n• 提供個人化的內容推薦\n\n您可以透過瀏覽器設定管理 Cookie 偏好。" },
  { id: "p5", t: "5. 第三方服務", b: "我們可能使用第三方服務處理您的資料，包括金流服務商、電子郵件系統及數據分析工具。這些第三方均需遵守相應的資料保護標準。我們不會將您的個人資料出售予任何第三方。" },
  { id: "p6", t: "6. 您的權利", b: "根據個人資料保護法，您享有以下權利：\n• 查詢、閱覽您的個人資料\n• 要求補充或更正個人資料\n• 要求停止蒐集、處理或利用\n• 要求刪除個人資料\n\n如需行使上述權利，請透過下方聯絡方式與我們聯繫。" },
  { id: "p7", t: "7. 聯絡我們", b: "如對本隱私權政策有任何疑問，歡迎透過以下方式聯繫：\n\n電子信箱：privacy@dreamfly.com.tw\n電話：(02) 2345-6789\n地址：台北市大安區忠孝東路四段 100 號 10 樓" },
];

/* ---------------- light header (links back to the live site) ---------------- */
function UtilHeader() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--df-border)" }}>
      <div style={{ maxWidth: SECTION_MAX, margin: "0 auto", height: 72, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="index.html" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <img src="assets/logo-df-monogram.png" alt="Dream Fly" style={{ height: 38 }} />
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontFamily: "var(--df-font-heading)", fontWeight: 800, fontSize: 19, color: "var(--df-ink)", letterSpacing: "0.01em" }}>DREAM FLY</div>
            <div style={{ fontSize: 11, color: "var(--df-text-light)", letterSpacing: "0.18em" }}>夢飛體操館</div>
          </div>
        </a>
        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {DF_NAV.map((n) => (
            <a key={n.label} href={`index.html${n.href}`} className="df-navlink" style={{ fontSize: 15, fontWeight: 500, color: "var(--df-text-dark)", textDecoration: "none" }}>{n.label}</a>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="index.html" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--df-text-dark)", textDecoration: "none" }}>
            <I n="ticket" s={18} /> 購票
          </a>
          <UBtn variant="primary" size="sm" onClick={() => { window.location.href = "../client/login.html"; }}>登入 / 註冊</UBtn>
        </div>
      </div>
    </header>
  );
}

/* gradient page banner shared by 搜尋 / 隱私 */
function PageBanner({ title, sub }) {
  return (
    <div style={{ background: "linear-gradient(135deg, var(--df-primary) 0%, var(--df-primary-dark) 100%)", padding: "52px 32px", textAlign: "center" }}>
      <h1 style={{ margin: 0, fontFamily: "var(--df-font-heading)", fontSize: 40, fontWeight: 800, color: "#fff", letterSpacing: "0.01em" }}>{title}</h1>
      <div style={{ marginTop: 10, fontSize: 18, color: "var(--df-accent)", fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

/* ============================ 404 ============================ */
function View404() {
  const suggestions = [["課程介紹", "index.html#courses"], ["購票資訊", "index.html"], ["聯絡我們", "index.html"], ["常見問題", "index.html#faq"]];
  return (
    <section style={{ background: "var(--df-bg-light)", minHeight: 620, display: "flex", alignItems: "center", justifyContent: "center", padding: "72px 32px" }}>
      <div className="df-reveal" style={{ maxWidth: 600, textAlign: "center" }}>
        <div style={{ position: "relative", height: 220, marginBottom: 8 }}>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--df-font-heading)", fontSize: 200, fontWeight: 900, color: "var(--df-primary)", opacity: 0.12, letterSpacing: "-0.04em", lineHeight: 1 }}>404</span>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 132, height: 132, borderRadius: 999, background: "#E8F0FE", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--df-shadow-card)" }}>
              <I n="compass" s={64} c="var(--df-primary)" />
            </div>
          </div>
        </div>
        <h2 style={{ margin: "0 0 14px", fontFamily: "var(--df-font-heading)", fontSize: 34, fontWeight: 800, color: "var(--df-ink)" }}>找不到此頁面</h2>
        <p style={{ margin: "0 auto 30px", maxWidth: 460, fontSize: 16, lineHeight: 1.7, color: "var(--df-text-light)" }}>您要尋找的頁面可能已經被移除、名稱已變更，或暫時無法使用。</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 44 }}>
          <UBtn variant="primary" size="lg" onClick={() => { window.location.href = "index.html"; }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><I n="house" s={19} c="#fff" /> 回到首頁</span></UBtn>
          <UBtn variant="secondary" size="lg" onClick={() => history.back()}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><I n="arrow-left" s={19} /> 返回上一頁</span></UBtn>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--df-ink)", marginBottom: 16 }}>您可能想找的頁面</div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          {suggestions.map(([l, h]) => (
            <a key={l} href={h} className="df-navlink" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, color: "var(--df-primary)", textDecoration: "none", fontWeight: 600 }}>{l} <I n="arrow-up-right" s={14} /></a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ 搜尋結果 ============================ */
function ViewSearch() {
  const [q, setQ] = React.useState("體操");
  return (
    <section>
      <PageBanner title="搜尋結果" sub="找到與「體操」相關的結果" />
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "48px 32px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, height: 52, background: "#fff", border: "1.5px solid var(--df-border-strong)", borderRadius: "var(--df-radius-md)", padding: "0 18px" }}>
            <I n="search" s={20} c="var(--df-text-light)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋課程、教練、場館…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "var(--df-font-body)", fontSize: 16, color: "var(--df-text-dark)" }} />
          </div>
          <UBtn variant="primary" size="lg">搜尋</UBtn>
        </div>
        <div style={{ margin: "22px 0 16px", fontSize: 14, color: "var(--df-text-light)" }}>共找到 <strong style={{ color: "var(--df-text-dark)" }}>8</strong> 筆結果</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {U_RESULTS.map((r, i) => (
            <UCard key={i} hoverable padding={20} className="df-lift" style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ width: 120, height: 90, borderRadius: "var(--df-radius-md)", background: r.thumb, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <I n={r.icon} s={34} c="rgba(15,23,42,0.35)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "inline-block", background: r.tagBg, color: r.tagFg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: "var(--df-radius-sm)" }}>{r.tag}</span>
                <h3 style={{ margin: "8px 0 5px", fontSize: 17, fontWeight: 700, color: "var(--df-ink)" }}>{r.title}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--df-text-light)" }}>{r.desc}</p>
              </div>
              <I n="chevron-right" s={20} c="var(--df-border-strong)" />
            </UCard>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 32 }}>
          {["chevron-left", "1", "2", "chevron-right"].map((p, i) => (
            <span key={i} style={{ width: 38, height: 38, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, cursor: "pointer",
              background: p === "1" ? "var(--df-primary)" : "#fff", color: p === "1" ? "#fff" : "var(--df-text-light)", border: "1px solid var(--df-border)" }}>
              {p.length > 1 ? <I n={p} s={16} /> : p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ 詳情範本 ============================ */
function ViewDetail() {
  return (
    <section style={{ background: "#fff" }}>
      {/* hero */}
      <div style={{ position: "relative", height: 400 }}>
        <div style={{ position: "absolute", inset: 0, background: "#0F172A url('https://images.unsplash.com/photo-1576494339550-501f28a5e10d?auto=format&fit=crop&w=1600&q=70') center/cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.72) 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxWidth: SECTION_MAX, margin: "0 auto", padding: "0 32px 36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 14 }}>
            <a href="index.html" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none" }}>首頁</a><I n="chevron-right" s={14} />
            <a href="index.html#coaches" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none" }}>教練</a><I n="chevron-right" s={14} />
            <span style={{ color: "#fff" }}>陳教練</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: "var(--df-font-heading)", fontSize: 42, fontWeight: 800, color: "#fff" }}>陳教練</h1>
          <div style={{ marginTop: 6, fontSize: 19, color: "rgba(255,255,255,0.93)" }}>跑酷專業教練，極限運動愛好者</div>
        </div>
      </div>

      {/* description */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "52px 32px 8px", display: "flex", flexDirection: "column", gap: 22 }}>
        {[
          "陳教練擁有超過 8 年的跑酷訓練與教學經驗，曾多次代表台灣參加國際跑酷比賽並獲得優異成績。他的教學風格注重安全與技巧並重，深受學員喜愛。",
          "陳教練專長於各種跑酷技巧，包括精準跳、側翻、後空翻等高難度動作。他善於將複雜的動作分解為簡單的步驟，讓學員循序漸進地掌握技巧。",
          "除了教學之外，陳教練也經常參與各類極限運動推廣活動，致力於讓更多人了解並愛上跑酷這項運動。他相信跑酷不僅是一項體育運動，更是一種生活態度。",
        ].map((p, i) => (
          <p key={i} style={{ margin: 0, fontSize: 18, lineHeight: 1.85, color: "var(--df-text-dark)" }}>{p}</p>
        ))}
      </div>

      {/* specs */}
      <div style={{ background: "var(--df-bg-light)", marginTop: 40, padding: "52px 32px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 26px", fontFamily: "var(--df-font-heading)", fontSize: 30, fontWeight: 800, color: "var(--df-primary)" }}>詳細資訊</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {U_SPECS.map(([label, value]) => (
              <UCard key={label} padding={22} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "var(--df-text-light)" }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: "var(--df-text-dark)" }}>{value}</span>
              </UCard>
            ))}
          </div>
        </div>
      </div>

      {/* gallery */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "52px 32px 64px" }}>
        <h2 style={{ margin: "0 0 26px", fontFamily: "var(--df-font-heading)", fontSize: 30, fontWeight: 800, color: "var(--df-primary)" }}>圖片集</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {U_GALLERY.map((src, i) => (
            <div key={i} className="df-lift" style={{ height: 200, borderRadius: "var(--df-radius-md)", background: `#E5E7EB url('${src}') center/cover`, boxShadow: "var(--df-shadow-card)" }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
          <UBtn variant="accent" size="lg" onClick={() => { window.location.href = "index.html"; }}>預約陳教練的課程</UBtn>
          <UBtn variant="secondary" size="lg" onClick={() => history.back()}>返回教練列表</UBtn>
        </div>
      </div>
    </section>
  );
}

/* ============================ 隱私權政策 ============================ */
function ViewPrivacy() {
  const [active, setActive] = React.useState("intro");
  const go = (id) => { setActive(id); const el = document.getElementById("priv-" + id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" }); };
  const renderBody = (b) => b.split("\n").map((line, i) => {
    if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
    if (line.startsWith("•")) return <div key={i} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.8, color: "var(--df-text-light)" }}><span style={{ color: "var(--df-primary)" }}>•</span><span>{line.slice(1).trim()}</span></div>;
    return <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.85, color: "var(--df-text-light)" }}>{line}</p>;
  });
  return (
    <section>
      <PageBanner title="隱私權政策" sub="最後更新日期：2026 年 1 月 1 日" />
      <div style={{ maxWidth: SECTION_MAX, margin: "0 auto", padding: "48px 32px", display: "grid", gridTemplateColumns: "260px 1fr", gap: 40, alignItems: "start" }}>
        {/* TOC */}
        <UCard padding={20} style={{ position: "sticky", top: 92 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--df-ink)", paddingBottom: 12, borderBottom: "1px solid var(--df-border)", marginBottom: 12 }}>目錄</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {U_PRIVACY.map((s) => (
              <button key={s.id} onClick={() => go(s.id)} style={{ textAlign: "left", border: "none", background: active === s.id ? "var(--df-primary-bg)" : "transparent", cursor: "pointer", padding: "8px 10px", borderRadius: 8, fontFamily: "var(--df-font-body)",
                fontSize: 14, fontWeight: active === s.id ? 700 : 500, color: active === s.id ? "var(--df-primary)" : "var(--df-text-dark)" }}>{s.t}</button>
            ))}
          </div>
        </UCard>
        {/* main */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <UCard padding={28} id="priv-intro">
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.85, color: "var(--df-text-light)" }}>Dream Fly 體操館（以下簡稱「本館」）非常重視您的隱私權。本隱私權政策說明我們如何蒐集、使用及保護您的個人資料。當您使用本館網站或服務時，即表示您同意本政策之內容。</p>
          </UCard>
          {U_PRIVACY.map((s) => (
            <UCard key={s.id} padding={28} id={"priv-" + s.id} style={{ scrollMarginTop: 90 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 800, color: "var(--df-ink)" }}>{s.t}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{renderBody(s.b)}</div>
            </UCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ app shell + switcher ============================ */
const U_TABS = [
  { id: "404", label: "404 找不到頁面", icon: "compass" },
  { id: "search", label: "搜尋結果", icon: "search" },
  { id: "detail", label: "詳情範本", icon: "layout-template" },
  { id: "privacy", label: "隱私權政策", icon: "shield-check" },
];

function UtilityApp() {
  const [tab, setTab] = React.useState(() => (location.hash.replace("#", "") || "404"));
  React.useEffect(() => { window.lucide && window.lucide.createIcons(); });
  React.useEffect(() => { history.replaceState(null, "", "#" + tab); window.scrollTo({ top: 0 }); }, [tab]);

  return (
    <div style={{ background: "#fff" }}>
      <UtilHeader />
      {/* segmented switcher */}
      <div style={{ position: "sticky", top: 72, zIndex: 40, background: "rgba(248,249,250,0.94)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--df-border)" }}>
        <div style={{ maxWidth: SECTION_MAX, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", gap: 8, height: 56, overflowX: "auto" }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "var(--df-text-muted)", marginRight: 6, whiteSpace: "nowrap" }}>SYSTEM · 系統工具頁</span>
          {U_TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--df-font-body)",
                border: on ? "1px solid var(--df-primary)" : "1px solid var(--df-border)", background: on ? "var(--df-primary)" : "#fff", color: on ? "#fff" : "var(--df-text-dark)", fontSize: 14, fontWeight: on ? 700 : 500, transition: "all .15s ease" }}>
                <I n={t.icon} s={16} c={on ? "#fff" : "var(--df-text-light)"} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "404" && <View404 />}
      {tab === "search" && <ViewSearch />}
      {tab === "detail" && <ViewDetail />}
      {tab === "privacy" && <ViewPrivacy />}

      <Footer />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<UtilityApp />);
