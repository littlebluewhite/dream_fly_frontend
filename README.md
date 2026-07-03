# Dream Fly（夢飛）— 體操與競技啦啦學苑前端

Dream Fly（夢飛）是一所**體操與競技啦啦學苑**的前端專案，採 **SvelteKit 2 + Svelte 5（runes-era）+
TypeScript（strict）** 開發，建置工具為 Vite，測試為 Vitest + Testing Library。本專案**沒有真正的後端**：
每個「API」都是各 surface 底下 `data.ts` 的 mock 種子資料（seed）加上瀏覽器 `localStorage`；結帳／付款流程
為模擬，沒有真實金流。

## 快速開始

```bash
npm install   # 每次 fresh checkout / 新 worktree 都必須先跑：package-lock.json 沒有進版控
npm run dev   # 啟動開發伺服器：http://localhost:5173
```

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
`lib/domain/` 是 admin/mobile-admin（ops pair）與 member/mobile（會員 app 雙生）共用 mock 種子的單一
來源。`admin`、`coach`、`member`、`mobile`、`mobile-admin` 五個 surface 各有一份 `api.ts` 作為 mock API
接縫，之後要換真後端只需改這一層，呼叫端不受影響。完整架構、domain 詞彙與決策紀錄分見
[`docs/architecture.md`](docs/architecture.md)、[`CONTEXT.md`](CONTEXT.md)、[`docs/adr/`](docs/adr/)。

## 驗證關卡

任何變更送出前：

```bash
npm run check && npm run test
```

若異動牽涉路由或 SSR（例如 layout、`+page.ts`、新增或搬動 surface），額外跑一次 `npm run build` 確認建置
通過。
