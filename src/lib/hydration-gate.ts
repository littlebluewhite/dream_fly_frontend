/**
 * 共享 store 水合閘門 factory。
 *
 * 收斂「共享 store 的水合協定」：guard 短路 + post-await re-check（mutation 勝出）
 * + mutator 翻旗。是 src/lib/mobile-admin/stores.ts 中 hydrateOps／hydrateMessages
 * 兩段逐字重複協定的深模組化——那兩段已原地改用本 factory（見該檔 hydrateOps/
 * hydrateMessages 旁的 createHydrationGate 呼叫）。
 *
 * 核心語意：hydrate() 開頭若已水合就短路、不打 API；fetch 進行中若發生 mutation
 * （markMutated()，或呼叫端直接把 hydrated 設 true），await 結束後的 re-check 會
 * 讓 mutation 勝出、放棄套用剛抓回的資料——避免「水合前的本地寫入」被姍姍來遲的
 * 首次水合覆蓋（mobile-admin 的 C1 regression 即此類 bug）。refresh() 略過 guard、
 * 一律真抓，供使用者明確要求的「重新整理」與失敗重試共用；抓回的快照則走**世代穩定
 * 重抓**（fetchGenStable，R10 新增的第四決策點）——進場捕捉 mutation 世代、落地比對，
 * 期間發生的本地 mutation 會讓那份快照作廢並原地重抓，直到抓回一份「不早於最後一次
 * 本地 mutation 出發點」的快照才套用。R11 再補上**第五決策點：mutation settle 訊號**
 * ——refresh 族每次出發 fetch 之前，先等未 settle 的樂觀 mutation 尾流（markMutated 帶
 * 的 PATCH promise）全數落地，關掉「GET 搶在 PATCH 前面出發、server 回舊真值而世代
 * 又已穩定」的 server-race 窗（ADR 0020 誠實界線）。等待軸與丟棄軸正交。
 *
 * hydrate 路徑刻意**不**套這個迴圈：hydrate 的契約是 mutation-wins 直接丟棄（本地即
 * 真相，補抓的責任在後續的和解鏈）；refresh 的契約是顯式新鮮度，丟棄之後**必須**補抓，
 * 否則使用者按了「重新整理」卻什麼都沒發生。此不對稱是協定本體，不是遺漏。
 *
 * C1（架構深化 R5）：協定的三個決策點抽成 HydrationCore（見下方介面註解），
 * createHydrationGate 與 load-gate.ts 的 hydrate 選項共用同一顆 core——協定詞彙
 * 與文件自此單一住所。load-gate 委派的是「決策點」而不是整個 createHydrationGate：
 * 它的 F1 重入語意要求 into() 之後、翻旗之前重查 generation（見 load-gate.ts 的
 * applyLoaded 註解），而 createHydrationGate.hydrate() 無此環節，整體委派會破壞
 * 該語意。
 *
 * Legacy store-factory 風格（仿 load-gate.ts／stores/toasts.ts）：closure、無
 * `this`、無模組層副作用（SSR 安全，模組可被伺服端 import），不使用 runes。
 * fetch rejection 一律原樣拋出、不在此攔截——呼叫端的 load-gate 接手轉 error 態。
 */
import { writable, get, type Writable } from 'svelte/store';

/** 水合協定的三個決策點（C1）。詞彙對照：
 *  - guarded()：進場 guard——已水合就短路、不發 fetch。
 *  - mutationWins()：fetch resolve 後的 re-check——in-flight 期間旗標被翻 true
 *    （mutation 發生）即 mutation 勝出，放棄套用剛抓回的資料。
 *  - commit()：套用完成（或 mutator 直寫）後翻旗，宣告水合真相成立。
 *  guarded/mutationWins 目前機制相同（都讀旗標），但語意是協定裡兩個不同的
 *  決策點——分開命名讓呼叫端的意圖可讀、協定文件可逐點對照。
 *  協定的第四、第五決策點（fetchGenStable 的世代穩定與 mutation settle 訊號，R10／R11）
 *  **不在**這顆 core 裡：它們只讀 mutation 世代與尾流帳、不讀旗標，而且是 refresh 族專用
 *  （hydrate 三點路徑兩者都不套），見下方該函式註解。 */
export interface HydrationCore {
	guarded(): boolean;
	mutationWins(): boolean;
	commit(): void;
}

/** 以呼叫端提供的旗標建 core——createHydrationGate 自建旗標；load-gate 的 hydrate
 *  選項則傳入頁面共用的旗標（mutator 直接對它 set(true)）。 */
export function createHydrationCore(hydrated: Writable<boolean>): HydrationCore {
	return {
		guarded: () => get(hydrated),
		mutationWins: () => get(hydrated),
		commit: () => hydrated.set(true)
	};
}

/** fetchGenStable 的可選旋鈕(R11 起 options bag：第三參數同時要帶棄追判準與 settle
 *  訊號,兩個正交決策不再擠位置參數)。 */
export interface FetchGenStableOptions {
	/** 棄追判準（預設恆真＝抓到穩定為止）；語意見 fetchGenStable 註解。 */
	iterate?: () => boolean;
	/** mutation 尾流的 settle 訊號（第五決策點，R11）：有未 settle 的尾流就回一個
	 *  「全數 settle 時 resolve」的 promise，靜止時**同步**回 undefined。語意見
	 *  HydrationGate.pendingSettle。 */
	pendingSettle?: () => Promise<void> | undefined;
}

/**
 * 第四決策點（R10）：**世代穩定重抓**——refresh 族專用。
 *
 * 進場捕捉 `gen()` → `fetch()` → 落地再讀一次 `gen()` 比對：相同代表這份快照的出發點
 * 不早於最後一次本地 mutation，可以套用；不同代表「refresh **進場之後**」有 mutation
 * 落地（例如使用者在飛行窗口內按了取消／已讀），該份快照已是舊事實，丟棄並原地重抓，
 * 直到世代穩定為止。
 *
 * 判準只認「進場之後才發生的 mutation」，**絕不可**改讀旗標／世代的當下值：像
 * mobile-admin 的「寫入 → markMutated → await refreshOps()」是正常序列，mutation 發生
 * 在進場之前，那份快照必須照常套用、且只能發一次 fetch。
 *
 * `opts.iterate` 是棄追判準（預設恆真＝抓到穩定為止）：呼叫端若已知這一輪重抓不再有意義
 * （load-gate 的「已卸載／被新一輪 run 取代」），回傳假即停，回傳 `undefined` 表示
 * 「最後那份快照不要套用」——如何處置由呼叫端語意決定。省略 `iterate` 時永不棄追，
 * 型別上直接回 `T`，呼叫端不必處理不可能發生的出口。
 *
 * `opts.pendingSettle` 是**第五決策點（R11）：mutation settle 訊號**——迴圈前導（每次
 * 出發前，含第 N 次補抓輪）先問「還有未 settle 的樂觀 mutation 尾流嗎」，有就等到全數
 * settle 再捕捉世代、出發 fetch。理由：樂觀 mutation 是 mark-before-await（先寫 store
 * ＋ markMutated，才 await PATCH），GET 若在 PATCH 仍在飛時出發，server 回的是舊真值、
 * 而世代此刻**已經穩定**，舊快照照樣落地（ADR 0020 誠實界線記載的 GET/PATCH
 * server-race）。**等待軸與丟棄軸正交**：等待不看世代，丟棄仍只看進出場世代比對，兩者
 * 不得互換。等待期間醒來後先問一次 `iterate()`——這一輪可能已被取代／卸載。
 *
 * 任何一次 fetch 的 rejection（含第 N 次重抓的）一律**原樣拋出**，不吞、不回頭補套
 * 已被丟棄的舊快照——與本模組檔頭的「fetch rejection 原樣拋出」一致。
 */
export function fetchGenStable<T>(
	fetch: () => Promise<T>,
	gen: () => number,
	opts?: { iterate?: undefined; pendingSettle?: () => Promise<void> | undefined }
): Promise<T>;
export function fetchGenStable<T>(
	fetch: () => Promise<T>,
	gen: () => number,
	opts: FetchGenStableOptions
): Promise<T | undefined>;
export async function fetchGenStable<T>(
	fetch: () => Promise<T>,
	gen: () => number,
	opts?: FetchGenStableOptions
): Promise<T | undefined> {
	const iterate = opts?.iterate ?? (() => true);
	for (;;) {
		// 第五決策點:未 settle 的 mutation 尾流在場就等,不讓 GET 搶在 PATCH 前面出發。
		// 靜止時 pendingSettle() **同步**回 undefined,迴圈體一次都不跑、一個 microtask 都不
		// 多花——世代捕捉因此仍與呼叫端同步發生,「refresh 之後才 markMutated」的在飛判準
		// 不鬆動。
		// 必須是**迴圈**不是單次 await:等待的 promise 已 resolve、本函式卻還沒恢復執行,這
		// 中間的 microtask 仍可能跑一筆 markMutated(tail)(pendingSettle 內部的醒後重查補不到
		// 這一段)。醒來一律重問,不靜止就再等;從最後一次重問到下面的 gen()/fetch() 之間全
		// 程同步,沒有第三方插隊的餘地。
		for (let wait = opts?.pendingSettle?.(); wait; wait = opts?.pendingSettle?.()) {
			await wait;
			if (!iterate()) return undefined; // 棄追:等待期間這一輪已無意義
		}
		const entered = gen();
		const data = await fetch();
		if (entered === gen()) return data; // 世代穩定:進場之後零 mutation,快照可套用
		if (!iterate()) return undefined; // 棄追:呼叫端宣告這一輪已無意義
	}
}

export interface HydrationGateOptions<T> {
	/** 主要抓取函式 */
	fetch: () => Promise<T>;
	/** 成功時套用資料（通常是寫回呼叫端的共享 store） */
	apply: (data: T) => void;
}

export interface HydrationGate {
	/** 是否已水合；曝露同一個 writable 實例，呼叫端（頁面 skip 守衛、測試重置縫）
	 *  直接讀寫它，不是唯讀投影。 */
	hydrated: Writable<boolean>;
	hydrate(): Promise<void>;
	refresh(): Promise<void>;
	/** `tail` 在場＝這筆 mutation 有網路尾流（樂觀 mutation 的 PATCH）：閘門以
	 *  `tail.then(done, done)` 記帳,**reject 也算 settle**——失敗路徑出帳是結構保證,不靠
	 *  呼叫端記得 catch。省略 `tail` ＝無尾流(如 demo mutation),行為與 R11 前完全相同。
	 *  呼叫端義務:`tail` 必須是純網路尾流,不得是「內部會等這顆閘門 refresh」的 promise
	 *  (那會互等)。 */
	markMutated(tail?: Promise<unknown>): void;
	/** 唯讀:單調 mutation 世代（遞增仍只走 markMutated）。出閘是為了讓頁面的 load-gate
	 *  能經 `hydrate.gen` 讀到**同一本**世代帳——頁面的 refresh 族與 store 閘門共用一個
	 *  判準,不是各記各的。 */
	mutationGen(): number;
	/** 第五決策點的訊號源（R11）：有未 settle 的 mutation 尾流 → 回一個「全數 settle 時
	 *  resolve」的 promise（內部醒來會重查，等待期間新入帳的尾流一併等完才 resolve）；
	 *  靜止 → **同步**回 `undefined`。
	 *  【硬契約】靜止時不得回 resolved promise：多一個 microtask 會讓 fetchGenStable 的
	 *  世代捕捉晚於「refresh 之後同步 markMutated」，在飛丟棄的時序判準就此鬆掉。
	 *  出閘理由同 mutationGen:頁面 load-gate 經 `hydrate.pendingSettle` 讀同一本尾流帳。 */
	pendingSettle(): Promise<void> | undefined;
	/** 清空尾流帳並喚醒全部等待者(R11 終審修波)。給「尾流的擁有者已不存在」的重置點用
	 *  ——目前唯一呼叫端是 session-gate 的 identity onChange:A 帳號一筆掛死的 PATCH 不得
	 *  讓 B 帳號的 refresh 永遠等待(「尾流必然 settle」這個自癒前提只在同身分內成立)。
	 *  清帳後在飛的舊尾流 settle 時**不再出帳**(帳本帶世代戳記),故 `pendingTails >= 0`
	 *  恆成立、也不會把重置後新入帳的尾流沖掉。被喚醒的舊 refresh 由既有的丟棄軸/epoch
	 *  核對處置(不套用跨身分的舊快照),喚醒本身不搬運任何資料。 */
	clearPendingTails(): void;
}

export function createHydrationGate<T>(opts: HydrationGateOptions<T>): HydrationGate {
	const hydrated = writable(false);
	const core = createHydrationCore(hydrated);
	// 帳本閉合輪：markMutated 帶單調世代，與「完整度」旗標分離。旗標可被呼叫端翻回
	// false（如 waitlist/leave 的和解重抓失敗留可重試路徑）——若 mutation-wins 只讀
	// 旗標當下值，翻回 false 等於拆掉 in-flight hydrate 的武裝，舊快照落地、直寫列
	// 蒸發。世代只增不減，hydrate 進場時捕捉、resolve 後比對，不受旗標之後的起落影響。
	let mutationGen = 0;
	// 第五決策點（R11）：未 settle 的 mutation 尾流帳。markMutated(tail) 入帳、tail settle
	// （fulfil 或 reject 都算）出帳；帳上非空時 refresh 族等待,不讓 GET 搶在 PATCH 前面。
	// 與世代帳分離:世代管「丟棄」、尾流帳管「等待」,兩軸正交。
	let pendingTails = 0;
	let settleWaiters: Array<() => void> = [];
	// 尾流帳本的世代(R11 終審修波):clearPendingTails() 推進它,在飛舊尾流的出帳回呼據此
	// 作廢——否則「清帳 → 新尾流入帳 → 舊尾流姍姍來遲地 settle」會把新帳減掉(甚至減成負數),
	// F2 想關的窗換一個身分原封不動地重開。
	let tailEpoch = 0;

	async function hydrate(): Promise<void> {
		if (core.guarded()) return;
		const gen = mutationGen;
		const data = await opts.fetch();
		// 世代變（markMutated）或旗標被直接翻 true（呼叫端慣例，見檔頭）都算 mutation 勝出。
		if (gen !== mutationGen || core.mutationWins()) return;
		opts.apply(data);
		core.commit();
	}

	async function refresh(): Promise<void> {
		// 一律真抓，無視 guard——守衛短路後的重新整理／重試仍要重抓。落地則走世代穩定
		// 重抓：進場之後才發生的 mutation 會讓那份快照作廢、原地補抓（見 fetchGenStable）。
		// 出發前先等自家的 mutation 尾流 settle（第五決策點）：GET 不搶在 PATCH 前面。
		// 不傳 iterate：store 層的 refresh 沒有「這一輪已無意義」的概念，抓到穩定為止。
		const data = await fetchGenStable(opts.fetch, () => mutationGen, { pendingSettle });
		opts.apply(data);
		core.commit();
	}

	function markMutated(tail?: Promise<unknown>): void {
		// 記帳順序是契約:尾流**先**入帳,才推世代/翻旗。core.commit() 的 hydrated.set(true) 在
		// 旗標原為 false 時(mutation 前尚未水合、或和解失敗把旗標翻回 false)走的是 false→true
		// 這道邊沿,會同步通知 subscriber(svelte writable 只對 primitive **相同值**短路,
		// true→true 才不通知),subscriber 若在那個回呼裡同步
		// 重入 refresh(),而尾流還沒入帳,pendingSettle() 就會回 undefined —— GET 帶著已遞增
		// 的世代同步出發,settle 後世代比對相符、server 舊真值照樣落地(丟棄軸接不住,世代已穩)。
		// 入帳全程同步(pendingTails += 1 與 then 掛載都不 await),靜止路徑一個 microtask 都不多花。
		if (tail) {
			const epoch = tailEpoch; // 這筆尾流記在哪一本帳上
			pendingTails += 1;
			const settled = (): void => {
				if (epoch !== tailEpoch) return; // 帳已被清(跨身分重置):這筆不再出帳
				pendingTails -= 1;
				if (pendingTails > 0) return;
				const waiters = settleWaiters;
				settleWaiters = []; // 先清空再喚醒：醒來者若重新排隊，排的是新一批
				waiters.forEach((wake) => wake());
			};
			tail.then(settled, settled); // reject 也出帳（失敗的 mutation 一樣是「不再在飛」）
		}
		// 無尾流的 mutation(如 demo mutation)略過上面整段,行為與 R11 前逐字相同。
		mutationGen += 1;
		core.commit();
	}

	function pendingSettle(): Promise<void> | undefined {
		if (pendingTails === 0) return undefined; // 靜止：同步回 undefined（硬契約，見介面註解）
		return (async () => {
			// 醒來重查：被喚醒到等待者真正恢復執行之間，可能又有尾流入帳（下一筆
			// mark-before-await），不靜止就繼續等——「等到真的靜止」才是這支 promise 的語意。
			while (pendingTails > 0) await new Promise<void>((wake) => settleWaiters.push(wake));
		})();
	}

	function clearPendingTails(): void {
		tailEpoch += 1; // 先換帳本:在飛舊尾流的出帳回呼就此作廢,不會減到下一本帳
		pendingTails = 0;
		const waiters = settleWaiters;
		settleWaiters = []; // 先清空再喚醒:醒來者若重新排隊(新身分的尾流),排的是新一批
		waiters.forEach((wake) => wake());
	}

	return {
		hydrated,
		hydrate,
		refresh,
		markMutated,
		mutationGen: () => mutationGen,
		pendingSettle,
		clearPendingTails
	};
}
