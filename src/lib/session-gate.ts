/**
 * session-gate — authStore 身分變更感知的 domain-store 水合閘門家族(架構深化 R7 C1)。
 *
 * 收斂六個 member/mobile domain store 對「session 身分變更」的非同構處理:waitlist/
 * leave 手抄了完整的 epoch/身分重置/序列化和解鏈骨架(位元組級雙生);notifications
 * 的 hydrated 旗標跨帳號存活(真缺陷:SPA 登出無整頁重載,B 帳號被 guarded() 短路、
 * 直接讀到 A 的資料);points/subscriptions 全無守衛。本模組把前二「吸收」成單源、
 * 把後四「抬升」到同一套守衛之下,提供兩門工廠:
 *   - createSessionGate     完整 session gate(gate + 身分重置 + epoch 核對 fetch + 寫入鏈;
 *                           頁面進場包 pageEntry()、寫入動詞 write() 與和解鏈繼承自閘門)——
 *                           waitlist / leave / notifications;R13(docs/adr/0023)
 *                           再加本人帳號資料(self-account)、教練身分(coach/api 私有)
 *                           與 mobile-admin 訊息(messagesGate),共六個
 *   - createSessionRefresher session refresher(保留無條件重抓語意,只加身分清空 +
 *                           在飛寫回 epoch 作廢;不套 guard)—— points / subscriptions
 *
 * C3(架構深化 R9)新增 pageEntry(),關閉 ADR 0017 明載的 known-latent 殘窗(通知
 * **頁**的 load-gate 直接拿 raw getter 當 fetch,繞過 epoch 核對)。門 (c)
 * `onSessionReset` 已退役(其唯一消費者曾是 mobile 專屬的通知模組;架構深化 R12 起
 * mobile 併入 member notifications 這顆共用 gate;R15(候選 F-4)mobile 消費端改直接
 * `import from '$lib/member/notifications'`,不再經 `$lib/mobile/stores` 轉出——三門
 * 收斂為兩門的結論不變,只是 mobile 拿到這顆 gate 的路徑換了)。
 *
 * 架構深化 R10／R11 替 pageEntry() 交出的水合協定加上世代穩定重抓與 mutation settle 訊號,
 * 讓頁面 load-gate 的 refresh 族與 store 閘門讀**同一本**世代帳與**同一本**尾流帳(見
 * $lib/hydration-gate 內部的 fetchGenStable)。R14(候選 F1)把 pageEntry() 整個搬進
 * HydrationGate:本檔已把 epochFetch 當 fetch 餵給水合閘門,所以繼承下來的進場包自帶 epoch
 * 核對,本檔不再自己組。R15(候選 F-1)再把 pageEntry() 的形狀收成 `{ source: LoadSource }`
 * ——世代帳與尾流帳的讀取器連經 pageEntry() 交出這條路都收掉,只住 hydration-gate.ts 內部,
 * 頁面的 load-gate 只看得到 `source.load(isCurrent)`/`source.refresh(isCurrent)` 這兩支黑箱;
 * 本檔對此無感,`gate.pageEntry()` 原樣轉手。identity onChange 呼叫本閘門的
 * `reset()`(R15 起即水合閘門自帶的通用 reset() 再加重置兩條鏈;取代 R14 以前專供本檔用的內部
 * 工廠 `createOwnedHydrationGate`/`ownerChanged()`,兩者已退役——閘門的 reset() 翻旗 false +
 * 清尾流帳,後者即 R11 終審修波的跨身分清帳,理由見 createSessionGate 註解)。
 *
 * R17(候選 寫入動詞):和解鏈(原 queueReconcile)與 mutate 的協定本體搬進 HydrationGate 的
 * write(),軸由本檔的 session 世代換成閘門的 resetEpoch——身分變更即 reset(),resetEpoch 跟著
 * 推進,所以「跨身分作廢」語意不變。本檔只剩身分核心、epochFetch 與 queueWrite;mutate 已於
 * FE-8 退役(寫入一律走繼承自水合閘門的 write())。
 *
 * R14(候選 F2)重開 ADR-0023 的「等第三處再說」:profile/coach 手抄的在飛合併、寫入鏈與
 * session 世代收進閘門——合併住 HydrationGate(hydrate 與頁面 load-gate 的 load 共用在飛 GET),
 * 寫入鏈住本檔(queueWrite)。身分基準改在建構當下決定:restored 開機零觸發,建構順序契約
 * 與消費端「let 必須宣告在前」的註解一併退役。
 *
 * 座落位置:authStore 與 domain store 之間。刻意**不**深化 hydration-gate——後者被
 * ~49 頁全 surface 的 load-gate 消費(含 staff 面,其 identity 源非 member authStore),
 * 若把 member auth 維度打進那顆 core,等於把錯向依賴灌進 repo 最寬的 seam;且
 * hydration-gate 的檔頭憲章(零模組級副作用、零 store import、SSR-safe 葉)是 ADR 0016
 * 剛批的。session-gate 則明確依賴 authStore,但仍守零 import-time 副作用:authStore
 * .subscribe() 發生在 factory **被呼叫**時(call site 在各 store 模組頂層 = 現行
 * waitlist/leave 同位置),不是本模組 import 時——SSR 姿勢與現況一致。
 *
 * 每次 factory call 一個獨立的 authStore 訂閱(R13 起共八個模組級永生訂閱——六個
 * createSessionGate + 兩個 createSessionRefresher,與現狀同類),
 * 無共享 registry:registry 會違反零副作用憲章、需要新的 registry-reset 測試接縫,
 * 且 epoch 只與自身比較、無跨模組消費者(見 ADR-0017、ADR-0024 的「不做 registry 測試縫」)。
 */
import { authStore, sessionIdentity } from '$lib/stores/authStore';
import { createHydrationGate, type HydrationGate } from '$lib/hydration-gate';

/**
 * 私有 identity core:每次 factory call 建一個 authStore 訂閱,把「身分是否變更」
 * 這唯一決策收成一處。
 *
 * 身分基準在建構當下決定(R14 F2):subscribe 的立即回呼只記 lastIdentity、不觸發
 * onChange——restored 與訪客開機一律零觸發(ADR-0017 的「reset 值 = 開機值」保證畫面無差別),
 * 故建構期間不會呼叫任何 reset,呼叫端的 let 宣告在哪都不炸。identity key 見 sessionIdentity()
 * (未登入為 null,登入但無 member.id 退化為空字串)。
 *
 * 回傳 epoch():單調遞增的 session 世代,身分每變一次 +1;fetch/queueWrite 出發時捕捉、
 * 落地前比對——跨登出/換帳號的在飛回應即以此作廢。
 */
function createSessionCore(onChange: () => void): { epoch: () => number } {
	let sessionEpoch = 0;
	let lastIdentity: string | null = null;
	let baselined = false;
	authStore.subscribe((a) => {
		const identity = sessionIdentity(a);
		if (!baselined) {
			baselined = true; // 立即回呼:只記身分基準
			lastIdentity = identity;
			return;
		}
		if (identity !== lastIdentity) {
			sessionEpoch += 1;
			lastIdentity = identity;
			onChange();
		}
	});
	return { epoch: () => sessionEpoch };
}

/** 門 (a) 完整 session gate 的選項。 */
export interface SessionGateOptions<T> {
	/** 純域 fetch;P1′ 的 epoch 核對由工廠外包(呼叫端不再自己 throw stale)。 */
	fetch: () => Promise<T>;
	/** 成功時套用資料(通常寫回呼叫端的共享 store)。 */
	apply: (data: T) => void;
	/** identity 變更時還原 boot 態(翻旗是工廠的事,reset 只管內容)。開機不觸發(R14 F2:
	 *  建構當下只記身分基準)。 */
	reset: () => void;
}

/**
 * 門 (a) 對外面:HydrationGate(hydrated/hydrate/refresh/invalidate/reset/write/pageEntry)
 * 多 queueWrite;reset 覆寫為「閘門 reset + 重置寫入鏈」。pageEntry() 繼承自閘門
 * (R14 F1):資料來源抓的是**帶 epoch 核對**的 epochFetch(本工廠餵給水合閘門的那一支,
 * 不是呼叫端的 raw getter),頁面寫 `createLoadGate({ ...gate.pageEntry() })` 不再有機會繞過核對。
 * queueWrite(R14 F2,語意逐字取自 profile.ts 原 enqueue):排進本閘門的寫入鏈,前一筆
 * settle(成敗皆可)才輪到;輪到時 session 已換就回 `skipped`、task 不執行。task 拿到
 * `stale()` 供失敗處理判斷(換帳後不得回滾/重抓到新身分身上)。換帳號即重置這條鏈——
 * 舊身分卡住的寫入不得堵住新身分。
 */
export interface SessionGate extends HydrationGate {
	queueWrite<R>(task: (stale: () => boolean) => Promise<R>, skipped: R): Promise<R>;
}

/**
 * 建立完整 session gate。epochFetch 抽名,讓閘門的 pageEntry() 交給頁面 load-gate 的資料來源
 * 抓的是**同一支**核對過的 fetch(不是複製第二份判斷);它對 core 是 closure 前向參照,只在
 * hydrate/refresh 時才被呼叫。建構期不觸發 onChange(身分基準見 createSessionCore),
 * 宣告順序不再是契約。
 *
 * onChange = reset() = gate.reset()(opts.reset() + 翻旗 false + 丟在飛合併 GET + 清尾流帳——
 * R11 終審修波:舊 session 掛死的 mutation 尾流不得堵住新身分的 refresh,尾流帳的「必然自癒」
 * 前提只在同身分內成立,跨身分時 A 的一筆永不 settle 的 PATCH 會讓 B 的 GET 一次都不出發)+
 * 和解鏈重置(以上皆 gate.reset() 內)+ writeChain 重置(舊 session 卡死的和解或寫入不得堵住新
 * session 的鏈)。
 */
export function createSessionGate<T>(opts: SessionGateOptions<T>): SessionGate {
	const epochFetch = async (): Promise<T> => {
		const epoch = core.epoch();
		const data = await opts.fetch();
		// P1′:回應落地前核對 epoch —— 跨登出/換帳號的在飛回應整包作廢(throw 讓 gate
		// 既不 apply 也不 commit,見 hydration-gate 檔頭「fetch rejection 原樣拋出」)。
		// refresh 也走這條 fetch,故 gate.refresh 匯出者(leave 的 refreshLeaveRequests)
		// 與閘門 pageEntry() 交給頁面 load-gate 的資料來源,一併獲得在飛作廢語意。
		if (epoch !== core.epoch()) throw new Error('stale session: 回應跨登出/換帳號,作廢');
		return data;
	};
	const gate = createHydrationGate<T>({ fetch: epochFetch, apply: opts.apply, reset: opts.reset });
	let writeChain: Promise<void> = Promise.resolve();
	function reset(): void {
		gate.reset(); // 內容還原 + 翻旗 false + 舊身分的在飛 GET、尾流與和解鏈不得帶給新身分(理由見上方 onChange 說明)
		writeChain = Promise.resolve();
	}
	const core = createSessionCore(reset);

	function queueWrite<R>(task: (stale: () => boolean) => Promise<R>, skipped: R): Promise<R> {
		const mine = core.epoch();
		const stale = () => mine !== core.epoch();
		const run = writeChain.then(() => (stale() ? skipped : task(stale)));
		writeChain = run.then(
			() => {},
			() => {}
		);
		return run;
	}

	return { ...gate, reset, queueWrite };
}

/**
 * 門 (b) session refresher —— points / subscriptions。
 *
 * 保留「無條件重抓」語意(getDashboard/getAccount/getPoints/checkout-sync afterOrder/
 * CheckoutDialog/CartSheet 開啟時都依賴每次真抓,不得硬套 guard),只加兩件事:
 * identity 變更清空(reset)+ 在飛換帳「靜默丟棄」。丟棄必須靜默(return,不 throw)——
 * redeemReward await refreshPoints、placeOrder 的 afterOrder 會傳播 rejection,若在飛
 * 換帳改成 throw,等於新增一個「換帳號」失敗模式打進那兩條傳播鏈。
 */
export function createSessionRefresher<T>(opts: {
	fetch: () => Promise<T>;
	apply: (data: T) => void;
	reset: () => void;
}): () => Promise<void> {
	const core = createSessionCore(opts.reset);
	return async () => {
		const epoch = core.epoch();
		const data = await opts.fetch();
		if (epoch !== core.epoch()) return; // 在飛換帳:靜默丟棄(不套用、不 throw)
		opts.apply(data);
	};
}
