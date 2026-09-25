/* Dream Fly — coach/attendance 出席點名編排層（Round 3 K1，自 +page.svelte 的無測
 * 編排 script 抽出；草稿轉移函式自 R12 起由舊 attendance-draft.ts 收進本檔成非匯出內部
 * 函式）。把頁面原本手焊的鏡射變數 ×5、snapshot/undo 副作用、byClass 切班暫存、save
 * 生命週期收斂成一個可脫離 Svelte 直接測試的 controller。頁面退化為「單一快照 store 解構
 * + UI 翻譯 + toast 文案」的薄 adapter。
 *
 * 分層：controller（草稿怎麼轉移 + 何時轉移、效應注入，本檔）→ +page.svelte（渲染與
 * toast 文案）。時鐘（now，預設 nowHHMM）與 saveAttendance 皆為注入依賴，無 svelte 元件
 * 相依、建構零副作用（SSR 安全）。
 *
 * 備註（notes）僅存本機：後端 PUT /sessions/{id}/attendance 無備註欄位，故 applyNote 只寫
 * notes、不動 state/dirtyCount（不算「待同步」變更）；儲存成功照舊保留 notes，重新整理即消失。
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

type SaveBar = {
	marks: Record<string, AttDefault>;
	notes: Record<string, string>;
	state: 'dirty' | 'saving' | 'saved';
	savedAt: string | null;
	dirtyCount: number;
};

// ── 草稿轉移（純函式，非匯出；行為經 controller 介面測試） ────────────────────

function buildMarks(rows: AttRow[]): Record<string, AttDefault> {
	return Object.fromEntries(rows.map((r) => [r.mid, r.def] as [string, AttDefault]));
}

/** 一個班級名冊剛載入（或切班切到尚未存過草稿的班級）時的初始草稿——marks 取名冊預設
 *  值，dirtyCount 為非 present 筆數（原「已有幾筆待處理」的起始基準）。 */
function initDraft(roster: AttRow[]): SaveBar {
	return {
		marks: buildMarks(roster),
		notes: {},
		state: 'dirty',
		savedAt: null,
		dirtyCount: roster.filter((r) => r.def !== 'present').length
	};
}

/** 單一學員狀態變更（AttSegment 點擊）。無論設成什麼值（含設成目前已有的值），
 *  dirtyCount 一律 +1——原頁面行為即是如此，不做「值未變就不計」的去重判斷。 */
function draftSetMark(draft: SaveBar, mid: string, v: AttDefault): SaveBar {
	return { ...draft, marks: { ...draft.marks, [mid]: v }, state: 'dirty', dirtyCount: draft.dirtyCount + 1 };
}

/** 備註儲存（備註 Dialog/Sheet 的「儲存備註」）。備註僅存本機（後端點名 PUT 無備註欄位），
 *  不是待同步變更——只寫 notes，state/dirtyCount 不動（D1；取代 codex r1 的「備註算 dirty」）。 */
function draftApplyNote(draft: SaveBar, mid: string, text: string): SaveBar {
	return { ...draft, notes: { ...draft.notes, [mid]: text } };
}

/** 全部標記出席。codex r2 (P2)：dirtyCount 要加上這次批次動作「實際改變」的筆數，
 *  save bar / 狀態卡才不會在同步後誤報「0 筆變更」。changed 計數規則：請假（leave）
 *  列不算變更（維持請假，不會被覆寫）；其餘列只有「目前」尚未是 present 才算一筆
 *  變更（比對 draft.marks 現況，不是 r.def 原始預設值——已手動標記過 present 的不
 *  重複計）。 */
function draftMarkAllPresent(draft: SaveBar, roster: AttRow[]): SaveBar {
	const changed = roster.filter((r) => r.def !== 'leave' && draft.marks[r.mid] !== 'present').length;
	const marks = Object.fromEntries(
		roster.map((r) => [r.mid, r.def === 'leave' ? 'leave' : 'present'] as [string, AttDefault])
	);
	return { ...draft, marks, state: 'dirty', dirtyCount: draft.dirtyCount + changed };
}

/** mid-save 切班擋：儲存中不可切換班級——in-flight 的 save 回呼只認得目前這份 live
 *  狀態，若被 stash 走會卡在「儲存中」永遠結束不了（也可能讓成功 toast 落在錯的班級）。 */
function canSwitchClass(draft: SaveBar): boolean {
	return draft.state !== 'saving';
}

/** 切換班級：把目前班級（fromId）的整份草稿存進 byClass，換上目標班級既有草稿（若無則
 *  initDraft 全新一份）。回傳新的 byClass 與應套用的新草稿。 */
function stashAndRestore(
	byClass: Record<string, SaveBar>,
	fromId: string,
	fromDraft: SaveBar,
	next: AttClassFull
): { byClass: Record<string, SaveBar>; draft: SaveBar } {
	const nextByClass = { ...byClass, [fromId]: fromDraft };
	const draft = nextByClass[next.id] ?? initDraft(next.roster);
	return { byClass: nextByClass, draft };
}

/** 送出前是否含「遲到」標記——需在呼叫 saveAttendance 之前（await 前）以目前 marks
 *  捕捉，不受 in-flight 期間的後續編輯影響（成功 toast 的折疊說明依這個快照決定）。 */
function draftHadLate(marks: Record<string, AttDefault>): boolean {
	return Object.values(marks).some((m) => m === 'late');
}

/** 進入儲存中——只翻轉 state，其餘欄位不動。 */
function beginSave(draft: SaveBar): SaveBar {
	return { ...draft, state: 'saving' };
}

/** 儲存成功：以伺服器回傳的最新名冊覆蓋 marks（而非樂觀本地值），dirtyCount 歸零。
 *  notes 不受影響（備註僅存本機，獨立於出席儲存）。savedAt 由呼叫端傳入。 */
function applySaveResult(draft: SaveBar, serverRoster: AttRow[], savedAt: string): SaveBar {
	return { ...draft, marks: buildMarks(serverRoster), state: 'saved', savedAt, dirtyCount: 0 };
}

/** 儲存失敗：退回 'dirty' 讓教練可重試；marks/notes/dirtyCount/savedAt 維持不動
 *  （若在 in-flight 期間又編輯過，不覆蓋那些新變更）。 */
function saveFailed(draft: SaveBar): SaveBar {
	return { ...draft, state: 'dirty' };
}

/** 目前時間 "HH:MM"（本地壁鐘）——儲存成功「已同步至雲端」時間戳的預設來源（deps.now
 *  省略時用它），頁面 saved 狀態卡 savedAt 缺值時的後備顯示也用它。 */
export function nowHHMM(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

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
	/** 壁鐘注入，可選，預設 nowHHMM——儲存成功時間戳的唯一來源（測試注入以固定時間）。 */
	now?: () => string;
}

export interface AttendanceController extends Readable<AttendanceViewState> {
	init(classes: AttClassFull[]): void;
	setMark(mid: string, v: AttDefault): void;
	applyNote(mid: string, text: string): void;
	markAllPresent(): void;
	undo(): void;
	selectClass(id: string): 'switched' | 'blocked' | 'noop';
	save(): Promise<SaveOutcome>;
}

export function createAttendanceController(deps: AttendanceControllerDeps): AttendanceController {
	const now = deps.now ?? nowHHMM;
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

	// currentDraft/applyDraft：內部狀態 ⇄ 草稿轉移函式的 SaveBar 雙向轉接（同頁面）。
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
		if (!prev) return;
		// prev 可能是 in-flight save 期間由 applyNote 取的快照（prev.state === 'saving'）——
		// 若此刻已不在儲存中（save 已 resolve/reject 落地），原樣還原會把畫面卡回「儲存中」
		// 卻已無任何 save 在跑。落地為 'dirty'，其餘欄位（marks/notes/dirtyCount/savedAt）
		// 照舊還原。
		applyDraft(state !== 'saving' && prev.state === 'saving' ? { ...prev, state: 'dirty' } : prev);
		prev = null;
		publish();
	}

	// 以 session id 查找（0014 限制撤銷）：課名非 identity——同日兩場同課名時 name 查找
	// 只命中排序在前的第一場，第二場永遠選不到；內部狀態(curClassId/byClass)本就以 id
	// 為鍵，查找入口對齊之。
	function selectClass(id: string): 'switched' | 'blocked' | 'noop' {
		const next = classes.find((c) => c.id === id);
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
			applyDraft(applySaveResult(currentDraft(), updatedRoster, now()));
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

/** 場次顯示標籤(桌面 dropdown 選項、行動 FilterChips、兩者「已儲存」toast 共用)：起始
 *  時間 + 課名，如「16:00 兒童體操初階班」——同日兩場同課名時間不同即可區分。起始時間
 *  直接取 mapAttendanceClass 帶出的 start 欄位(R12 起，不再反解顯示用的 time 字串「今日
 *  HH:MM–HH:MM」)，輸出與舊版 mobile-admin 頁 labelOf() 逐字相同(R3 銷帳 ADR 0014
 *  :224-226)。 */
export function sessionChipLabel(c: AttClassFull): string {
	return `${c.start} ${c.name}`;
}
