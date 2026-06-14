/* Dream Fly — Marketing site content data */

const DF_NAV = [
  { label: "課程", href: "#courses" },
  { label: "為什麼選我們", href: "#why" },
  { label: "教練", href: "#coaches" },
  { label: "收費方案", href: "#pricing" },
  { label: "學員回饋", href: "#voices" },
  { label: "常見問題", href: "#faq" },
];

const DF_PROOF = [
  ["第一次到館", "先評估再推薦班級"],
  ["專業教練群", "競技與安全訓練背景"],
  ["小班教學", "每班 6–8 人"],
  ["完整保護墊", "場館全區安全鋪設"],
];

const DF_CATS = [
  { icon: "baby", name: "幼兒體操", age: "3–6 歲", desc: "從爬、滾、平衡開始，建立身體控制與安全感。", points: ["大肌肉發展", "親子陪伴選項", "遊戲化教學"] },
  { icon: "rotate-cw", name: "兒童基礎", age: "6–12 歲", desc: "前後滾翻、倒立、側翻等基本動作循序漸進。", points: ["分級進度表", "技巧熟練度追蹤", "升班評估"] },
  { icon: "sparkles", name: "競技啦啦隊", age: "8 歲以上", desc: "技巧、拋接、團隊編排，培養默契與舞台自信。", points: ["團隊編排", "賽事培訓", "表演機會"] },
  { icon: "dumbbell", name: "成人體操", age: "16 歲以上", desc: "體能、柔軟度與核心訓練，零基礎也能開始。", points: ["核心與柔軟度", "彈性時段", "零基礎友善"] },
];

const DF_WHY = [
  { icon: "shield-check", title: "安全是第一原則", desc: "全區保護墊與安全網，教練全程貼身保護，循序漸進不躁進。" },
  { icon: "users", title: "小班制 1:6 師生比", desc: "每班 6–8 人，教練看得到每個孩子的動作細節與進步。" },
  { icon: "target", title: "分級與進度追蹤", desc: "依年齡與程度分班，每位學員都有可視化的技巧熟練度紀錄。" },
  { icon: "calendar-check", title: "先試一堂再決定", desc: "15 分鐘評估 + 60 分鐘體驗，確認適合班級後再報名。" },
];

const DF_COACHES = [
  { name: "王宥蓁", role: "競技啦啦隊總教練", img: "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=480&q=70", tags: ["競技體操", "團隊編排"], years: "12 年" },
  { name: "林志豪", role: "兒童體操主教練", img: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=480&q=70", tags: ["翻滾技巧", "兒童體操"], years: "9 年" },
  { name: "陳怡君", role: "幼兒體操教練", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=480&q=70", tags: ["幼兒啟蒙", "安全保護"], years: "7 年" },
];

const DF_PLANS = [
  { name: "單堂體驗", price: "600", unit: "/ 堂", feats: ["60 分鐘課程", "教練評估建議", "免費安全裝備"], cta: "預約試上", popular: false },
  { name: "季度方案", price: "7,200", unit: "/ 季", feats: ["每週 1 堂・共 12 堂", "固定班級與時段", "進度追蹤報告", "補課彈性"], cta: "選擇季度", popular: true },
  { name: "半年方案", price: "13,200", unit: "/ 半年", feats: ["每週 1 堂・共 24 堂", "季度方案全部內容", "競賽培訓優先報名"], cta: "選擇半年", popular: false },
];

const DF_VOICES = [
  { quote: "孩子原本很怕翻滾，教練很有耐心地一步步帶，現在每週最期待來上課。", name: "陳媽媽", meta: "兒童基礎・上課 8 個月" },
  { quote: "先試上的安排讓我們很放心，評估後推薦的班級真的很適合，沒有勉強推銷。", name: "林爸爸", meta: "幼兒體操・上課 1 年" },
  { quote: "從零基礎到能上場比賽，啦啦隊的團隊氛圍讓我女兒變得超有自信。", name: "Wei", meta: "競技啦啦隊・上課 2 年" },
];

const DF_FAQ = [
  { q: "孩子幾歲可以開始上課？", a: "3 歲起即可報名幼兒體操。第一次到館我們會先做 15 分鐘評估，依年齡、柔軟度與力量推薦最適合的班級。" },
  { q: "沒有任何基礎可以參加嗎？", a: "可以。所有課程都從基礎動作開始，循序漸進。成人體操與兒童基礎班都歡迎零基礎學員。" },
  { q: "試上需要付費嗎？", a: "提供免費試上預約，包含 15 分鐘評估與 60 分鐘體驗課程，並免費提供安全裝備。" },
  { q: "場館的安全措施有哪些？", a: "場館全區鋪設專業保護墊並設置安全網，教練全程貼身保護，每班維持 6–8 人的小班制以照顧到每位學員。" },
  { q: "課程時段有哪些選擇？", a: "平日與週末皆有班次，涵蓋上午、下午與晚間時段。報名後可選擇固定班級與時段，並提供補課彈性。" },
];

const DF_FOOTER = [
  ["場館資訊", ["場館介紹", "教練介紹", "課程介紹", "日程表"]],
  ["聯絡我們", ["聯絡資訊", "購票資訊", "常見問題", "交通方式"]],
];

Object.assign(window, { DF_NAV, DF_PROOF, DF_CATS, DF_WHY, DF_COACHES, DF_PLANS, DF_VOICES, DF_FAQ, DF_FOOTER });
