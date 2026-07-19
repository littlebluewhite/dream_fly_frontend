import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import VenuesScreen from './VenuesScreen.svelte';
import { getVenues } from '$lib/mobile-admin/api';
import type { Venue } from '$lib/mobile-admin/data';

/* 場館管理 push screen — C4：接真 GET /venues(復用桌面 admin/api.ts 的 getVenues()，見
 * $lib/mobile-admin/api 薄委派 re-export)。fixture 刻意異於 domain/venues.ts seed(場地
 * 名/型態/器材皆改過)，證明畫面讀 getVenues() payload 而非殘留的 VENUES import；id 是
 * UUID 形、方塊改顯示 slug——斷言 UUID 不出現於版面、slug 出現(鏡射桌面 F4 裁決)。 */
vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return { ...actual, getVenues: vi.fn() };
});

const UUID_A = '3f9a1c02-7b4e-4d1a-9c88-000000000001';
const UUID_B = '3f9a1c02-7b4e-4d1a-9c88-000000000002';
const PAYLOAD: { venues: Venue[] } = {
	venues: [
		{ id: UUID_A, slug: 'zeta-hall', name: 'Zeta 訓練場', type: '測試競技場', equip: ['測試彈翻床', '測試單槓'], status: 'available' },
		{ id: UUID_B, slug: 'omega-room', name: 'Omega 教室', type: '測試律動室', equip: ['測試地墊'], status: 'maintenance' }
	]
};

beforeEach(() => {
	vi.mocked(getVenues).mockReset();
	vi.mocked(getVenues).mockResolvedValue(PAYLOAD);
});

describe('VenuesScreen — 載入(GET /venues)', () => {
	it('loading：顯示骨架', () => {
		vi.mocked(getVenues).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(VenuesScreen, { props: { onBack: () => {} } });
		expect(getByTestId('venues-skeleton')).toBeTruthy();
	});

	it('error：顯示「載入失敗」', async () => {
		vi.mocked(getVenues).mockRejectedValue(new Error('network'));
		const { findByText } = render(VenuesScreen, { props: { onBack: () => {} } });
		await findByText('載入失敗');
	});
});

describe('VenuesScreen — ready(接真 payload)', () => {
	it('每個場地的名稱/型態/器材皆讀 payload，方塊顯示 slug、UUID id 不出現於版面', async () => {
		const { container, findByText } = render(VenuesScreen, { props: { onBack: () => {} } });
		await findByText('Zeta 訓練場');
		const txt = container.textContent ?? '';
		expect(txt).toContain('Omega 教室');
		expect(txt).toContain('測試競技場');
		expect(txt).toContain('測試彈翻床');
		// 方塊改顯示 slug(桌面 routes/admin/venues F4 裁決鏡射)
		expect(txt).toContain('zeta-hall');
		expect(txt).toContain('omega-room');
		// UUID 形 id 絕不出現在版面(整個 rendered HTML；#each key 用 id 但不渲染進 DOM)
		expect(container.innerHTML).not.toContain(UUID_A);
		expect(container.innerHTML).not.toContain(UUID_B);
	});

	it('狀態 Badge 走 VENUE_STATUS 查表(可預約／維護中)', async () => {
		const { container, findByText } = render(VenuesScreen, { props: { onBack: () => {} } });
		await findByText('Zeta 訓練場');
		const txt = container.textContent ?? '';
		expect(txt).toContain('可預約'); // available → VENUE_STATUS
		expect(txt).toContain('維護中'); // maintenance → VENUE_STATUS
		expect(txt).toContain('今日暫停使用'); // maintenance 場地的使用狀態列
	});

	it('副標場地數讀 payload.length，非殘留 VENUES seed 的 6', async () => {
		const { container, findByText } = render(VenuesScreen, { props: { onBack: () => {} } });
		await findByText('Zeta 訓練場');
		expect(container.textContent ?? '').toContain('2 個場地');
	});
});
