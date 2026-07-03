import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import CsettingsPage from './+page.svelte';
import { getCsettings } from '$lib/mobile-admin/api';
import type { Profile, Coach } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getCsettings: vi.fn() }));

const FIXTURE_PROFILES: Record<'admin' | 'coach', Profile> = {
	admin: { name: '測試管理員', initial: '測', role: '測試角色', desc: '', color: '#000', id: 'T-1' },
	coach: { name: '林雅婷', initial: '林', role: '測試教練職稱', desc: '', color: '#000', id: 'T-2' }
};
// 與 seed(COACHES 裡的林雅婷:年資/學員/班級/獲獎皆不同)相異的 fixture,證明
// cInfo 讀 payload 而非殘留的 COACHES 直接 import。
const FIXTURE_COACHES: Coach[] = [
	{
		id: 'zz1', name: '林雅婷', initial: '林', color: '#000', title: '測試特級教練',
		years: 42, students: 999, classes: 111, awards: 77, phone: '0900-000-000',
		tags: ['測試專長'], status: 'online'
	} as unknown as Coach
];

beforeEach(() => {
	vi.mocked(getCsettings).mockReset();
	vi.mocked(getCsettings).mockResolvedValue({ profiles: FIXTURE_PROFILES, coaches: FIXTURE_COACHES });
});

describe('mobile-admin/coach/csettings 頁', () => {
	it('loading 分支顯示骨架(data-testid="csettings-skeleton")', () => {
		vi.mocked(getCsettings).mockReturnValue(new Promise(() => {}));
		const { container } = render(CsettingsPage);
		expect(container.querySelector('[data-testid="csettings-skeleton"]')).not.toBeNull();
	});

	it('async 載入後顯示 payload 的教練資料(相異 fixture)', async () => {
		const { findByText, getAllByText } = render(CsettingsPage);
		expect(await findByText('測試特級教練')).toBeInTheDocument();
		expect((await getAllByText('42 年').length) > 0).toBe(true);
		expect(getAllByText('999 位').length).toBeGreaterThan(0);
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getCsettings).mockRejectedValue(new Error('boom'));
		const { findByText } = render(CsettingsPage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('coaches 空集合(找不到本人資料)不當機,顯示 EmptyState 而非拋錯', async () => {
		vi.mocked(getCsettings).mockResolvedValue({ profiles: FIXTURE_PROFILES, coaches: [] });
		const { findByText } = render(CsettingsPage);
		expect(await findByText('找不到教練資料')).toBeInTheDocument();
	});
});
