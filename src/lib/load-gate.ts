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
import { writable } from 'svelte/store';

export type LoadPhase = 'loading' | 'error' | 'ready';

export interface LoadGateOptions<T> {
	/** 主要抓取函式 */
	fetch: () => Promise<T>;
	/** 省略時 refresh() 沿用 fetch(mobile-admin store-owned 變體會分開傳 hydrate/refresh) */
	refresh?: () => Promise<T>;
	/** 只有 load() 檢查;回 true → 直接 ready、不打 API(守衛頁變體) */
	skip?: () => boolean;
	/** 成功時套用資料(頁面用它寫區域變數或共享 store) */
	onData?: (data: T) => void;
	/** 失敗時通知(coach 頁動態錯誤文案用) */
	onError?: (e: unknown) => void;
}

export interface LoadGate {
	/** Svelte store 契約;訂閱值 = LoadPhase */
	subscribe: (run: (phase: LoadPhase) => void) => () => void;
	load(): Promise<void>;
	refresh(): Promise<void>;
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
	const { subscribe, set } = writable<LoadPhase>('loading');
	let generation = 0;
	let destroyed = false;

	async function run(fetcher: () => Promise<T>): Promise<void> {
		const gen = ++generation;
		set('loading');
		try {
			const data = await fetcher();
			if (destroyed || gen !== generation) return; // 過期或已卸載,忽略
			options.onData?.(data);
			set('ready');
		} catch (e) {
			if (destroyed || gen !== generation) return;
			options.onError?.(e);
			set('error');
		}
	}

	async function load(): Promise<void> {
		if (options.skip?.()) {
			set('ready');
			return;
		}
		await run(options.fetch);
	}

	async function refresh(): Promise<void> {
		// 一律真抓,無視 skip——守衛短路後 retry 仍要重抓。
		await run(options.refresh ?? options.fetch);
	}

	function destroy(): void {
		destroyed = true;
	}

	autoDestroyOnUnmount(destroy);

	return { subscribe, load, refresh, destroy };
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
