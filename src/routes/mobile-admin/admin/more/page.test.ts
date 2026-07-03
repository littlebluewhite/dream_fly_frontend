import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MorePage from './+page.svelte';
import { getMore } from '$lib/mobile-admin/api';
import type { Profile, Coach, Venue, Ticket } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getMore: vi.fn() }));

// 與 seed 相異的 fixture(人名/場地/票種皆改過),證明頁面讀 getMore() payload
// 而非殘留的 data.ts 直接 import。
const FIXTURE_PROFILES: Record<'admin' | 'coach', Profile> = {
	admin: { name: '測試管理員', initial: '測', role: '測試角色', desc: '', color: '#000', id: 'T-1' },
	coach: { name: '測試教練', initial: '測', role: '測試教練角色', desc: '', color: '#000', id: 'T-2' }
};
const FIXTURE_COACHES: Coach[] = [
	{ id: 'tc1', name: '測試教練甲', initial: '甲', color: '#000', title: '測試職稱', years: 1, students: 1, classes: 1, awards: 0, phone: '000', tags: [], status: 'online' } as unknown as Coach
];
const FIXTURE_VENUES: Venue[] = [
	{ id: 'tv1', name: '測試場地甲', type: '測試類型', area: '1', cap: 1, equip: [], status: 'available', today: 0 } as unknown as Venue
];
const FIXTURE_TICKETS: Ticket[] = [
	{ id: 'tt1', name: '測試票券甲' } as unknown as Ticket
];
const FIXTURE = { profiles: FIXTURE_PROFILES, coaches: FIXTURE_COACHES, venues: FIXTURE_VENUES, tickets: FIXTURE_TICKETS };

beforeEach(() => {
	vi.mocked(getMore).mockReset();
	vi.mocked(getMore).mockResolvedValue(FIXTURE);
});

describe('mobile-admin/admin/more 頁', () => {
	it('loading 分支顯示骨架(data-testid="more-skeleton")', () => {
		vi.mocked(getMore).mockReturnValue(new Promise(() => {}));
		const { container } = render(MorePage);
		expect(container.querySelector('[data-testid="more-skeleton"]')).not.toBeNull();
	});

	it('async 載入後顯示 payload 的管理員姓名與各群組筆數(相異 fixture)', async () => {
		const { findByText, findAllByText } = render(MorePage);
		expect((await findAllByText('測試管理員')).length).toBeGreaterThan(0);
		expect(await findByText('1 位專任教練')).toBeInTheDocument();
		expect(await findByText('1 個場地 · 器材')).toBeInTheDocument();
		expect(await findByText('1 種方案 · 銷售')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getMore).mockRejectedValue(new Error('boom'));
		const { findByText } = render(MorePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('空集合(教練/場地/票券皆 0 筆)不當機,顯示 0 筆敘述', async () => {
		vi.mocked(getMore).mockResolvedValue({ profiles: FIXTURE_PROFILES, coaches: [], venues: [], tickets: [] });
		const { findByText } = render(MorePage);
		expect(await findByText('0 位專任教練')).toBeInTheDocument();
		expect(await findByText('0 個場地 · 器材')).toBeInTheDocument();
		expect(await findByText('0 種方案 · 銷售')).toBeInTheDocument();
	});
});
