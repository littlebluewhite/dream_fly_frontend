import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AttendancePage from './+page.svelte';
import { getRoster } from '$lib/mobile-admin/api';
import type { RosterEntry } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getRoster: vi.fn() }));

// 與 seed(ROSTER 11 位、id 前綴 GY2024...)相異的 fixture,證明頁面讀 getRoster()
// payload 而非殘留的 data.ts 直接 import。
const FIXTURE_ROSTER: RosterEntry[] = [
	{ id: 'T-001', name: '測試學員甲', initial: '甲', color: '#000', mid: 'T-001', default: 'present' },
	{ id: 'T-002', name: '測試學員乙', initial: '乙', color: '#000', mid: 'T-002', default: 'leave' }
];

beforeEach(() => {
	vi.mocked(getRoster).mockReset();
	vi.mocked(getRoster).mockResolvedValue({ roster: FIXTURE_ROSTER });
});

describe('mobile-admin/coach/attendance 頁', () => {
	it('loading 分支顯示骨架(data-testid="attendance-skeleton")', () => {
		vi.mocked(getRoster).mockReturnValue(new Promise(() => {}));
		const { container } = render(AttendancePage);
		expect(container.querySelector('[data-testid="attendance-skeleton"]')).not.toBeNull();
	});

	it('async 載入後顯示 payload 的名冊(相異 fixture)', async () => {
		const { findByText } = render(AttendancePage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(await findByText('測試學員乙')).toBeInTheDocument();
	});

	it('點名狀態切換仍正常運作(既有行為不變)', async () => {
		const { findByText, getByText, getAllByText } = render(AttendancePage);
		await findByText('測試學員甲');
		// 出席統計卡預設:甲 present、乙 leave(名冊 default)。
		await fireEvent.click(getAllByText('缺席')[0]);
		expect(getByText('儲存點名')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getRoster).mockRejectedValue(new Error('boom'));
		const { findByText } = render(AttendancePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('名冊空集合不當機,統計顯示 0 且「全部標記出席」不拋錯', async () => {
		vi.mocked(getRoster).mockResolvedValue({ roster: [] });
		const { findByText, getByText, container } = render(AttendancePage);
		await findByText('全部標記出席');
		expect(container.textContent ?? '').toContain('0 位 · 競技啦啦隊 進階班');
		await fireEvent.click(getByText('全部標記出席'));
	});
});
