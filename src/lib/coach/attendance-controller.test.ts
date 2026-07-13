import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createAttendanceController, type AttendanceController } from './attendance-controller';
import type { AttRow, AttDefault, AttClassFull } from './data';

/* attendance-controller.ts — coach/attendance 出席點名編排層的單元測試（Round 3 K1）。
 * draft reducer（attendance-draft.ts，30 it 已測純轉移）之上的「編排 + 效應注入」層：
 * 鏡射變數收斂為單一快照 store、snapshot/undo 副作用、byClass 切班暫存、save 生命週期。
 * deps（saveAttendance / now）全部注入 mock，可控 promise resolve 時序以驗快照語意。
 *
 * c1 忠實複刻 +page.svelte 現行編排（含 state-based stale guard 與 catch 分支無 guard 的
 * 已知 latent ABA 缺陷），不得混入 c3 的 save-token guard。 */

const ROSTER_A: AttRow[] = [
	{ n: '01', name: '王承恩', initial: '王', color: '#0066CC', mid: 'GY001', def: 'present' },
	{ n: '02', name: '林佳穎', initial: '林', color: '#EC4899', mid: 'GY014', def: 'late' },
	{ n: '03', name: '張雅婷', initial: '張', color: '#8B5CF6', mid: 'GY030', def: 'leave' },
	{ n: '04', name: '吳柏宇', initial: '吳', color: '#EF4444', mid: 'GY063', def: 'absent' }
];
const ROSTER_B: AttRow[] = [
	{ n: '01', name: '周彥廷', initial: '周', color: '#0066CC', mid: 'GY012', def: 'present' }
];
const CLASS_A: AttClassFull = { id: 'ac1', name: '兒童體操初階班', time: '', room: '', coach: '', roster: ROSTER_A };
const CLASS_B: AttClassFull = { id: 'ac2', name: '青少年體操中級班', time: '', room: '', coach: '', roster: ROSTER_B };

/** 伺服器回應：全員 present（'late' 於後端併入 present，回應永不含 late）。 */
const serverAllPresent = (roster: AttRow[]): AttRow[] => roster.map((r) => ({ ...r, def: 'present' as const }));

/** 手動控制 resolve/reject 時序的 promise，用於驗 await 前/後的快照語意。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function makeDeps() {
	return {
		saveAttendance: vi.fn<(sessionId: string, marks: Record<string, AttDefault>) => Promise<AttRow[]>>(),
		now: vi.fn<() => string>(() => '14:32')
	};
}

let deps: ReturnType<typeof makeDeps>;
let ctrl: AttendanceController;

beforeEach(() => {
	deps = makeDeps();
	ctrl = createAttendanceController(deps);
});

describe('createAttendanceController — 建構 / init', () => {
	it('建構零副作用：未呼叫 init 前為空白視圖，不觸發任何 dep（SSR 安全）', () => {
		const view = get(ctrl);
		expect(view.classes).toEqual([]);
		expect(view.curClassId).toBe('');
		expect(view.marks).toEqual({});
		expect(view.notes).toEqual({});
		expect(view.state).toBe('dirty');
		expect(view.savedAt).toBeNull();
		expect(view.dirtyCount).toBe(0);
		expect(view.canUndo).toBe(false);
		expect(deps.saveAttendance).not.toHaveBeenCalled();
		expect(deps.now).not.toHaveBeenCalled();
	});

	it('init 開在第一個班級：curClassId、marks 鏡射首班名冊、dirtyCount 為非 present 筆數', () => {
		ctrl.init([CLASS_A, CLASS_B]);
		const view = get(ctrl);
		expect(view.classes).toHaveLength(2);
		expect(view.curClassId).toBe('ac1');
		expect(view.marks).toEqual({ GY001: 'present', GY014: 'late', GY030: 'leave', GY063: 'absent' });
		expect(view.dirtyCount).toBe(3); // late/leave/absent；present 不算
		expect(view.state).toBe('dirty');
		expect(view.savedAt).toBeNull();
	});

	it('init 空班級清單：curClassId 空字串、marks 空、dirtyCount 0', () => {
		ctrl.init([]);
		const view = get(ctrl);
		expect(view.classes).toEqual([]);
		expect(view.curClassId).toBe('');
		expect(view.marks).toEqual({});
		expect(view.dirtyCount).toBe(0);
	});

	it('init 發佈到 store：訂閱者收到初始化後的視圖，canUndo false、notes 空', () => {
		const seen: string[] = [];
		const unsub = ctrl.subscribe((v) => seen.push(v.curClassId));
		ctrl.init([CLASS_A]);
		unsub();
		expect(seen[seen.length - 1]).toBe('ac1');
		const view = get(ctrl);
		expect(view.canUndo).toBe(false);
		expect(view.notes).toEqual({});
	});
});

describe('編輯快照 — setMark / applyNote / markAllPresent / undo', () => {
	it('setMark 更新指定 mid、dirtyCount +1、state dirty、canUndo 轉為 true', () => {
		ctrl.init([CLASS_A]);
		ctrl.setMark('GY001', 'late');
		const view = get(ctrl);
		expect(view.marks.GY001).toBe('late');
		expect(view.dirtyCount).toBe(4); // 3 → 4
		expect(view.state).toBe('dirty');
		expect(view.canUndo).toBe(true); // 修改前已捕捉快照
	});

	it('applyNote 設定備註、dirtyCount +1、marks 不動、canUndo true', () => {
		ctrl.init([CLASS_A]);
		ctrl.applyNote('GY014', '本週表現進步');
		const view = get(ctrl);
		expect(view.notes).toEqual({ GY014: '本週表現進步' });
		expect(view.dirtyCount).toBe(4);
		expect(view.marks).toEqual({ GY001: 'present', GY014: 'late', GY030: 'leave', GY063: 'absent' });
		expect(view.canUndo).toBe(true);
	});

	it('markAllPresent 非請假列翻 present、請假列不動、dirtyCount 加實際改變筆數', () => {
		ctrl.init([CLASS_A]);
		ctrl.markAllPresent();
		const view = get(ctrl);
		expect(view.marks).toEqual({ GY001: 'present', GY014: 'present', GY030: 'leave', GY063: 'present' });
		expect(view.dirtyCount).toBe(5); // 3 + 2（GY014 late→present、GY063 absent→present；GY030 leave 不動、GY001 已 present）
		expect(view.canUndo).toBe(true);
	});

	it('undo 還原前一步快照（marks + dirtyCount）並清空快照（canUndo false）', () => {
		ctrl.init([CLASS_A]);
		ctrl.setMark('GY001', 'late'); // dirty 4, canUndo true
		ctrl.undo();
		const view = get(ctrl);
		expect(view.marks.GY001).toBe('present');
		expect(view.dirtyCount).toBe(3);
		expect(view.canUndo).toBe(false);
	});

	it('undo 為單步快照：兩次編輯後只回退最後一步（dirtyCount 逐次累加、非回到初始）', () => {
		ctrl.init([CLASS_A]);
		ctrl.setMark('GY001', 'late'); // 3 → 4
		ctrl.setMark('GY063', 'present'); // 4 → 5
		expect(get(ctrl).dirtyCount).toBe(5);
		ctrl.undo(); // 只回退第二步
		const view = get(ctrl);
		expect(view.dirtyCount).toBe(4); // 回到第一次編輯後，不是初始 3
		expect(view.marks.GY063).toBe('absent'); // 第二步被還原
		expect(view.marks.GY001).toBe('late'); // 第一步保留
		expect(view.canUndo).toBe(false);
	});
});

describe('selectClass — switched / blocked / noop / byClass 往返', () => {
	it('switched：切到另一班回傳 switched，curClassId 與 marks 換到目標班', () => {
		ctrl.init([CLASS_A, CLASS_B]);
		expect(ctrl.selectClass(CLASS_B.name)).toBe('switched');
		const view = get(ctrl);
		expect(view.curClassId).toBe('ac2');
		expect(view.marks).toEqual({ GY012: 'present' }); // B 名冊全 present
		expect(view.dirtyCount).toBe(0);
		expect(view.canUndo).toBe(false);
	});

	it('blocked：儲存中切班回傳 blocked，curClassId / state 不變', () => {
		ctrl.init([CLASS_A, CLASS_B]);
		deps.saveAttendance.mockReturnValue(new Promise<AttRow[]>(() => {})); // 永不 resolve
		void ctrl.save(); // state → saving
		expect(get(ctrl).state).toBe('saving');
		expect(ctrl.selectClass(CLASS_B.name)).toBe('blocked');
		expect(get(ctrl).curClassId).toBe('ac1');
		expect(get(ctrl).state).toBe('saving');
	});

	it('noop：切到同一班或不存在的班名回傳 noop，狀態不變', () => {
		ctrl.init([CLASS_A, CLASS_B]);
		expect(ctrl.selectClass(CLASS_A.name)).toBe('noop'); // 同一班
		expect(ctrl.selectClass('不存在的班級')).toBe('noop'); // 查無此名
		expect(get(ctrl).curClassId).toBe('ac1');
	});

	it('byClass 往返：A 的未存編輯切走再切回仍在（dirtyCount 不被重置為預設）', () => {
		ctrl.init([CLASS_A, CLASS_B]);
		ctrl.setMark('GY001', 'late'); // A dirty 3 → 4
		expect(get(ctrl).dirtyCount).toBe(4);
		expect(ctrl.selectClass(CLASS_B.name)).toBe('switched');
		expect(ctrl.selectClass(CLASS_A.name)).toBe('switched');
		const view = get(ctrl);
		expect(view.curClassId).toBe('ac1');
		expect(view.dirtyCount).toBe(4); // A 草稿原封還原，不是回到初始 3
		expect(view.marks.GY001).toBe('late'); // 編輯保留
	});

	it('切班清空復原快照（切換後 canUndo 回到 false）', () => {
		ctrl.init([CLASS_A, CLASS_B]);
		ctrl.setMark('GY001', 'late');
		expect(get(ctrl).canUndo).toBe(true);
		ctrl.selectClass(CLASS_B.name);
		expect(get(ctrl).canUndo).toBe(false);
	});
});

describe('save — 生命週期與 state-based stale guard', () => {
	it('saved outcome 攜帶 className / rosterCount / hadLate 素材', async () => {
		ctrl.init([CLASS_A]);
		deps.saveAttendance.mockResolvedValue(serverAllPresent(ROSTER_A));
		const outcome = await ctrl.save();
		expect(outcome).toEqual({ kind: 'saved', className: '兒童體操初階班', rosterCount: 4, hadLate: true });
	});

	it('hadLate 於 await 前以本地 marks 快照（伺服器回應全 present 仍為 true——時序釘）', async () => {
		const d = deferred<AttRow[]>();
		deps.saveAttendance.mockReturnValue(d.promise);
		ctrl.init([CLASS_A]); // 本地含一筆 late（GY014）
		const p = ctrl.save();
		// 伺服器回應全員 present（不含 late）——若 hadLate 於 await 後由回應推導，會誤判為 false。
		d.resolve(serverAllPresent(ROSTER_A));
		const outcome = await p;
		expect(outcome).toEqual({ kind: 'saved', className: '兒童體操初階班', rosterCount: 4, hadLate: true });
	});

	it('stale guard：await 後 state 已非 saving（in-flight 期間又編輯過）即丟棄回應', async () => {
		const d = deferred<AttRow[]>();
		deps.saveAttendance.mockReturnValue(d.promise);
		ctrl.init([CLASS_A]);
		const p = ctrl.save(); // state saving
		ctrl.setMark('GY001', 'absent'); // 儲存中又編輯 → state 打回 dirty
		d.resolve(serverAllPresent(ROSTER_A));
		const outcome = await p;
		expect(outcome).toEqual({ kind: 'stale' });
		const view = get(ctrl);
		expect(view.marks.GY001).toBe('absent'); // 中途編輯未被回應覆蓋
		expect(view.state).toBe('dirty');
		expect(view.dirtyCount).toBe(4); // 未被歸零
		expect(deps.now).not.toHaveBeenCalled(); // 未走到 applySaveResult
	});

	it('failed outcome：saveAttendance reject → {kind:failed,error}，state 退回 dirty 可重試', async () => {
		ctrl.init([CLASS_A]);
		const err = new Error('network down');
		deps.saveAttendance.mockRejectedValue(err);
		const outcome = await ctrl.save();
		expect(outcome.kind).toBe('failed');
		if (outcome.kind === 'failed') expect(outcome.error).toBe(err);
		expect(get(ctrl).state).toBe('dirty');
	});

	it('classes 同步：成功以伺服器回應覆蓋該班 roster 與 marks（非樂觀本地值）', async () => {
		ctrl.init([CLASS_A]);
		const server = ROSTER_A.map((r) => (r.mid === 'GY014' ? { ...r, def: 'present' as const } : r));
		deps.saveAttendance.mockResolvedValue(server);
		await ctrl.save();
		const view = get(ctrl);
		const savedClass = view.classes.find((c) => c.id === 'ac1')!;
		expect(savedClass.roster.find((r) => r.mid === 'GY014')!.def).toBe('present');
		expect(view.marks.GY014).toBe('present'); // marks 也以伺服器回應同步
	});

	it('savedAt 用 deps.now() 的回傳值', async () => {
		ctrl.init([CLASS_A]);
		deps.now.mockReturnValue('09:05');
		deps.saveAttendance.mockResolvedValue(serverAllPresent(ROSTER_A));
		await ctrl.save();
		expect(deps.now).toHaveBeenCalled();
		expect(get(ctrl).savedAt).toBe('09:05');
	});

	it('publish 時序：save() 同步發佈 saving（不等 resolve）', () => {
		deps.saveAttendance.mockReturnValue(new Promise<AttRow[]>(() => {})); // 永不 resolve
		ctrl.init([CLASS_A]);
		void ctrl.save(); // 不 await
		expect(get(ctrl).state).toBe('saving');
	});

	it('dirtyCount 歸零：成功後 dirtyCount 0、state saved', async () => {
		ctrl.init([CLASS_A]);
		expect(get(ctrl).dirtyCount).toBe(3);
		deps.saveAttendance.mockResolvedValue(serverAllPresent(ROSTER_A));
		await ctrl.save();
		const view = get(ctrl);
		expect(view.dirtyCount).toBe(0);
		expect(view.state).toBe('saved');
	});
});

describe('save-token guard — ABA 併發（K1 c3；對 c1 版應紅，證明 latent 洞真的存在）', () => {
	// 現行 state guard 的 latent ABA 洞：儲存中先編輯把 state 打回 dirty，放行切班，再啟
	// 第二次 save 後，舊回應見 state==='saving' 穿透 guard、以 live curClassId 把舊班
	// roster 寫進新班（resolve 分支）；catch 分支更全無 guard，舊請求失敗會把新班打成
	// failed。遞增序號 token 在 resolve 與 catch 皆驗 token===current，不符即丟棄。

	it('ABA resolve 丟棄：A save→編輯→切班→B save→A resolve 不汙染 B 的 roster', async () => {
		const dA = deferred<AttRow[]>();
		const dB = deferred<AttRow[]>();
		deps.saveAttendance.mockReturnValueOnce(dA.promise).mockReturnValueOnce(dB.promise);
		ctrl.init([CLASS_A, CLASS_B]);

		const pA = ctrl.save(); // A（ac1）save 起飛，state saving
		ctrl.setMark('GY001', 'late'); // 儲存中先編輯 → state 打回 dirty，放行切班
		expect(ctrl.selectClass(CLASS_B.name)).toBe('switched'); // 切到 B（ac2）
		void ctrl.save(); // B（ac2）save 起飛，seq 遞增、state saving

		dA.resolve(serverAllPresent(ROSTER_A)); // A 的舊回應（4 筆）現在才回來
		const outcomeA = await pA;

		expect(outcomeA).toEqual({ kind: 'stale' }); // 舊回應被 token guard 丟棄
		const view = get(ctrl);
		expect(view.curClassId).toBe('ac2'); // 仍在 B
		expect(view.state).toBe('saving'); // B 仍 in-flight，未被 A 打成 saved
		expect(view.marks).toEqual({ GY012: 'present' }); // B 的 marks（1 筆），非 A 的 4 筆
		expect(view.classes.find((c) => c.id === 'ac2')!.roster).toHaveLength(1); // B roster 未被 A 覆蓋
	});

	it('stale reject 丟棄：A reject 不把 B 打成 failed、不發 failed outcome', async () => {
		const dA = deferred<AttRow[]>();
		const dB = deferred<AttRow[]>();
		deps.saveAttendance.mockReturnValueOnce(dA.promise).mockReturnValueOnce(dB.promise);
		ctrl.init([CLASS_A, CLASS_B]);

		const pA = ctrl.save(); // A save
		ctrl.setMark('GY001', 'late'); // 儲存中先編輯 → dirty，放行切班
		expect(ctrl.selectClass(CLASS_B.name)).toBe('switched');
		void ctrl.save(); // B save，state saving

		dA.reject(new Error('A 的舊請求失敗')); // A 的舊回應失敗
		const outcomeA = await pA;

		expect(outcomeA).toEqual({ kind: 'stale' }); // 丟棄，非 failed
		const view = get(ctrl);
		expect(view.state).toBe('saving'); // B 未被 A 的 catch 打成 dirty
		expect(view.curClassId).toBe('ac2');
	});
});
