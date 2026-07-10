import { describe, it, expect } from 'vitest';
import {
	initDraft,
	setMark,
	applyNote,
	markAllPresent,
	undo,
	canSwitchClass,
	stashAndRestore,
	hadLate,
	beginSave,
	applySaveResult,
	saveFailed,
	type SaveBar
} from './attendance-draft';
import type { AttRow, AttClassFull } from './data';

/* attendance-draft.ts — coach/attendance 出席草稿狀態機的純函式表格測試（Round 2
 * C5，自 +page.svelte 抽出）。每個轉移函式對應原頁面內嵌邏輯的逐字行為，含競態分支
 * （mid-save 切班擋、undo 邊界、markAll 的 changed 計數規則）。全部無需渲染。
 *
 * ROSTER 組成同 coach/attendance/page.test.ts 的 ATT_TODAY_CLASSES[0] 慣例：
 * 1 present + 1 late + 1 leave + 1 absent，供 markAllPresent／changed 計數規則
 * 交叉驗證。 */
const ROSTER: AttRow[] = [
	{ n: '01', name: '王承恩', initial: '王', color: '#0066CC', mid: 'GY001', def: 'present' },
	{ n: '02', name: '林佳穎', initial: '林', color: '#EC4899', mid: 'GY014', def: 'late' },
	{ n: '03', name: '張雅婷', initial: '張', color: '#8B5CF6', mid: 'GY030', def: 'leave' },
	{ n: '04', name: '吳柏宇', initial: '吳', color: '#EF4444', mid: 'GY063', def: 'absent' }
];

const CLASS_A: AttClassFull = { id: 'ac1', name: '兒童體操初階班', time: '', room: '', coach: '', roster: ROSTER };
const CLASS_B: AttClassFull = {
	id: 'ac2',
	name: '青少年體操中級班',
	time: '',
	room: '',
	coach: '',
	roster: [{ n: '01', name: '周彥廷', initial: '周', color: '#0066CC', mid: 'GY012', def: 'present' }]
};

describe('initDraft', () => {
	it('marks mirrors each roster row def; dirtyCount counts non-present rows', () => {
		const draft = initDraft(ROSTER);
		expect(draft.marks).toEqual({ GY001: 'present', GY014: 'late', GY030: 'leave', GY063: 'absent' });
		expect(draft.dirtyCount).toBe(3); // late/leave/absent；present 不算
		expect(draft.notes).toEqual({});
		expect(draft.state).toBe('dirty');
		expect(draft.savedAt).toBeNull();
	});

	it('empty roster yields an empty, zero-dirty draft', () => {
		const draft = initDraft([]);
		expect(draft.marks).toEqual({});
		expect(draft.dirtyCount).toBe(0);
	});
});

describe('setMark', () => {
	const base = initDraft(ROSTER);

	it('updates only the targeted mid, bumps dirtyCount by 1, forces state dirty', () => {
		const saved: SaveBar = { ...base, state: 'saved' };
		const next = setMark(saved, 'GY001', 'late');
		expect(next.marks).toEqual({ ...base.marks, GY001: 'late' });
		expect(next.state).toBe('dirty');
		expect(next.dirtyCount).toBe(base.dirtyCount + 1);
	});

	it('setting a mid to the value it already has still increments dirtyCount (no dedupe — verbatim original behaviour)', () => {
		const next = setMark(base, 'GY001', 'present'); // GY001 already 'present'
		expect(next.marks.GY001).toBe('present');
		expect(next.dirtyCount).toBe(base.dirtyCount + 1);
	});

	it('does not mutate the input draft (new marks object)', () => {
		const next = setMark(base, 'GY001', 'absent');
		expect(base.marks.GY001).toBe('present'); // 原 draft 不變
		expect(next).not.toBe(base);
	});
});

describe('applyNote', () => {
	it('sets the note for the mid, bumps dirtyCount by 1, forces state dirty', () => {
		const base: SaveBar = { ...initDraft(ROSTER), state: 'saved' };
		const next = applyNote(base, 'GY014', '本週表現進步');
		expect(next.notes).toEqual({ GY014: '本週表現進步' });
		expect(next.state).toBe('dirty');
		expect(next.dirtyCount).toBe(base.dirtyCount + 1);
	});

	it('an empty-string note still counts as a change (no special-case)', () => {
		const base = initDraft(ROSTER);
		const next = applyNote(base, 'GY001', '');
		expect(next.notes).toEqual({ GY001: '' });
		expect(next.dirtyCount).toBe(base.dirtyCount + 1);
	});

	it('preserves marks unchanged', () => {
		const base = initDraft(ROSTER);
		const next = applyNote(base, 'GY001', 'x');
		expect(next.marks).toBe(base.marks); // 沒有理由重建 marks 物件
	});
});

describe('markAllPresent — changed 計數規則：leave 不動、非 present 才計', () => {
	it('forces every non-leave row to present and leaves leave rows untouched', () => {
		const base = initDraft(ROSTER);
		const next = markAllPresent(base, ROSTER);
		expect(next.marks).toEqual({ GY001: 'present', GY014: 'present', GY030: 'leave', GY063: 'present' });
	});

	it('counts late/absent rows as changed but not the leave row (leave 不動不計)', () => {
		const base = initDraft(ROSTER); // GY001 present, GY014 late, GY030 leave, GY063 absent
		const next = markAllPresent(base, ROSTER);
		// changed = GY014(late→present) + GY063(absent→present) = 2；GY030 是 leave 不計。
		expect(next.dirtyCount).toBe(base.dirtyCount + 2);
	});

	it('a row already marked present in the CURRENT draft (regardless of roster def) does not count as changed', () => {
		// GY014 的 roster def 是 late，但目前草稿已手動標成 present。
		const base: SaveBar = { ...initDraft(ROSTER), marks: { ...initDraft(ROSTER).marks, GY014: 'present' } };
		const next = markAllPresent(base, ROSTER);
		// changed 只剩 GY063(absent→present) = 1；GY014 雖 def 是 late 但目前已是 present 不重複計。
		expect(next.dirtyCount).toBe(base.dirtyCount + 1);
	});

	it('a leave row is not counted even if its current draft mark was manually changed away from leave', () => {
		const base: SaveBar = { ...initDraft(ROSTER), marks: { ...initDraft(ROSTER).marks, GY030: 'absent' } };
		const next = markAllPresent(base, ROSTER);
		// r.def==='leave' 短路排除，不看 draft.marks[GY030] 現況——固定不計入 changed。
		expect(next.dirtyCount).toBe(base.dirtyCount + 2); // 仍是 GY014 + GY063
		expect(next.marks.GY030).toBe('leave'); // 但 marks 輸出仍強制翻回 leave
	});

	it('forces state to dirty', () => {
		const base: SaveBar = { ...initDraft(ROSTER), state: 'saved' };
		expect(markAllPresent(base, ROSTER).state).toBe('dirty');
	});
});

describe('undo — 邊界', () => {
	it('prev===null passes through as null (no snapshot to restore)', () => {
		expect(undo(null)).toBeNull();
	});

	it('a non-null snapshot passes through unchanged (identity, not a clone)', () => {
		const snapshot = initDraft(ROSTER);
		expect(undo(snapshot)).toBe(snapshot);
	});
});

describe('canSwitchClass — mid-save guard', () => {
	it('blocks while state is saving', () => {
		expect(canSwitchClass({ ...initDraft(ROSTER), state: 'saving' })).toBe(false);
	});

	it('allows when dirty', () => {
		expect(canSwitchClass({ ...initDraft(ROSTER), state: 'dirty' })).toBe(true);
	});

	it('allows when saved', () => {
		expect(canSwitchClass({ ...initDraft(ROSTER), state: 'saved' })).toBe(true);
	});
});

describe('stashAndRestore', () => {
	it('stashes the from-class draft under fromId and inits a fresh draft when the target has none', () => {
		const fromDraft: SaveBar = { ...initDraft(ROSTER), dirtyCount: 99 }; // 帶記號，確認真的被存進去
		const result = stashAndRestore({}, CLASS_A.id, fromDraft, CLASS_B);
		expect(result.byClass[CLASS_A.id]).toBe(fromDraft);
		expect(result.draft).toEqual(initDraft(CLASS_B.roster));
	});

	it('restores an existing stashed draft for the target class verbatim (round-trip a prior edit)', () => {
		const staleADraft = initDraft(ROSTER);
		const editedBDraft: SaveBar = { ...initDraft(CLASS_B.roster), dirtyCount: 4, state: 'saved' };
		const byClass: Record<string, SaveBar> = { [CLASS_B.id]: editedBDraft };
		const result = stashAndRestore(byClass, CLASS_A.id, staleADraft, CLASS_B);
		expect(result.draft).toBe(editedBDraft); // 原封不動地換回來
	});

	it('does not mutate the input byClass object', () => {
		const byClass: Record<string, SaveBar> = {};
		stashAndRestore(byClass, CLASS_A.id, initDraft(ROSTER), CLASS_B);
		expect(byClass).toEqual({}); // 傳入的物件本身不被動到，回傳的是新物件
	});

	it('preserves unrelated existing entries in byClass', () => {
		const otherDraft = initDraft(ROSTER);
		const byClass: Record<string, SaveBar> = { other: otherDraft };
		const result = stashAndRestore(byClass, CLASS_A.id, initDraft(ROSTER), CLASS_B);
		expect(result.byClass.other).toBe(otherDraft);
	});
});

describe('hadLate', () => {
	it('true when at least one mark is late', () => {
		expect(hadLate({ a: 'present', b: 'late' })).toBe(true);
	});

	it('false when no mark is late', () => {
		expect(hadLate({ a: 'present', b: 'absent', c: 'leave' })).toBe(false);
	});

	it('false for an empty marks map', () => {
		expect(hadLate({})).toBe(false);
	});
});

describe('beginSave', () => {
	it('flips state to saving and leaves everything else untouched', () => {
		const base = initDraft(ROSTER);
		const next = beginSave(base);
		expect(next.state).toBe('saving');
		expect(next.marks).toBe(base.marks);
		expect(next.notes).toBe(base.notes);
		expect(next.dirtyCount).toBe(base.dirtyCount);
		expect(next.savedAt).toBe(base.savedAt);
	});
});

describe('applySaveResult', () => {
	it('overwrites marks from the server roster (server truth wins over optimistic local marks)', () => {
		const base: SaveBar = { ...initDraft(ROSTER), state: 'saving' };
		// 伺服器回應：遲到已併入出席，其餘照舊。
		const serverRoster: AttRow[] = ROSTER.map((r) => (r.mid === 'GY014' ? { ...r, def: 'present' } : r));
		const next = applySaveResult(base, serverRoster, '14:32');
		expect(next.marks).toEqual({ GY001: 'present', GY014: 'present', GY030: 'leave', GY063: 'absent' });
	});

	it('sets state to saved, dirtyCount to 0, and savedAt to the passed-in timestamp', () => {
		const base: SaveBar = { ...initDraft(ROSTER), state: 'saving' };
		const next = applySaveResult(base, ROSTER, '09:05');
		expect(next.state).toBe('saved');
		expect(next.dirtyCount).toBe(0);
		expect(next.savedAt).toBe('09:05');
	});

	it('leaves notes untouched (independent of the attendance save)', () => {
		const base: SaveBar = { ...initDraft(ROSTER), notes: { GY001: '備註' }, state: 'saving' };
		const next = applySaveResult(base, ROSTER, '09:05');
		expect(next.notes).toEqual({ GY001: '備註' });
	});
});

describe('saveFailed', () => {
	it('flips state back to dirty without touching marks/notes/dirtyCount/savedAt', () => {
		// 模擬 in-flight 期間又被編輯過：dirtyCount 已經比開始儲存時更高。
		const base: SaveBar = {
			marks: { GY001: 'late' },
			notes: { GY001: '備註' },
			state: 'saving',
			savedAt: '08:00',
			dirtyCount: 7
		};
		const next = saveFailed(base);
		expect(next.state).toBe('dirty');
		expect(next.marks).toBe(base.marks);
		expect(next.notes).toBe(base.notes);
		expect(next.dirtyCount).toBe(7); // 不被重置，也不被 in-flight 前的舊值覆蓋
		expect(next.savedAt).toBe('08:00');
	});
});
