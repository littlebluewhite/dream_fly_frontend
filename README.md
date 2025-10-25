# Dream Fly 運動場館網站

專業羽球場地與教練課程的完整網站系統，使用 SvelteKit 與 TypeScript 開發。

## 專案特色

- ✅ **完整的 7 個頁面**：首頁、場館介紹、教練介紹、課程介紹、日程表、購票資訊、聯絡資訊
- 🎨 **品牌配色**：藍色 (#0066cc)、白色 (#ffffff)、黃色 (#ffd700)
- 📱 **響應式設計**：支援手機、平板、桌面裝置
- 🌏 **中文優化**：針對中文字體與排版優化
- 🧩 **模組化組件**：可重複使用的 Svelte 組件
- ⚡ **快速載入**：SvelteKit 提供優異的效能
- 🎯 **TypeScript**：型別安全的開發體驗

## 技術棧

- **框架**: SvelteKit 2.0
- **語言**: TypeScript 5.0
- **建置工具**: Vite 5.0
- **樣式**: CSS Variables + 原生 CSS
- **部署**: 適配器可選 (Auto、Node、Static)

## 專案結構

```
dream_fly_frontend/
├── src/
│   ├── routes/                    # SvelteKit 路由
│   │   ├── +layout.svelte        # 共用布局 (Header + Footer)
│   │   ├── +page.svelte          # 首頁
│   │   ├── venues/               # 場館介紹
│   │   ├── coaches/              # 教練介紹
│   │   ├── contact/              # 聯絡資訊
│   │   ├── courses/              # 課程介紹
│   │   ├── tickets/              # 購票資訊
│   │   └── schedule/             # 日程表
│   ├── lib/
│   │   ├── components/           # 可重用組件
│   │   │   ├── Header.svelte     # 頁首組件 (含 Logo 與導航)
│   │   │   ├── Navigation.svelte # 導航選單 (響應式)
│   │   │   ├── Footer.svelte     # 頁尾組件
│   │   │   ├── CoachCard.svelte  # 教練卡片
│   │   │   ├── CourseCard.svelte # 課程卡片
│   │   │   ├── ContactForm.svelte# 聯絡表單
│   │   │   └── ScheduleCalendar.svelte # 日程表日曆
│   │   └── styles/
│   │       └── global.css        # 全域樣式與 CSS 變數
│   └── app.html                  # HTML 模板
├── static/
│   └── logo.png                  # Dream Fly Logo
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tsconfig.json
```

## 快速開始

### 前置需求

- Node.js 18.0 或更高版本
- npm 或 pnpm

### 安裝步驟

1. **克隆專案** (如果從 Git)
   ```bash
   git clone <repository-url>
   cd dream_fly_frontend
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **啟動開發伺服器**
   ```bash
   npm run dev
   ```

4. **開啟瀏覽器**

   訪問 http://localhost:5173

### 可用指令

```bash
# 開發模式 (熱重載)
npm run dev

# 建置生產版本
npm run build

# 預覽生產版本
npm run preview

# 型別檢查
npm run check

# 型別檢查 (持續監看)
npm run check:watch
```

## 功能說明

### 1. 首頁 (`/`)
- Hero 區塊：歡迎標語與 CTA 按鈕
- 特色展示：4 個核心優勢
- 行動呼籲區塊

### 2. 場館介紹 (`/venues`)
- 場館設施介紹
- 專業設備說明
- 場地規格詳情
- 營業時間

### 3. 教練介紹 (`/coaches`)
- 4 位專業教練介紹
- 教練專長與認證
- 教學理念展示

### 4. 課程介紹 (`/courses`)
- 6 種課程方案
- 課程內容與價格
- 報名資訊
- 優惠方案

### 5. 日程表 (`/schedule`)
- 互動式日曆選擇
- 即時場地狀態 (充足/有限/額滿)
- 時段選擇 (06:00-23:00)
- 線上預約功能

### 6. 購票資訊 (`/tickets`)
- 6 種票券方案
- 價格與優惠說明
- 購票方式
- 注意事項

### 7. 聯絡資訊 (`/contact`)
- 完整聯絡資訊
- 線上諮詢表單 (含驗證)
- 營業時間
- 交通方式

## 設計系統

### 配色方案

```css
--color-primary: #0066cc;       /* 主要藍色 */
--color-primary-dark: #004d99;  /* 深藍色 */
--color-primary-light: #3385d6; /* 淺藍色 */
--color-white: #ffffff;         /* 白色 */
--color-accent: #ffd700;        /* 強調黃色 */
--color-accent-dark: #e6c200;   /* 深黃色 */
```

### 響應式斷點

- **手機**: < 768px (漢堡選單)
- **平板**: 768px - 1023px
- **桌面**: ≥ 1024px

### 字體

針對中文優化的字體堆疊：
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'Noto Sans TC', 'Microsoft JhengHei',
             'PingFang TC', 'Heiti TC', sans-serif;
```

## 組件說明

### Header.svelte
- 品牌 Logo 與標題
- 響應式導航選單
- 手機版漢堡選單
- 黏性定位 (sticky)

### Navigation.svelte
- 7 個導航項目
- 當前頁面高亮
- 手機版側邊滑出選單
- 流暢的轉場動畫

### Footer.svelte
- 快速連結
- 聯絡資訊
- 社群媒體連結
- 版權資訊

### ScheduleCalendar.svelte
- 月曆檢視
- 日期選擇
- 時段選擇 (2 小時區塊)
- 場地狀態指示器
- 預約確認功能

### ContactForm.svelte
- 姓名、Email、電話輸入
- 主旨下拉選單
- 訊息文字區域
- 即時表單驗證
- 送出狀態回饋

### CoachCard.svelte
- 教練頭像 (文字首字母)
- 專長列表
- 經歷說明
- 證照展示

### CourseCard.svelte
- 課程等級標籤 (顏色區分)
- 價格顯示 (含原價劃線)
- 課程內容列表
- 立即報名按鈕

## 部署

### Vercel (推薦)

```bash
npm install -g vercel
vercel
```

### 靜態部署

1. 修改 `svelte.config.js`:
   ```javascript
   import adapter from '@sveltejs/adapter-static';

   export default {
     kit: {
       adapter: adapter({
         pages: 'build',
         assets: 'build',
         fallback: null
       })
     }
   };
   ```

2. 建置:
   ```bash
   npm install @sveltejs/adapter-static
   npm run build
   ```

3. 部署 `build` 資料夾到任何靜態主機

### Node.js 伺服器

```bash
npm install @sveltejs/adapter-node
npm run build
node build
```

## 客製化

### 修改配色

編輯 `src/lib/styles/global.css` 中的 CSS 變數：

```css
:root {
  --color-primary: #YOUR_COLOR;
  --color-accent: #YOUR_COLOR;
}
```

### 新增頁面

1. 在 `src/routes/` 建立新資料夾
2. 新增 `+page.svelte` 檔案
3. 在 `Navigation.svelte` 的 `navItems` 陣列新增項目

### 修改 Logo

替換 `static/logo.png` 為您的 Logo 圖片

## 瀏覽器支援

- Chrome/Edge (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- iOS Safari (iOS 13+)
- Android Chrome (Android 8+)

## 授權

本專案為 Dream Fly 運動場館專用，版權所有。

## 聯絡資訊

- **網站**: http://dreamfly.com.tw (範例)
- **Email**: info@dreamfly.com.tw
- **電話**: (02) 2345-6789
- **Line**: @dreamfly

---

**建立日期**: 2025-10-25
**SvelteKit 版本**: 2.0
**最後更新**: 2025-10-25
