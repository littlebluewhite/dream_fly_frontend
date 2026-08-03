import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AttendancePage from './+page.svelte';
import { getAttendance, saveAttendance } from '$lib/mobile-admin/api';
import { toasts } from '$lib/mobile-admin/stores';
import type { AttClassFull, AttRow } from '$lib/mobile-admin/api';

vi.mock('$lib/mobile-admin/api', () => ({ getAttendance: vi.fn(), saveAttendance: vi.fn() }));

const rosterOf = (over: Partial<AttRow>[]): AttRow[] =>
	over.map((o, i) => ({ n: String(i + 1).padStart(2, '0'), name: '測試學員' + i, initial: '測', color: '#000', mid: 'T-00' + i, def: 'present', ...o }));

// 兩堂課同一天，證明「切換班級」FilterChips 恢復多選功能(舊 mock 因限制只給一堂課)。
// time 形如桌面 AttClassFull("今日 HH:MM–HH:MM")，labelOf() 取起始時間 + 課名組成
// FilterChips 顯示字串，同原本映射層算好的 label 斷言不變。
const FIXTURE_CLASSES: AttClassFull[] = [
	{ id: 's1', name: '測試班甲', time: '今日 19:00–20:30', room: '', coach: '', roster: rosterOf([{ mid: 'T-001', name: '測試學員甲', def: 'present' }, { mid: 'T-002', name: '測試學員乙', def: 'leave' }]) },
	{ id: 's2', name: '測試班乙', time: '今日 20:00–21:00', room: '', coach: '', roster: rosterOf([{ mid: 'T-003', name: '測試學員丙', def: 'absent' }]) }
];

beforeEach(() => {
	vi.mocked(getAttendance).mockReset();
	vi.mocked(getAttendance).mockResolvedValue({ classes: FIXTURE_CLASSES, failedClasses: [] });
	vi.mocked(saveAttendance).mockReset();
});

describe('mobile-admin/coach/attendance 頁', () => {
	it('loading 分支顯示骨架(data-testid="attendance-skeleton")', () => {
		vi.mocked(getAttendance).mockReturnValue(new Promise(() => {}));
		const { container } = render(AttendancePage);
		expect(container.querySelector('[data-testid="attendance-skeleton"]')).not.toBeNull();
	});

	it('async 載入後顯示第一堂課的名冊(相異 fixture，真 GET /sessions/today × roster)', async () => {
		const { findByText } = render(AttendancePage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(await findByText('測試學員乙')).toBeInTheDocument();
	});

	it('切換班級恢復多選功能(今日多堂課皆可點名，不再只鎖死單一硬編班級)', async () => {
		const { findByText, getByText, queryByText } = render(AttendancePage);
		await findByText('測試學員甲');
		expect(getByText('19:00 測試班甲')).toBeInTheDocument();
		expect(getByText('20:00 測試班乙')).toBeInTheDocument();

		await fireEvent.click(getByText('20:00 測試班乙'));
		expect(await findByText('測試學員丙')).toBeInTheDocument();
		expect(queryByText('測試學員甲')).toBeNull();
	});

	it('同日兩場同課名：第二場 chip 可選取並切到其名冊(selectClass 走 session id，0014 限制撤銷)', async () => {
		vi.mocked(getAttendance).mockResolvedValue({
			classes: [FIXTURE_CLASSES[0], { ...FIXTURE_CLASSES[1], name: '測試班甲' }],
			failedClasses: []
		});
		const { findByText, getByText, queryByText } = render(AttendancePage);
		await findByText('測試學員甲');
		// 兩顆 chip 同課名，靠 labelOf 的時間前綴區分顯示；選取靠 session id 分流。
		await fireEvent.click(getByText('20:00 測試班甲'));
		expect(await findByText('測試學員丙')).toBeInTheDocument(); // 第二場名冊
		expect(queryByText('測試學員甲')).toBeNull(); // 不是停在第一場
	});

	it('點名狀態切換仍正常運作(既有行為不變)', async () => {
		const { findByText, getByText, getAllByText } = render(AttendancePage);
		await findByText('測試學員甲');
		await fireEvent.click(getAllByText('缺席')[0]);
		expect(getByText('儲存點名')).toBeInTheDocument();
	});

	it('儲存點名真打 PUT /sessions/{id}/attendance(saveAttendance)，並以伺服器回傳名冊同步', async () => {
		const savedRoster = rosterOf([{ mid: 'T-001', name: '測試學員甲', def: 'absent' }, { mid: 'T-002', name: '測試學員乙', def: 'leave' }]);
		vi.mocked(saveAttendance).mockResolvedValue(savedRoster);
		const { findByText, getByText, getAllByText } = render(AttendancePage);
		await findByText('測試學員甲');

		// getAllByText('缺席') 命中兩處:出勤統計卡的分類標籤(非按鈕)與名冊列(唯一
		// 非請假狀態、有按鈕)的實際狀態切換鈕——取索引 [1] 才是真正可點擊的那顆。
		await fireEvent.click(getAllByText('缺席')[1]);
		await fireEvent.click(getByText('儲存點名'));

		expect(await findByText('點名已儲存')).toBeInTheDocument();
		expect(saveAttendance).toHaveBeenCalledWith('s1', expect.objectContaining({ 'T-001': 'absent' }));
		// 釘住完整成功 toast 文案（含時間前綴，同舊版格式）——防止日後把 label 換回
		// SaveOutcome.className（只有課名、沒有時間）而悄悄漂移。
		expect(get(toasts).some((t) => t.title === '點名已儲存' && t.body === '19:00 測試班甲 · 2 位學員出勤已記錄。')).toBe(true);
	});

	it('儲存失敗顯示錯誤提示，不假裝成功', async () => {
		vi.mocked(saveAttendance).mockRejectedValue(new Error('boom'));
		const { findByText, getByText } = render(AttendancePage);
		await findByText('測試學員甲');

		await fireEvent.click(getByText('儲存點名'));
		await vi.waitFor(() => expect(get(toasts).some((t) => t.title === '儲存失敗')).toBe(true));
		expect(getByText('儲存點名')).toBeInTheDocument(); // 未切換成「已儲存」字樣
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getAttendance).mockRejectedValue(new Error('boom'));
		const { findByText } = render(AttendancePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('今日無場次(classes 空集合)顯示空狀態，不當機', async () => {
		vi.mocked(getAttendance).mockResolvedValue({ classes: [], failedClasses: [] });
		const { findByText } = render(AttendancePage);
		expect(await findByText('今日尚無場次')).toBeInTheDocument();
	});

	it('部分場次名冊載入失敗時顯示提示 toast，其餘場次仍可點名', async () => {
		vi.mocked(getAttendance).mockResolvedValue({ classes: FIXTURE_CLASSES, failedClasses: ['測試班丙'] });
		const { findByText } = render(AttendancePage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(get(toasts).some((t) => t.title === '部分場次名冊載入失敗')).toBe(true);
	});

	it('切班保留未存草稿(甲班點缺席→切乙班→切回甲班，選取仍在且未觸發 save)', async () => {
		vi.mocked(saveAttendance).mockResolvedValue([]);
		const { getByText, getAllByText, findByText } = render(AttendancePage);
		await findByText('測試學員甲');

		// 甲班第一列(測試學員甲，預設 present)標記「缺席」——getAllByText('缺席') 命中
		// 兩處:統計卡標籤與名冊列按鈕，索引 [1] 才是可點擊的分段鈕(同既有測試慣例)。
		await fireEvent.click(getAllByText('缺席')[1]);

		// 切到乙班確認乙班名冊顯示，再切回甲班。
		await fireEvent.click(getByText('20:00 測試班乙'));
		await findByText('測試學員丙');
		await fireEvent.click(getByText('19:00 測試班甲'));
		await findByText('測試學員甲');

		// 切班本身未觸發 save；儲存後草稿(缺席)仍在，證明切班沒有丟棄未存變更。
		expect(saveAttendance).not.toHaveBeenCalled();
		await fireEvent.click(getByText('儲存點名'));
		expect(saveAttendance).toHaveBeenCalledWith('s1', expect.objectContaining({ 'T-001': 'absent' }));
	});

	it('儲存中切班被擋(save pending 時點乙班 chip → 仍顯示甲班名冊 + info toast)', async () => {
		vi.mocked(saveAttendance).mockReturnValue(new Promise(() => {})); // 模擬請求進行中，永不 resolve
		const { getByText, queryByText, findByText } = render(AttendancePage);
		await findByText('測試學員甲');

		await fireEvent.click(getByText('儲存點名'));
		expect(await findByText('儲存中…')).toBeInTheDocument();

		await fireEvent.click(getByText('20:00 測試班乙'));

		// 切班被擋:仍顯示甲班名冊，乙班名冊未出現;並跳 info toast 提示。
		expect(getByText('測試學員甲')).toBeInTheDocument();
		expect(queryByText('測試學員丙')).toBeNull();
		expect(get(toasts).some((t) => t.title === '儲存中')).toBe(true);
	});
});
