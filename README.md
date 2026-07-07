# Dream Fly（夢飛）— 體操與競技啦啦學苑前端

Dream Fly（夢飛）是一所**體操與競技啦啦學苑**的前端專案，採 **SvelteKit 2 + Svelte 5（runes-era）+
TypeScript（strict）** 開發，建置工具為 Vite，測試為 Vitest + Testing Library。後端是姊妹 repo
**`dream_fly_backend`**（Rust/Axum + PostgreSQL + Redis），提供 `/api/v1` REST API；登入、購物車、結帳、
會員中心、後台、教練工作台，以及（Round 3 起）兩個 mobile surface 的 seam 目前都已接上真實 API。Mock
僅保留在少數明確標註 **P2** 的角落（mobile 試上預約／設定頁 toast、會員/mobile 儀表板統計數字、
mobile-admin 身分小卡與僅第一頁的列表、admin/mobile-admin 教練與場館票券寫入表單、系統設定切換等——這些
後端尚未提供對應端點，或純屬裝飾性質），完整清單見 [`docs/adr/0006`](docs/adr/0006-real-backend-integration.md)。

## 快速開始（雙 repo 啟動順序）

```bash
# 1) 先啟動後端 dream_fly_backend（同層的姊妹 repo）
cd ../dream_fly_backend
docker-compose up -d      # PostgreSQL + Redis；migration 會在 cargo run 啟動時自動套用
cargo run --bin seed      # 灌入冪等開發假資料（admin/member/coach 帳號、課程、方案、優惠碼…）
cargo run                 # 服務監聽 http://localhost:3000/api/v1

# 2) 回到本 repo 啟動前端
npm install   # 每次 fresh checkout / 新 worktree 都必須先跑：package-lock.json 沒有進版控
npm run dev   # 啟動開發伺服器：http://localhost:5173
```

`.env`（見 `.env.example`）：`VITE_API_BASE_URL`，未設定時預設為 `http://localhost:3000/api/v1`。

## 指令表

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動 Vite 開發伺服器（http://localhost:5173） |
| `npm run build` | 建置正式版本 |
| `npm run preview` | 預覽建置後的正式版本 |
| `npm run check` | `svelte-kit sync && svelte-check`，型別檢查關卡；本專案沒有 ESLint / Prettier，`check` 是最接近 linter 的機制 |
| `npm run test` | `vitest run`（jsdom 環境，設定於 `src/vitest-setup.ts`）；`npm run test:watch` 可持續監看 |

只跑單一測試檔：

```bash
npx vitest run src/lib/checkout-gate.test.ts
```

依名稱篩選測試：

```bash
npx vitest run -t "blocks open redirect"
```

## 架構一覽

前端在根 layout（`src/routes/+layout.svelte`）依路徑拆成七大 UI surface：公開行銷站，以及六個「app」
surface —— 會員中心 `/member`、管理後台 `/admin`、教練工作台 `/coach`、staff 登入 `/staff/login`、行動版
會員 `/mobile`、行動版後台 `/mobile-admin`，其中五個各自帶著自己版型，staff 登入為 bare 頁面、無巢狀版型；
只有公開行銷站套用共用的 `Header`/`Footer`。`src/lib` 依 surface 分資料夾（各自的 `data.ts`、`stores.ts`、`api.ts` 等），跨
surface 共用程式碼集中在 `lib/components/`、`lib/domain/`、`lib/stores/`、`lib/styles/` 等目錄，其中
`lib/domain/` 是 admin/mobile-admin（ops pair）與 member/mobile（會員 app 雙生）共用種子的單一來源
（多數欄位現由真實 API 覆寫，僅少數 P2 殘餘仍讀這份種子）。六個 app surface 的 `api.ts` 現在都以呼叫
`dream_fly_backend` 的真實 API 為主：`mobile`、`mobile-admin`（Round 3 起）是薄層，復用 desktop
member/admin/coach 既有的真實 API 函式，只在各自小範圍的 P2 殘餘（見 `docs/adr/0006`）才落回 mock。每個
surface 的 `api.ts` 是唯一的接縫層，呼叫端（頁面）不需要知道背後是真 API 還是 mock。完整架構、domain 詞彙
與決策紀錄分見
[`docs/architecture.md`](docs/architecture.md)、[`CONTEXT.md`](CONTEXT.md)、[`docs/adr/`](docs/adr/)。

## 驗證關卡

任何變更送出前：

```bash
npm run check && npm run test
```

若異動牽涉路由或 SSR（例如 layout、`+page.ts`、新增或搬動 surface），額外跑一次 `npm run build` 確認建置
通過。
