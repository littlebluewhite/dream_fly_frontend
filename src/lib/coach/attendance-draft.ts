/* Dream Fly — coach/attendance 出席草稿狀態機（Round 2 C5，自 +page.svelte 的
 * SaveBar 轉移函式抽出）。純 TS，不 import svelte/svelte-store——每個轉移逐字對應
 * 原頁面內嵌邏輯，零行為變更，只是把「怎麼轉移」搬出 Svelte 元件，方便脫離渲染直接
 * 表格測試（含 mid-save 切班擋、markAll 計數規則、undo 邊界等競態分支的純函式形狀）。
 *
 * 時間戳（頁面的 nowHHMM()）與「回應同步 guard」（state==='saving' 才套用儲存結果）
 * 刻意不放進這裡——前者是壁鐘副作用，後者是頁面才知道「這次回應是否仍對應目前這次
 * 儲存」的職責，兩者都留在 +page.svelte 的 adapter 層。 */
import type { AttRow, AttDefault, AttClassFull } from '$lib/coach/data';

export type SaveBar = {
	marks: Record<string, AttDefault>;
	notes: Record<string, string>;
	state: 'dirty' | 'saving' | 'saved';
	savedAt: string | null;
	dirtyCount: number;
};

function buildMarks(rows: AttRow[]): Record<string, AttDefault> {
	return Object.fromEntries(rows.map((r) => [r.mid, r.def] as [string, AttDefault]));
}

/** 一個班級名冊剛載入（或切班切到尚未存過草稿的班級）時的初始 SaveBar——marks 取
 *  名冊預設值，dirtyCount 為非 present 筆數（原「已有幾筆待處理」的起始基準）。 */
export function initDraft(roster: AttRow[]): SaveBar {
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
export function setMark(draft: SaveBar, mid: string, v: AttDefault): SaveBar {
	return { ...draft, marks: { ...draft.marks, [mid]: v }, state: 'dirty', dirtyCount: draft.dirtyCount + 1 };
}

/** 備註儲存（備註 Dialog 的「儲存備註」）。codex r1 (P2)：備註編輯也算未存變更——
 *  重新標記 dirty，避免教練同步後才加註記，卻被告知「全部已上傳」。 */
export function applyNote(draft: SaveBar, mid: string, text: string): SaveBar {
	return { ...draft, notes: { ...draft.notes, [mid]: text }, state: 'dirty', dirtyCount: draft.dirtyCount + 1 };
}

/** 全部標記出席。codex r2 (P2)：dirtyCount 要加上這次批次動作「實際改變」的筆數，
 *  save bar / 狀態卡才不會在同步後誤報「0 筆變更」。changed 計數規則：請假（leave）
 *  列不算變更（維持請假，不會被覆寫）；其餘列只有「目前」尚未是 present 才算一筆
 *  變更（比對 draft.marks 現況，不是 r.def 原始預設值——已手動標記過 present 的不
 *  重複計）。 */
export function markAllPresent(draft: SaveBar, roster: AttRow[]): SaveBar {
	const changed = roster.filter((r) => r.def !== 'leave' && draft.marks[r.mid] !== 'present').length;
	const marks = Object.fromEntries(
		roster.map((r) => [r.mid, r.def === 'leave' ? 'leave' : 'present'] as [string, AttDefault])
	);
	return { ...draft, marks, state: 'dirty', dirtyCount: draft.dirtyCount + changed };
}

/** 復原：prev===null 代表沒有可復原的快照（原樣回傳 null）；否則原樣回傳快照本身
 *  供套用。是否套用、何時清空 prev 由呼叫端（頁面 adapter）決定——這裡只表達「復原
 *  這個轉移，輸入是什麼快照，輸出就是什麼」的邊界語意。 */
export function undo(prev: SaveBar | null): SaveBar | null {
	return prev;
}

/** mid-save 切班擋：儲存中不可切換班級——in-flight 的 doSave 回呼只認得目前這份
 *  live 狀態，若被 stash 走會卡在「儲存中」永遠結束不了（也可能讓成功 toast 落在
 *  錯的班級）。 */
export function canSwitchClass(draft: SaveBar): boolean {
	return draft.state !== 'saving';
}

/** 切換班級：把目前班級（fromId）的整份草稿存進 byClass，換上目標班級既有草稿
 *  （若無則 initDraft 全新一份）。不 mutate 傳入的 byClass，回傳新的 byClass 與應
 *  套用的新草稿。 */
export function stashAndRestore(
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
export function hadLate(marks: Record<string, AttDefault>): boolean {
	return Object.values(marks).some((m) => m === 'late');
}

/** 進入儲存中——只翻轉 state，其餘欄位不動。 */
export function beginSave(draft: SaveBar): SaveBar {
	return { ...draft, state: 'saving' };
}

/** 儲存成功：以伺服器回傳的最新名冊覆蓋 marks（而非樂觀本地值），dirtyCount 歸零。
 *  notes 不受影響（備註是獨立於出席儲存的本地暫存）。savedAt 由呼叫端算好傳入
 *  （壁鐘時間，不屬於純函式該碰的副作用）。 */
export function applySaveResult(draft: SaveBar, serverRoster: AttRow[], savedAt: string): SaveBar {
	return { ...draft, marks: buildMarks(serverRoster), state: 'saved', savedAt, dirtyCount: 0 };
}

/** 儲存失敗：退回 'dirty' 讓教練可重試；marks/notes/dirtyCount/savedAt 維持不動
 *  （若在 in-flight 期間又編輯過，不覆蓋那些新變更）。 */
export function saveFailed(draft: SaveBar): SaveBar {
	return { ...draft, state: 'dirty' };
}
