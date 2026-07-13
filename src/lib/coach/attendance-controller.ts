/* Dream Fly — coach/attendance 出席點名編排層（Round 3 K1，自 +page.svelte 的無測
 * 編排 script 抽出）。draft reducer（attendance-draft.ts，純轉移）之上一層：把頁面原本
 * 手焊的鏡射變數 ×5、snapshot/undo 副作用、byClass 切班暫存、save 生命週期收斂成一個
 * 可脫離 Svelte 直接測試的 controller。頁面退化為「單一快照 store 解構 + UI 翻譯 + toast
 * 文案」的薄 adapter。
 *
 * 分層：draft（怎麼轉移，純 TS）→ controller（何時轉移、效應注入，本檔）→ +page.svelte
 * （渲染與 toast 文案）。時鐘（now）與 saveAttendance 皆為注入依賴，無 svelte 元件相依、
 * 建構零副作用（SSR 安全）。
 *
 * save() 的 state guard（await 後 state!=='saving' 即丟棄回應）逐字複刻自頁面現行語意；
 * 其上再疊一層 save-token guard（K1 c3）：每次 save() ++seq 並捕捉 token，resolve 與 catch
 * 皆驗 token===seq，不符即丟棄過期回應——修掉 state guard 單獨存在時的 latent ABA 洞（儲存
 * 中先編輯把 state 打回 dirty、放行切班、再啟第二次 save 後，舊回應見 state==='saving' 穿透
 * guard 以 live curClassId 把舊班 roster 寫進新班；catch 更全無 guard 會把新班打成 failed）。
 * token guard 疊加、不取代 state guard——單一 in-flight 的行為逐點不變（page.test 16 it 續
 * 綠）。 */
import { writable, type Readable } from 'svelte/store';
import type { AttRow, AttDefault, AttClassFull } from '$lib/coach/data';
import {
	initDraft,
	setMark as draftSetMark,
	applyNote as draftApplyNote,
	markAllPresent as draftMarkAllPresent,
	undo as draftUndo,
	canSwitchClass,
	stashAndRestore,
	hadLate as draftHadLate,
	beginSave,
	applySaveResult,
	saveFailed,
	type SaveBar
} from '$lib/coach/attendance-draft';

/** 單一快照視圖：draft 的 SaveBar 欄位 + 當前班級/名冊來源（classes/curClassId）+ 復原
 *  可用性衍生（canUndo = 頁面舊 `prev != null` 的等價物）。頁面以一行解構鏡射。 */
export interface AttendanceViewState {
	classes: AttClassFull[];
	curClassId: string;
	marks: Record<string, AttDefault>;
	notes: Record<string, string>;
	state: 'dirty' | 'saving' | 'saved';
	savedAt: string | null;
	dirtyCount: number;
	canUndo: boolean;
}

/** save() 的結果：文案所需素材隨 outcome 攜帶，toast 文案逐字留頁面（不注入 toast 回呼）。
 *  stale = 回應過期被丟棄（頁面不做任何事，同現行 guard 的 `return`）。 */
export type SaveOutcome =
	| { kind: 'saved'; className: string; rosterCount: number; hadLate: boolean }
	| { kind: 'stale' }
	| { kind: 'failed'; error: unknown };

export interface AttendanceControllerDeps {
	/** 簽名對齊 coach/api.ts 的 saveAttendance（PUT /sessions/{id}/attendance）。 */
	saveAttendance: (sessionId: string, marks: Record<string, AttDefault>) => Promise<AttRow[]>;
	/** 壁鐘注入，必填無預設（頁面傳 nowHHMM）——儲存成功時間戳的唯一來源。 */
	now: () => string;
}

export interface AttendanceController extends Readable<AttendanceViewState> {
	init(classes: AttClassFull[]): void;
	setMark(mid: string, v: AttDefault): void;
	applyNote(mid: string, text: string): void;
	markAllPresent(): void;
	undo(): void;
	selectClass(name: string): 'switched' | 'blocked' | 'noop';
	save(): Promise<SaveOutcome>;
}

export function createAttendanceController(deps: AttendanceControllerDeps): AttendanceController {
	// ── 內部可變狀態（原頁面的鏡射變數 + 復原快照 + byClass 暫存） ────────────────
	let classes: AttClassFull[] = [];
	let curClassId = '';
	let marks: Record<string, AttDefault> = {};
	let notes: Record<string, string> = {};
	let state: 'dirty' | 'saving' | 'saved' = 'dirty';
	let savedAt: string | null = null;
	let dirtyCount = 0;
	let prev: SaveBar | null = null;
	let byClass: Record<string, SaveBar> = {};
	// save-token（K1 c3）：遞增序號。每次 save() 起始 ++seq 並捕捉為 token；resolve 與
	// catch 皆驗 token===seq，不符即丟棄過期回應。疊加在 state guard 之上、不取代它——
	// 單一 in-flight 的行為逐點不變。
	let seq = 0;

	// currentDraft/applyDraft：內部狀態 ⇄ draft reducer 的 SaveBar 雙向轉接（同頁面）。
	function currentDraft(): SaveBar {
		return { marks, notes, state, savedAt, dirtyCount };
	}
	function applyDraft(next: SaveBar): void {
		({ marks, notes, state, savedAt, dirtyCount } = next);
	}

	// 當前班級/名冊衍生（原頁面的 `$: curClass` / `$: roster`）。
	function curClass(): AttClassFull | undefined {
		return classes.find((c) => c.id === curClassId);
	}
	function roster(): AttRow[] {
		return curClass()?.roster ?? [];
	}

	// 修改前先快照（供復原），回傳同一份 draft 餵給接著的純函式轉移（同頁面 snapshot）。
	function takeSnapshot(): SaveBar {
		const before = currentDraft();
		prev = before;
		return before;
	}

	function viewState(): AttendanceViewState {
		return { classes, curClassId, marks, notes, state, savedAt, dirtyCount, canUndo: prev != null };
	}

	const store = writable<AttendanceViewState>(viewState());
	const publish = (): void => store.set(viewState());

	function init(loaded: AttClassFull[]): void {
		classes = loaded;
		const first = classes[0];
		curClassId = first?.id ?? '';
		applyDraft(initDraft(first?.roster ?? []));
		publish();
	}

	function setMark(mid: string, v: AttDefault): void {
		applyDraft(draftSetMark(takeSnapshot(), mid, v));
		publish();
	}

	function applyNote(mid: string, text: string): void {
		applyDraft(draftApplyNote(takeSnapshot(), mid, text));
		publish();
	}

	function markAllPresent(): void {
		applyDraft(draftMarkAllPresent(takeSnapshot(), roster()));
		publish();
	}

	function undo(): void {
		const restored = draftUndo(prev);
		if (!restored) return;
		applyDraft(restored);
		prev = null;
		publish();
	}

	function selectClass(name: string): 'switched' | 'blocked' | 'noop' {
		const next = classes.find((c) => c.name === name);
		if (!next || next.id === curClassId) return 'noop';
		// 儲存中不切班：in-flight 的 save 回呼只認得 live 狀態，把 'saving' 班級 stash 走會
		// 卡在儲存中永遠結束不了（成功 toast 也可能落錯班）。頁面據 'blocked' 發提示 toast。
		if (!canSwitchClass(currentDraft())) return 'blocked';
		const result = stashAndRestore(byClass, curClassId, currentDraft(), next);
		byClass = result.byClass;
		applyDraft(result.draft);
		prev = null;
		curClassId = next.id;
		publish();
		return 'switched';
	}

	async function save(): Promise<SaveOutcome> {
		applyDraft(beginSave(currentDraft()));
		publish();
		// 送出前（await 前）先快照是否含「遲到」——不受 in-flight 期間後續編輯影響，且不能
		// 由 await 後的伺服器回應推導（回應永不含 late，見 saveAttendance）。
		const hadLate = draftHadLate(marks);
		const token = ++seq;
		try {
			const updatedRoster = await deps.saveAttendance(curClassId, marks);
			// save-token guard（K1 c3）：ABA 併發時舊回應的 token 已非最新即丟棄——避免以 live
			// curClassId 把舊班 roster 寫進新班。疊加在下方 state guard 之上、不取代它。
			if (token !== seq) return { kind: 'stale' };
			// state-based stale guard：若 in-flight 期間又被編輯過（state 已變回 dirty），不要
			// 用這次回應蓋掉新的未存變更。逐字複刻頁面現行 guard。
			if (state !== 'saving') return { kind: 'stale' };
			classes = classes.map((c) => (c.id === curClassId ? { ...c, roster: updatedRoster } : c));
			applyDraft(applySaveResult(currentDraft(), updatedRoster, deps.now()));
			publish();
			return { kind: 'saved', className: curClass()?.name ?? '', rosterCount: updatedRoster.length, hadLate };
		} catch (error) {
			// save-token guard（K1 c3）：舊請求失敗的 token 已非最新即丟棄——不可把新班打成
			// failed（c1 此處全無 guard，是已知 latent 缺陷）。疊加在既有 catch 行為之上。
			if (token !== seq) return { kind: 'stale' };
			applyDraft(saveFailed(currentDraft()));
			publish();
			return { kind: 'failed', error };
		}
	}

	return { subscribe: store.subscribe, init, setMark, applyNote, markAllPresent, undo, selectClass, save };
}
