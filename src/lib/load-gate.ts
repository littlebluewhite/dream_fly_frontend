/**
 * 三態載入閘門(loading/error/ready)的唯一機制來源。
 *
 * 現況:49 個檔案(44 個 route 頁 + ScheduleCalendar + 4 個 mobile overlay)各自手抄
 * `let phase; load(); onMount(load); retry` 樣板,四軸變異(卸載守衛有無、
 * load/refresh 拆分、*Hydrated 守衛、retry 接法)導致同一類 bug 逐頁修逐頁測。
 * 本模組把這套機制收斂成單一 factory,後續任務會把 49 個呼叫端遷移到它之上。
 *
 * Legacy store factory 風格(仿 stores/toasts.ts 的 createToasts):closure、
 * 無 `this`,回傳物件的 `subscribe` 直接轉發 svelte/store 的 writable,頁面以
 * `$gate` 讀取狀態。不自動 load、不在模組層讀 localStorage、無建構副作用
 * (SSR 安全,模組可被伺服端 import)。
 *
 * 兩個 factory:
 *   - createLoadGate:單純三態載入,phase 是唯一狀態。
 *   - createPagedLoadGate:多一層分頁 meta(page/total/perPage),外加
 *     changePage()(邊界檢查)與 silentRefresh()(突變後靜默重同步、不動 phase)。
 *
 * generation 計數器確保「後發請求優先」——每次發出請求前遞增計數並捕捉序號,
 * 回應到達時序號對不上(或已 destroy)一律丟棄,不寫 phase、不呼叫
 * onData/onError。
 */
import { onDestroy } from 'svelte';
import { writable, get, type Writable } from 'svelte/store';

export type LoadPhase = 'loading' | 'error' | 'ready';

interface LoadGateBaseOptions<T> {
	/** 主要抓取函式 */
	fetch: () => Promise<T>;
	/** 省略時 refresh() 沿用 fetch(mobile-admin store-owned 變體會分開傳 hydrate/refresh) */
	refresh?: () => Promise<T>;
	/** 只有 load() 檢查;回 true → 直接 ready、不打 API(守衛頁變體) */
	skip?: () => boolean;
	/** 失敗時通知(coach 頁動態錯誤文案用) */
	onError?: (e: unknown) => void;
}

/** hydrate 選項:把「共享 store 的水合協定」(guard 短路 + post-await re-check +
 *  mutator 翻旗,語意同 $lib/hydration-gate 的 createHydrationGate)收進 load-gate
 *  本身,取代呼叫端手焊的 skip+onData 組合。與 onData 型別層互斥,見下方
 *  LoadGateOptions。 */
export interface LoadGateHydrateOptions<T> {
	/** 是否已水合的旗標;與 mutator 共用同一個 writable(mutator 直接對它
	 *  set(true),同 hydration-gate.ts 的 markMutated() 語意)。 */
	flag: Writable<boolean>;
	/** 成功時套用資料,寫回共享 store。 */
	into: (data: T) => void;
}

/** onData 與 hydrate 型別層互斥(discriminated union + `?: never`):一個 gate 只能
 *  擇一,誤用在編譯期擋下,不做 runtime throw。 */
export type LoadGateOptions<T> =
	| (LoadGateBaseOptions<T> & { onData?: (data: T) => void; hydrate?: never })
	| (LoadGateBaseOptions<T> & { hydrate: LoadGateHydrateOptions<T>; onData?: never });

export interface LoadGate {
	/** Svelte store 契約;訂閱值 = LoadPhase */
	subscribe: (run: (phase: LoadPhase) => void) => () => void;
	load(): Promise<void>;
	refresh(): Promise<void>;
	/** 突變後靜默重同步、不動 phase（同 PagedLoadGate.silentRefresh() 語意，Task F4
	 *  補上對稱實作——非分頁頁面寫入成功後也需要不閃爍骨架的靜默刷新）。 */
	silentRefresh(): Promise<void>;
	destroy(): void;
}

/** 掛載一次性生命週期:元件內自動隨卸載呼叫 destroy;元件外(模組測試等)沒有
 *  生命週期可掛,靜默略過,呼叫端需自行呼叫 destroy()。 */
function autoDestroyOnUnmount(destroy: () => void): void {
	try {
		onDestroy(destroy);
	} catch {
		/* 元件外建構(模組測試等)無生命週期可掛,呼叫端自行 destroy */
	}
}

export function createLoadGate<T>(options: LoadGateOptions<T>): LoadGate {
	let phase: LoadPhase = 'loading';
	const { subscribe, set } = writable<LoadPhase>(phase);
	let generation = 0;
	let destroyed = false;

	function setPhase(p: LoadPhase): void {
		phase = p;
		set(p);
	}

	/** load() 成功後套用資料:hydrate 選項下需重查旗標——in-flight 期間旗標被翻
	 *  true(mutation 發生)代表 mutation 勝出,放棄套用、不覆寫共享 store(phase 仍
	 *  會在 run() 收斂為 ready,資料已經在 store 裡);未帶 hydrate 時退回既有
	 *  onData 語意。
	 *
	 *  F1(codex B0 r1):into() 通常寫共享 writable,其 subscriber 可能同步重入
	 *  gate.load()(generation++、發第二次 fetch)。into() 返回後、flag.set(true) 之前
	 *  重查 generation——不符(或已 destroy)代表已被重入的新一輪取代,直接 return、
	 *  不翻旗(翻旗交給新一輪自己的 applyLoaded 呼叫);否則舊一輪的翻旗會讓新一輪的
	 *  回應在自己的旗標重查時誤判 mutation 勝出,把真正的新資料丟棄。 */
	function applyLoaded(data: T, gen: number): void {
		const hydrate = options.hydrate;
		if (!hydrate) {
			options.onData?.(data);
			return;
		}
		if (get(hydrate.flag)) return; // mutation 勝出,不覆寫、不翻旗
		hydrate.into(data);
		if (destroyed || gen !== generation) return; // into() 同步重入觸發了新一輪,翻旗交給新一輪
		hydrate.flag.set(true);
	}

	/** refresh()/silentRefresh() 共用的資料套用:無條件套用,不做旗標重查(後發先至
	 *  的競態由既有 generation 機制管)。 */
	function applyRefreshed(data: T): void {
		const hydrate = options.hydrate;
		if (!hydrate) {
			options.onData?.(data);
			return;
		}
		hydrate.into(data);
		hydrate.flag.set(true);
	}

	async function run(
		fetcher: () => Promise<T>,
		apply: (data: T, gen: number) => void
	): Promise<void> {
		const gen = ++generation;
		setPhase('loading');
		try {
			const data = await fetcher();
			if (destroyed || gen !== generation) return; // 過期或已卸載,忽略
			apply(data, gen);
			// F1(codex B0 r1):apply()(hydrate 的 into())可能同步重入 load(),推進
			// generation——此時 phase 收斂的主導權已經交給新一輪,舊一輪不得再推 phase。
			if (destroyed || gen !== generation) return;
			setPhase('ready');
		} catch (e) {
			if (destroyed || gen !== generation) return;
			options.onError?.(e);
			setPhase('error');
		}
	}

	async function load(): Promise<void> {
		if (options.skip?.()) {
			setPhase('ready');
			return;
		}
		if (options.hydrate && get(options.hydrate.flag)) {
			// 已水合 → 短路,不發 fetch,同 skip 語意。
			setPhase('ready');
			return;
		}
		await run(options.fetch, applyLoaded);
	}

	async function refresh(): Promise<void> {
		// 一律真抓,無視 skip/hydrate 旗標——守衛短路後 retry 仍要重抓。
		await run(options.refresh ?? options.fetch, applyRefreshed);
	}

	async function silentRefresh(): Promise<void> {
		// 突變後靜默重同步:任何路徑都不動 phase、失敗也不呼叫 onError(同
		// PagedLoadGate.silentRefresh()——見該函式註解的完整理由)。守衛必須在
		// generation 遞增之前:phase 非 ready 直接 no-op。
		if (phase !== 'ready') return;
		const gen = ++generation;
		try {
			const data = await (options.refresh ?? options.fetch)();
			if (destroyed || gen !== generation) return;
			applyRefreshed(data);
		} catch {
			/* 靜默吞掉 */
		}
	}

	function destroy(): void {
		destroyed = true;
	}

	autoDestroyOnUnmount(destroy);

	return { subscribe, load, refresh, silentRefresh, destroy };
}

export interface PagedResponse {
	total: number;
	page: number;
	perPage: number;
}

export interface PagedLoadGateOptions<T extends PagedResponse> {
	fetch: (page: number) => Promise<T>;
	onData?: (data: T) => void;
	onError?: (e: unknown) => void;
	/** 首次回應前的 perPage 初值;預設 10 */
	perPage?: number;
}

export interface PagedGateState {
	phase: LoadPhase;
	page: number;
	total: number;
	perPage: number;
}

export interface PagedLoadGate {
	/** 訂閱值 = PagedGateState */
	subscribe: (run: (state: PagedGateState) => void) => () => void;
	load(p?: number): Promise<void>;
	changePage(p: number): void;
	refresh(): void;
	silentRefresh(): Promise<void>;
	destroy(): void;
}

export function createPagedLoadGate<T extends PagedResponse>(
	options: PagedLoadGateOptions<T>
): PagedLoadGate {
	let state: PagedGateState = {
		phase: 'loading',
		page: 1,
		total: 0,
		perPage: options.perPage ?? 10
	};
	const { subscribe, set } = writable<PagedGateState>(state);
	let generation = 0;
	let destroyed = false;

	function patch(next: Partial<PagedGateState>): void {
		state = { ...state, ...next };
		set(state);
	}

	async function load(p?: number): Promise<void> {
		// 事件安全:事件物件不是 number,typeof 擋下、沿用當前頁。
		const page = typeof p === 'number' ? p : state.page;
		if (typeof p === 'number') patch({ page }); // 樂觀先寫頁碼,失敗也保留(重試=重試失敗那頁)

		const gen = ++generation;
		patch({ phase: 'loading' });
		try {
			const r = await options.fetch(page);
			if (destroyed || gen !== generation) return;
			patch({ total: r.total, page: r.page, perPage: r.perPage }); // 以回應為準
			options.onData?.(r);
			patch({ phase: 'ready' });
		} catch (e) {
			if (destroyed || gen !== generation) return;
			options.onError?.(e);
			patch({ phase: 'error' });
		}
	}

	function changePage(p: number): void {
		const maxPage = Math.max(1, Math.ceil(state.total / state.perPage));
		if (p < 1 || p > maxPage) return;
		void load(p);
	}

	function refresh(): void {
		// 重抓當前頁,等同 load() 無參數;宣告零參數以維持事件安全。
		void load();
	}

	async function silentRefresh(): Promise<void> {
		// 突變後靜默重同步:任何路徑都不動 phase、失敗也不呼叫 onError。
		// 守衛必須在 generation 遞增之前:phase 非 ready 直接 no-op——loading 代表有
		// in-flight 的 load(),遞增 generation 會讓它的回應被誤判為過期而丟棄、phase 永遠
		// 卡在 loading;error 雖已 settle 但列表未渲染,靜默重同步無意義(重試走 refresh())。
		// (2026-07-07 對抗審後強化)
		if (state.phase !== 'ready') return;
		const gen = ++generation;
		try {
			const r = await options.fetch(state.page);
			if (destroyed || gen !== generation) return;
			patch({ total: r.total, page: r.page, perPage: r.perPage });
			options.onData?.(r);
		} catch {
			/* 靜默吞掉 */
		}
	}

	function destroy(): void {
		destroyed = true;
	}

	autoDestroyOnUnmount(destroy);

	return { subscribe, load, changePage, refresh, silentRefresh, destroy };
}
