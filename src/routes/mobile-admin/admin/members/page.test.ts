import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MembersPage from './+page.svelte';
import { getOpsCollections } from '$lib/mobile-admin/api';
import { classes, members, coaches, orders, opsHydrated } from '$lib/mobile-admin/stores';
import { CLASSES, MEMBERS, COACHES, ORDERS } from '$lib/mobile-admin/data';
import type { MemberRow } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getOpsCollections: vi.fn() }));

const mkMember = (over: Partial<MemberRow>): MemberRow => ({
	id: 'X', name: 'X', initial: 'X', color: '#000', course: '測試課程', coach: '測試教練',
	att: 90, status: 'active', age: 10, parent: '', phone: '', joined: '', points: 0,
	pay: 'paid', remain: 1, lastSeen: '', recent: [], emName: '', emPhone: '', campus: '',
	source: '', birthday: '', tier: '', tierColor: '', renewDue: '', lineId: '', ...over
});
// 與 seed 相異的 fixture(人名、狀態組成皆改過),證明頁面讀 hydrateOps() 水合後
// 的 $members store。
const FIXTURE_MEMBERS: MemberRow[] = [
	mkMember({ id: 'zz1', name: '測試學員甲', status: 'active' }),
	mkMember({ id: 'zz2', name: '測試學員乙', status: 'warning' })
];
const OPS_FIXTURE = { members: FIXTURE_MEMBERS, classes: CLASSES, coaches: COACHES, orders: ORDERS };

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

describe('mobile-admin/admin/members 頁', () => {
	it('loading 分支顯示骨架(data-testid="members-skeleton")', () => {
		vi.mocked(getOpsCollections).mockReturnValue(new Promise(() => {}));
		const { container } = render(MembersPage);
		expect(container.querySelector('[data-testid="members-skeleton"]')).not.toBeNull();
	});

	it('async 水合後顯示 $members store 的學員(相異 fixture)與統計筆數', async () => {
		const { findByText } = render(MembersPage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(await findByText('測試學員乙')).toBeInTheDocument();
		expect(await findByText('2 位在學學員')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState,且重試會真正重新 fetch(不受 hydrated 守衛短路)', async () => {
		vi.mocked(getOpsCollections).mockRejectedValueOnce(new Error('boom'));
		const { findByText } = render(MembersPage);
		await findByText('載入失敗');

		vi.mocked(getOpsCollections).mockResolvedValueOnce(OPS_FIXTURE);
		await fireEvent.click(await findByText('重新載入'));
		expect(await findByText('測試學員甲')).toBeInTheDocument();
	});

	it('members 空集合不當機,顯示找不到符合的學員', async () => {
		vi.mocked(getOpsCollections).mockResolvedValue({ members: [], classes: CLASSES, coaches: COACHES, orders: ORDERS });
		const { findByText } = render(MembersPage);
		expect(await findByText('找不到符合的學員')).toBeInTheDocument();
	});
});
