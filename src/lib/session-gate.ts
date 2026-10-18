/**
 * session 閘門:對登入身分變更(登入、登出、不經整頁重載直接換帳號)有感的 domain-store 閘門家族,
 * 建在水合閘門上。「誰換人、何時換人」這個 session 專屬判斷只住本檔;水合、寫入、重置與頁面進場包的
 * 協定繼承自 $lib/hydration-gate。兩門工廠:
 *   - createSessionGate      水合閘門 + 身分重置 + epoch 核對 fetch + 寫入鏈 queueWrite();頁面進場包
 *                            pageEntry()、寫入動詞 write() 與和解鏈繼承自閘門。供候補、請假、通知、
 *                            本人帳號資料($lib/self-account)、教練身分(coach/api 私有)與教練對話列表
 *                            (coach/conversations)。
 *   - createSessionRefresher 無條件重抓(不套 guard)+ 身分清空 + 在飛換帳靜默丟棄 + 後發優先。供點數、訂閱。
 *
 * 身分的 key 一律是 authStore 轉出的 sessionIdentity(),本檔與身分範圍的暖機 key 都呼叫它,不各自手抄。
 * 換身分即 reset():水合閘門的 gate.reset()(內容還原、翻旗 false、丟在飛 GET、清尾流帳與和解鏈)再重置
 * 寫入鏈。pageEntry() 的資料來源抓的是本檔的 epochFetch,頁面拿不到未經 epoch 核對的 getter。測試要重置
 * session 閘門,經真的登入 → 登出($lib/testing/session-reset),本檔不開測試出口。
 *
 * 座落位置:authStore 與 domain store 之間。刻意不把身分維度打進 hydration-gate——後者被全 surface 的
 * load-gate 消費(含 staff 面,其身分源不是 member authStore),打進去等於把錯向依賴灌進 repo 最寬的 seam,
 * 也破壞它零模組級副作用、零 store import 的檔頭憲章(ADR-0016)。本檔依賴 authStore,但守零 import-time
 * 副作用:authStore.subscribe() 發生在 factory 被呼叫時(各 store 模組頂層),不是本模組 import 時,SSR 安全。
 *
 * 每次 factory call 一個獨立、模組級永生的 authStore 訂閱,沒有共享 registry:registry 會違反零副作用、
 * 需要新的 registry-reset 測試接縫,而 epoch 只與自身比較、沒有跨模組消費者(ADR-0017、ADR-0024)。
 */
import { authStore, sessionIdentity } from '$lib/stores/authStore';
import { get } from 'svelte/store';
import {
	createDepartureLedger,
	createHydrationGate,
	recoverWrite,
	type HydrationGate,
	type Write,
	type WriteOutcome
} from '$lib/hydration-gate';

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
 * 多 queueWrite;reset 覆寫為「閘門 reset + 重置寫入鏈」。pageEntry() 繼承自閘門:資料來源抓的是
 * **帶 epoch 核對**的 epochFetch(本工廠餵給水合閘門的那一支,不是呼叫端的 raw getter),頁面寫
 * `createLoadGate({ ...gate.pageEntry() })` 沒有機會繞過核對。
 * queueWrite:排進本閘門寫入鏈的單一寫入,前一筆 settle(成敗皆可)才輪到。消費端只交
 * optimistic/send/commit/onFailure 並對應結果,不自己讀旗標、不手寫寫前水合、resync 或回滾。
 *   1. 入列當下(同步)記 session 世代與是否已水合,套用 `optimistic`(畫面立即反映);
 *   2. 輪到時 session 已換 → `stale`(settled 為「未送出」的 rejected),send 不執行;
 *   3. 寫前 `await hydrate()`;失敗時已換帳號回 stale,否則走 recoverWrite(onFailure, undo,
 *      refresh, stale)——不送出、不推世代;
 *   4. 水合後再比一次身分;入列時未水合 → 再套一次 `optimistic`(水合的 apply 蓋掉了它,故必須冪等);
 *   5. `send()` 回 null → `written(null)`;否則交給 write(),optimistic 只回入列時的 undo。
 * 換帳號即重置這條鏈——舊身分卡住的寫入不得堵住新身分。
 */
export interface SessionGate extends HydrationGate {
	queueWrite<R>(w: QueuedWrite<R>): Promise<WriteOutcome<R | null>>;
}

/** queueWrite 收的寫入:與 Write<R> 相同,只差 send 可以回 null(= 不用送)。 */
type QueuedWrite<R> = Omit<Write<R>, 'send'> & { send: () => Promise<R> | null };

/** 沒送出就因換帳號作廢:stale,settled 是「未送出」的 rejected。 */
const NOT_SENT: WriteOutcome<never> = {
	kind: 'stale',
	settled: { status: 'rejected', reason: new Error('session 已變更,未送出') }
};

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

	function queueWrite<R>(w: QueuedWrite<R>): Promise<WriteOutcome<R | null>> {
		const mine = core.epoch();
		const stale = () => mine !== core.epoch();
		const wasHydrated = get(gate.hydrated);
		const undo = w.optimistic?.(); // 入列當下同步套用(畫面立即反映)
		const run = writeChain.then(() => runQueued(w, stale, wasHydrated, undo));
		writeChain = run.then(
			() => {},
			() => {}
		);
		return run;
	}

	async function runQueued<R>(
		w: QueuedWrite<R>,
		stale: () => boolean,
		wasHydrated: boolean,
		undo: (() => void) | void
	): Promise<WriteOutcome<R | null>> {
		if (stale()) return NOT_SENT;
		try {
			await gate.hydrate();
		} catch (error) {
			if (stale()) return NOT_SENT; // 換帳號:新身分的 store 不碰、不重抓
			const recovery = await recoverWrite(w.onFailure, undo, gate.refresh, stale);
			return recovery === 'stale' ? NOT_SENT : { kind: 'failed', error, recovery };
		}
		if (stale()) return NOT_SENT;
		if (!wasHydrated) w.optimistic?.(); // 水合的 apply 已用後端值蓋掉入列時的樂觀寫入,補回
		const p = w.send();
		if (p === null) return { kind: 'written', result: null };
		return gate.write({ ...w, optimistic: w.optimistic && (() => undo), send: () => p });
	}

	return { ...gate, reset, queueWrite };
}

/**
 * 門 (b) session refresher —— points / subscriptions。
 *
 * 保留「無條件重抓」語意(getDashboard/getAccount/getPoints/checkout-sync afterOrder/
 * CheckoutDialog/CartSheet 開啟時都依賴每次真抓,不得硬套 guard),只加三件事:
 * identity 變更清空(reset)+ 在飛換帳「靜默丟棄」+ 後發優先(見下)。丟棄必須靜默(return,不 throw)——
 * redeemReward await refreshPoints、placeOrder 的 afterOrder 會傳播 rejection,若在飛
 * 換帳改成 throw,等於新增一個「換帳號」失敗模式打進那兩條傳播鏈。
 *
 * R21:後發優先,用水合閘門的出發序帳(createDepartureLedger)。開啟結帳(refreshOnOpen)的 GET
 * 若在付款後(afterOrder)那支落地之後才到,帶的是付款前的舊快照,蓋回去會讓已持有的方案又變成計費行——
 * 被超車的落地同樣靜默丟棄。先查 epoch 再問 overtaken:overtaken 會推水位,只在套用前一刻問。
 * 帳本不隨身分重置:號碼只增不減,換帳前出發的落地先被 epoch 擋掉,碰不到帳。
 */
export function createSessionRefresher<T>(opts: {
	fetch: () => Promise<T>;
	apply: (data: T) => void;
	reset: () => void;
}): () => Promise<void> {
	const core = createSessionCore(opts.reset);
	const ledger = createDepartureLedger();
	return async () => {
		const epoch = core.epoch();
		const seq = ledger.depart();
		const data = await opts.fetch();
		if (epoch !== core.epoch()) return; // 在飛換帳:靜默丟棄(不套用、不 throw)
		if (ledger.overtaken(seq)) return; // 已有更晚出發的落地:靜默丟棄(不套用、不 throw、不重抓)
		opts.apply(data);
	};
}
