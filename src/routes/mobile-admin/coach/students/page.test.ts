import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import StudentsPage from './+page.svelte';
import { getStudents } from '$lib/mobile-admin/api';
import { overlay } from '$lib/mobile-admin/stores';
import type { Student } from '$lib/coach/data';

vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return { ...actual, getStudents: vi.fn() };
});

// Task 20：getStudents() 現直接復用 coach/api.ts 的 GET /coaches/me/students，後端
// 本身只回「這位教練名下的學員」——不再需要頁面自己用姓名字串比對 coach 欄位篩選
// (舊 mock 需要，因為它讀的是全體 MEMBERS)。fixture 刻意不含任何「非本教練」的
// 學員，證明頁面不再做這層篩選也是正確的(信任後端範疇)。
const FIXTURE_STUDENTS: Student[] = [
	{ user_id: 'u1', name: '測試學員甲', initial: '測', color: '#000', cls: '兒童體操初階 B 班', courses: [{ course_id: 'c1', course_name: '兒童體操初階 B 班', enrolment_id: 'en-1' }], level: '初階', skill: '測試動作', pct: 92, att: 88 },
	{ user_id: 'u2', name: '測試學員乙', initial: '測', color: '#000', cls: '兒童體操中階 A 班', courses: [{ course_id: 'c2', course_name: '兒童體操中階 A 班', enrolment_id: 'en-2' }], level: '中階', skill: '後手翻', pct: 70, att: 60 }
];

beforeEach(() => {
	vi.mocked(getStudents).mockReset();
	vi.mocked(getStudents).mockResolvedValue({ students: FIXTURE_STUDENTS });
	overlay.closeAll();
});

describe('mobile-admin/coach/students 頁', () => {
	it('loading 分支顯示骨架(data-testid="students-skeleton")', () => {
		vi.mocked(getStudents).mockReturnValue(new Promise(() => {}));
		const { container } = render(StudentsPage);
		expect(container.querySelector('[data-testid="students-skeleton"]')).not.toBeNull();
	});

	it('顯示真實 getStudents() 名單(後端已限定「我的學員」,頁面不再自行篩選)並顯示筆數', async () => {
		const { findByText } = render(StudentsPage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(await findByText('測試學員乙')).toBeInTheDocument();
		expect(await findByText('2 位學員')).toBeInTheDocument();
	});

	it('技能熟練度直接讀 Student.skill/pct(真後端唯一欄位)，不再有獨立 SKILLS 對照表', async () => {
		const { findByText } = render(StudentsPage);
		await findByText('測試學員甲');
		expect(await findByText('測試動作熟練度')).toBeInTheDocument();
		expect(await findByText('92%')).toBeInTheDocument();
	});

	it('搜尋篩選仍正常運作', async () => {
		const { findByText, getByPlaceholderText, queryByText } = render(StudentsPage);
		await findByText('測試學員甲');
		await fireEvent.input(getByPlaceholderText('搜尋學員姓名、班級…'), { target: { value: '甲' } });
		expect(queryByText('測試學員乙')).toBeNull();
	});

	/* Task 20 — 原「更新評量」(本地假調整分數)/「聯絡家長」(Student 無 phone 欄位)
	 * 兩個假動作已移除，改為桌面 StudentCard 真正提供的「寫評語」「發證書」。 */
	it('不再顯示已移除的假動作(更新評量/聯絡家長)', async () => {
		const { findByText, queryByText } = render(StudentsPage);
		await findByText('測試學員甲');
		expect(queryByText('更新評量')).toBeNull();
		expect(queryByText('聯絡家長')).toBeNull();
	});

	it('「寫評語」開出 studentAction sheet(mode=reportCard，對應該學員)', async () => {
		const { findAllByText } = render(StudentsPage);
		await findAllByText('寫評語');

		await fireEvent.click((await findAllByText('寫評語'))[0]);
		const sheetProps = get(overlay).sheet?.props as { student: Student; mode: string };
		expect(sheetProps).toEqual({ student: FIXTURE_STUDENTS[0], mode: 'reportCard' });
	});

	it('「發證書」開出 studentAction sheet(mode=certificate，對應該學員)', async () => {
		const { findAllByText } = render(StudentsPage);
		await findAllByText('發證書');

		await fireEvent.click((await findAllByText('發證書'))[1]);
		const sheetProps = get(overlay).sheet?.props as { student: Student; mode: string };
		expect(sheetProps).toEqual({ student: FIXTURE_STUDENTS[1], mode: 'certificate' });
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getStudents).mockRejectedValue(new Error('boom'));
		const { findByText } = render(StudentsPage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('students 空集合不當機,顯示既有的找不到符合的學員空狀態', async () => {
		vi.mocked(getStudents).mockResolvedValue({ students: [] });
		const { findByText } = render(StudentsPage);
		expect(await findByText('找不到符合的學員')).toBeInTheDocument();
	});
});
