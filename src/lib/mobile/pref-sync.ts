/* Dream Fly — mobile 帳號設定偏好同步機（R11 架構深化 Task 2，ADR 0012 名冊第九例）。
 * 自 SettingsScreen.svelte 內聯的偏好同步編排（原 onMount 背景水合、setPref 樂觀
 * 更新 + 單一 in-flight 序列鏈 saveChain、sendPref 失敗整包 resync/雙重失敗單鍵
 * 回滾）抽出，元件退薄殼。形抄 src/lib/public/contact-form.ts（ADR 0012 第八例）。
 *
 * 核心不變量：saveChain 序列鏈排隊時「不」固定快照——每一筆送出的整包快照要
 * 等到輪到它執行時，才從 prefs store 重新 get() 一次，不是 set() 呼叫當下(排隊
 * 時)就凍結。這樣連續快速切換時，後面那次送出永遠疊加在前一次(含其失敗後的
 * 整包 resync/單鍵回滾)之後的最新狀態，不會有「後面那筆沿用交錯當下的舊快照、
 * 把已回滾的值蓋回後端」的競態。
 *
 * deps.prefs 是呼叫端注入的既有共享 store($lib/mobile/stores)，非本模組自建——
 * 與 contact-form.ts 自建 draft/state 兩顆 store 的形不同：通知/深色模式偏好本
 * 就是跨畫面單例，元件 markup 仍直接讀 `$prefs` 綁定 4 個 Switch，本模組只接管
 * 寫入時機與序列化，不取代 store 本身，因此回傳型別不 extends Readable。
 *
 * toast 留元件(ADR 0011 呼叫端映射慣例，ADR 0012「守衛文案 vs toast 文案」成文
 * 界線)：本模組只回傳 outcome kind，繁中錯誤文案由 SettingsScreen 依 kind 組裝
 * ——'saved' 無 toast；'resynced'/'rolledBack' 各發一次「儲存失敗」。hydrate()
 * 失敗吞錯留快取，不 throw、不發 toast(讀取失敗不影響既有可用性，原行為照舊)。 */
import { get, type Writable } from 'svelte/store';
import { prefs, type Prefs } from '$lib/mobile/stores';
import { getPreferences, savePreferences } from '$lib/mobile/api';

export type PrefSetOutcome = { kind: 'saved' } | { kind: 'resynced' } | { kind: 'rolledBack' };

export interface PrefSyncDeps {
	/** GET /users/me 的映射結果，見 $lib/mobile/api.ts。 */
	getPreferences: () => Promise<Prefs>;
	/** PATCH /users/me 整包覆寫，見 $lib/mobile/api.ts。 */
	savePreferences: (p: Prefs) => Promise<void>;
	/** 呼叫端共享的 prefs store($lib/mobile/stores)：本模組讀寫，元件 markup 也
	 *  直接讀它(cache-first 顯示來源，載入前/離線時仍看得到目前值)。 */
	prefs: Writable<Prefs>;
}

export interface PrefSync {
	/** 背景水合：成功整包覆蓋 store，失敗吞錯留快取(console.error，不 throw)。 */
	hydrate(): Promise<void>;
	/** 樂觀更新鍵 `k` 後排入序列鏈；回傳這一筆送出的最終 outcome。 */
	set(k: keyof Prefs, v: boolean): Promise<PrefSetOutcome>;
}

export function createPrefSync(deps: PrefSyncDeps): PrefSync {
	let saveChain: Promise<void> = Promise.resolve();

	async function sendPref(k: keyof Prefs, before: boolean): Promise<PrefSetOutcome> {
		try {
			await deps.savePreferences(get(deps.prefs));
			return { kind: 'saved' };
		} catch (err) {
			console.error('pref-sync: 偏好儲存失敗', err);
			try {
				deps.prefs.set(await deps.getPreferences());
				return { kind: 'resynced' };
			} catch (resyncErr) {
				deps.prefs.update((p) => ({ ...p, [k]: before }));
				console.error('pref-sync: resync 失敗，退回單鍵回滾', resyncErr);
				return { kind: 'rolledBack' };
			}
		}
	}

	async function hydrate(): Promise<void> {
		try {
			deps.prefs.set(await deps.getPreferences());
		} catch (err) {
			console.error('pref-sync: 偏好載入失敗，沿用本地快取', err);
		}
	}

	function set(k: keyof Prefs, v: boolean): Promise<PrefSetOutcome> {
		const before = get(deps.prefs)[k];
		deps.prefs.update((p) => ({ ...p, [k]: v }));
		const outcome = saveChain.then(() => sendPref(k, before));
		saveChain = outcome.then(() => {});
		return outcome;
	}

	return { hydrate, set };
}

// 單一實例：SettingsScreen/EditProfileSheet 兩個呼叫端共用同一個 saveChain 序列鏈，
// 避免各自 createPrefSync() 一份、互不知道對方在飛的送出(見兩個呼叫端各自的
// 檔頭附註)。deps 用惰性包裝(() => getPreferences() 而非直傳函式參照)，讓
// `vi.mock('$lib/mobile/api')` 的工廠不會在本模組載入當下就需要 api.ts 已初始化
// 完成——無循環：pref-sync → api → stores。
export const prefSync = createPrefSync({
	getPreferences: () => getPreferences(),
	savePreferences: (p) => savePreferences(p),
	prefs
});
