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
 * 無條件重抓，供使用者明確要求的「重新整理」與失敗重試共用。
 *
 * Legacy store-factory 風格（仿 load-gate.ts／stores/toasts.ts）：closure、無
 * `this`、無模組層副作用（SSR 安全，模組可被伺服端 import），不使用 runes。
 * fetch rejection 一律原樣拋出、不在此攔截——呼叫端的 load-gate 接手轉 error 態。
 */
import { writable, get, type Writable } from 'svelte/store';

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
}

export function createHydrationGate<T>(opts: HydrationGateOptions<T>): HydrationGate {
	const hydrated = writable(false);

	async function hydrate(): Promise<void> {
		if (get(hydrated)) return;
		const data = await opts.fetch();
		if (get(hydrated)) return; // mutation 發生於 in-flight 期間 — mutation 勝出，放棄覆寫
		opts.apply(data);
		hydrated.set(true);
	}

	async function refresh(): Promise<void> {
		// 一律真抓，無視 guard——守衛短路後的重新整理／重試仍要重抓。
		const data = await opts.fetch();
		opts.apply(data);
		hydrated.set(true);
	}

	function markMutated(): void {
		hydrated.set(true);
	}

	return { hydrated, hydrate, refresh, markMutated };
}
