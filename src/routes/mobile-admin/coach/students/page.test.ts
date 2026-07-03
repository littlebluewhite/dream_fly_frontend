import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StudentsPage from './+page.svelte';
import { getStudents } from '$lib/mobile-admin/api';
import type { MemberRow } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getStudents: vi.fn() }));

// 與 seed 相異的 fixture:2 位林雅婷帶的學員 + 1 位別的教練帶的(驗證 mine 篩選
// 仍套用「coach === 林雅婷」),id 皆不落在 seed 的 SKILLS 表裡(驗證 fallback)。
const mkMember = (over: Partial<MemberRow>): MemberRow => ({
	id: 'X', name: 'X', initial: 'X', color: '#000', course: '測試課程', coach: '林雅婷',
	att: 90, status: 'active', age: 10, parent: '', phone: '', joined: '', points: 0,
	pay: 'paid', remain: 1, lastSeen: '', recent: [], emName: '', emPhone: '', campus: '',
	source: '', birthday: '', tier: '', tierColor: '', renewDue: '', lineId: '', ...over
});
const FIXTURE_MEMBERS: MemberRow[] = [
	mkMember({ id: 'ZZ-001', name: '測試學員甲', coach: '林雅婷', att: 92 }),
	mkMember({ id: 'ZZ-002', name: '測試學員乙', coach: '林雅婷', att: 88 }),
	mkMember({ id: 'ZZ-003', name: '測試學員丙(非本教練)', coach: '王思齊', att: 70 })
];
const FIXTURE_SKILLS: Record<string, [string, number][]> = { 'ZZ-001': [['測試動作', 99]] };

beforeEach(() => {
	vi.mocked(getStudents).mockReset();
	vi.mocked(getStudents).mockResolvedValue({ members: FIXTURE_MEMBERS, skills: FIXTURE_SKILLS });
});

describe('mobile-admin/coach/students 頁', () => {
	it('loading 分支顯示骨架(data-testid="students-skeleton")', () => {
		vi.mocked(getStudents).mockReturnValue(new Promise(() => {}));
		const { container } = render(StudentsPage);
		expect(container.querySelector('[data-testid="students-skeleton"]')).not.toBeNull();
	});

	it('只顯示林雅婷帶的學員(payload 相異 fixture),且顯示筆數', async () => {
		const { findByText, queryByText } = render(StudentsPage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(await findByText('測試學員乙')).toBeInTheDocument();
		expect(await findByText('2 位 · 競技啦啦隊 / 競技體操')).toBeInTheDocument();
		expect(queryByText('測試學員丙(非本教練)')).toBeNull();
	});

	it('技能熟練度優先讀 skills 表,找不到時 fallback 到出席率推算', async () => {
		const { findByText } = render(StudentsPage);
		await findByText('測試學員甲');
		expect(await findByText('測試動作熟練度')).toBeInTheDocument();
		// ZZ-002 不在 FIXTURE_SKILLS,fallback 為 [['基本動作', att], ['體能', att-8]]。
		expect(await findByText('基本動作熟練度')).toBeInTheDocument();
	});

	it('搜尋篩選仍正常運作', async () => {
		const { findByText, getByPlaceholderText, queryByText } = render(StudentsPage);
		await findByText('測試學員甲');
		await fireEvent.input(getByPlaceholderText('搜尋學員姓名、編號…'), { target: { value: '甲' } });
		expect(queryByText('測試學員乙')).toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getStudents).mockRejectedValue(new Error('boom'));
		const { findByText } = render(StudentsPage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('members 空集合不當機,顯示既有的找不到符合的學員空狀態', async () => {
		vi.mocked(getStudents).mockResolvedValue({ members: [], skills: {} });
		const { findByText } = render(StudentsPage);
		expect(await findByText('找不到符合的學員')).toBeInTheDocument();
	});
});
