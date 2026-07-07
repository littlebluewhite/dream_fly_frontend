import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AttendancePage from './+page.svelte';
import { getAttendance, saveAttendance } from '$lib/mobile-admin/api';
import { toasts } from '$lib/mobile-admin/stores';
import type { MAttendanceClass } from '$lib/mobile-admin/api';
import type { RosterEntry } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getAttendance: vi.fn(), saveAttendance: vi.fn() }));

const rosterOf = (over: Partial<RosterEntry>[]): RosterEntry[] =>
	over.map((o, i) => ({ id: 'T-00' + i, name: '測試學員' + i, initial: '測', color: '#000', mid: 'T-00' + i, default: 'present', ...o }));

// 兩堂課同一天，證明「切換班級」FilterChips 恢復多選功能(舊 mock 因限制只給一堂課)。
const FIXTURE_CLASSES: MAttendanceClass[] = [
	{ id: 's1', label: '19:00 測試班甲', roster: rosterOf([{ id: 'T-001', name: '測試學員甲', default: 'present' }, { id: 'T-002', name: '測試學員乙', default: 'leave' }]) },
	{ id: 's2', label: '20:00 測試班乙', roster: rosterOf([{ id: 'T-003', name: '測試學員丙', default: 'absent' }]) }
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

	it('點名狀態切換仍正常運作(既有行為不變)', async () => {
		const { findByText, getByText, getAllByText } = render(AttendancePage);
		await findByText('測試學員甲');
		await fireEvent.click(getAllByText('缺席')[0]);
		expect(getByText('儲存點名')).toBeInTheDocument();
	});

	it('儲存點名真打 PUT /sessions/{id}/attendance(saveAttendance)，並以伺服器回傳名冊同步', async () => {
		const savedRoster = rosterOf([{ id: 'T-001', name: '測試學員甲', default: 'absent' }, { id: 'T-002', name: '測試學員乙', default: 'leave' }]);
		vi.mocked(saveAttendance).mockResolvedValue(savedRoster);
		const { findByText, getByText, getAllByText } = render(AttendancePage);
		await findByText('測試學員甲');

		// getAllByText('缺席') 命中兩處:出勤統計卡的分類標籤(非按鈕)與名冊列(唯一
		// 非請假狀態、有按鈕)的實際狀態切換鈕——取索引 [1] 才是真正可點擊的那顆。
		await fireEvent.click(getAllByText('缺席')[1]);
		await fireEvent.click(getByText('儲存點名'));

		expect(await findByText('點名已儲存')).toBeInTheDocument();
		expect(saveAttendance).toHaveBeenCalledWith('s1', expect.objectContaining({ 'T-001': 'absent' }));
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
});
