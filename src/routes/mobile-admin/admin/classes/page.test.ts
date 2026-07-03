import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ClassesPage from './+page.svelte';
import { getOpsCollections } from '$lib/mobile-admin/api';
import { classes, members, coaches, orders, opsHydrated, saveClass } from '$lib/mobile-admin/stores';
import { CLASSES, MEMBERS, COACHES, ORDERS } from '$lib/mobile-admin/data';
import type { ClassRow } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getOpsCollections: vi.fn() }));

// 與 seed 相異的 fixture(班級名稱皆改過),證明頁面讀 hydrateOps() 水合後的
// $classes store,而非殘留的同步 seed 巧合通過。
const FIXTURE_CLASSES: ClassRow[] = [
	{
		id: 'zz1', name: '測試班級甲', level: '基礎', cat: '幼兒體操', coach: '測試教練', room: '測試教室',
		day: '一', time: '10:00', enrolled: 5, cap: 10, age: '3-5', price: 1000, status: '招生中',
		wait: 0, term: '2026 春季', sessions: 12, startDate: '2026/03/01', checkinRate: 90, makeup: 0
	}
];
const OPS_FIXTURE = { members: MEMBERS, classes: FIXTURE_CLASSES, coaches: COACHES, orders: ORDERS };

beforeEach(() => {
	vi.mocked(getOpsCollections).mockReset();
	vi.mocked(getOpsCollections).mockResolvedValue(OPS_FIXTURE);
	opsHydrated.set(false);
	members.set(MEMBERS);
	classes.set(CLASSES);
	coaches.set(COACHES);
	orders.set(ORDERS);
});

afterEach(() => {
	opsHydrated.set(false);
	members.set(MEMBERS);
	classes.set(CLASSES);
	coaches.set(COACHES);
	orders.set(ORDERS);
});

describe('mobile-admin/admin/classes 頁', () => {
	it('loading 分支顯示骨架(data-testid="classes-skeleton")', () => {
		vi.mocked(getOpsCollections).mockReturnValue(new Promise(() => {}));
		const { container } = render(ClassesPage);
		expect(container.querySelector('[data-testid="classes-skeleton"]')).not.toBeNull();
	});

	it('async 水合後顯示 $classes store 的班級(相異 fixture)', async () => {
		const { findByText } = render(ClassesPage);
		expect(await findByText('測試班級甲')).toBeInTheDocument();
		expect(await findByText('1 個開課班級 · 本季招生中')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState,且重試會真正重新 fetch(不受 hydrated 守衛短路)', async () => {
		vi.mocked(getOpsCollections).mockRejectedValueOnce(new Error('boom'));
		const { findByText } = render(ClassesPage);
		await findByText('載入失敗');

		vi.mocked(getOpsCollections).mockResolvedValueOnce(OPS_FIXTURE);
		await fireEvent.click(await findByText('重新載入'));
		expect(await findByText('測試班級甲')).toBeInTheDocument();
	});

	it('classes 空集合不當機,顯示找不到符合的課程', async () => {
		vi.mocked(getOpsCollections).mockResolvedValue({ members: MEMBERS, classes: [], coaches: COACHES, orders: ORDERS });
		const { findByText } = render(ClassesPage);
		expect(await findByText('找不到符合的課程')).toBeInTheDocument();
	});

	it('水合後的 overlay 新增(saveClass)在「第二次進頁」不被清掉(guard 保護)', async () => {
		const { findByText, unmount } = render(ClassesPage);
		await findByText('測試班級甲');
		expect(get(opsHydrated)).toBe(true);

		saveClass({ ...FIXTURE_CLASSES[0], id: '', name: '使用者剛新增的班級' }, true);
		unmount();

		// 模擬重新進頁:onMount 再次呼叫 hydrateOps(),guard 已 true 應短路。
		const { findByText: findByText2 } = render(ClassesPage);
		expect(await findByText2('使用者剛新增的班級')).toBeInTheDocument();
	});
});
