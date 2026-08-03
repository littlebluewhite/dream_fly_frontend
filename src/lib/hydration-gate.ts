/**
 * 共享 store 水合閘門 factory。
 *
 * 收斂「共享 store 的水合協定」：guard 短路 + post-await re-check（mutation 勝出）
 * + mutator 翻旗。是 src/lib/mobile-admin/stores.ts 中 hydrateOps／hydrateMessages
 * 兩段逐字重複協定的深模組化（約 L122-132、L167-174）——後續任務會用本 factory
 * 原地替換那兩段，本模組本身不改動任何既有檔案。
 *
 * 核心語意：hydrate() 開頭若已水合就短路、不打 API；fetch 進行中若發生 mutation
 * （markMutated()，或呼叫端直接把 hydrated 設 true），await 結束後的 re-check 會
 * 讓 mutation 勝出、放棄套用剛抓回的資料——避免「水合前的本地寫入」被姍姍來遲的
 * 首次水合覆蓋（mobile-admin 的 C1 regression 即此類 bug）。refresh() 略過 guard、
 * 一律真抓，供使用者明確要求的「重新整理」與失敗重試共用；抓回的快照則走**世代穩定
 * 重抓**（fetchGenStable，R10 新增的第四決策點）——進場捕捉 mutation 世代、落地比對，
 * 期間發生的本地 mutation 會讓那份快照作廢並原地重抓，直到抓回一份「不早於最後一次
 * 本地 mutation 出發點」的快照才套用。
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
 *  協定的第四決策點（fetchGenStable，R10）**不在**這顆 core 裡：它只讀 mutation 世代、
 *  不讀旗標，而且是 refresh 族專用（hydrate 三點路徑不套），見下方該函式註解。 */
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
 * `iterate` 是棄追判準（預設恆真＝抓到穩定為止）：呼叫端若已知這一輪重抓不再有意義
 * （load-gate 的「已卸載／被新一輪 run 取代」），回傳假即停，回傳 `undefined` 表示
 * 「最後那份快照不要套用」——如何處置由呼叫端語意決定。省略 `iterate` 時永不棄追，
 * 型別上直接回 `T`，呼叫端不必處理不可能發生的出口。
 *
 * 任何一次 fetch 的 rejection（含第 N 次重抓的）一律**原樣拋出**，不吞、不回頭補套
 * 已被丟棄的舊快照——與本模組檔頭的「fetch rejection 原樣拋出」一致。
 */
export function fetchGenStable<T>(fetch: () => Promise<T>, gen: () => number): Promise<T>;
export function fetchGenStable<T>(
	fetch: () => Promise<T>,
	gen: () => number,
	iterate: () => boolean
): Promise<T | undefined>;
export async function fetchGenStable<T>(
	fetch: () => Promise<T>,
	gen: () => number,
	iterate: () => boolean = () => true
): Promise<T | undefined> {
	for (;;) {
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
	markMutated(): void;
	/** 唯讀:單調 mutation 世代（遞增仍只走 markMutated）。出閘是為了讓頁面的 load-gate
	 *  能經 `hydrate.gen` 讀到**同一本**世代帳——頁面的 refresh 族與 store 閘門共用一個
	 *  判準,不是各記各的。 */
	mutationGen(): number;
}

export function createHydrationGate<T>(opts: HydrationGateOptions<T>): HydrationGate {
	const hydrated = writable(false);
	const core = createHydrationCore(hydrated);
	// 帳本閉合輪：markMutated 帶單調世代，與「完整度」旗標分離。旗標可被呼叫端翻回
	// false（如 waitlist/leave 的和解重抓失敗留可重試路徑）——若 mutation-wins 只讀
	// 旗標當下值，翻回 false 等於拆掉 in-flight hydrate 的武裝，舊快照落地、直寫列
	// 蒸發。世代只增不減，hydrate 進場時捕捉、resolve 後比對，不受旗標之後的起落影響。
	let mutationGen = 0;

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
		// 不傳 iterate：store 層的 refresh 沒有「這一輪已無意義」的概念，抓到穩定為止。
		const data = await fetchGenStable(opts.fetch, () => mutationGen);
		opts.apply(data);
		core.commit();
	}

	function markMutated(): void {
		mutationGen += 1;
		core.commit();
	}

	return { hydrated, hydrate, refresh, markMutated, mutationGen: () => mutationGen };
}
