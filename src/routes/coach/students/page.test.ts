import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StudentsPage from './+page.svelte';
import { STUDENTS } from '$lib/coach/data';
import { getStudents } from '$lib/coach/api';

vi.mock('$lib/coach/api', () => ({ getStudents: vi.fn() }));

beforeEach(() => {
	vi.mocked(getStudents).mockReset();
	vi.mocked(getStudents).mockResolvedValue({ students: STUDENTS });
});

/* 我的學員 — KpiCard 3 欄 + 篩選(班級/程度)+ 學員卡片格。資料改由 getStudents()
 * 接縫載入,三態閘門(loading/error/ready)。 */
describe('/coach/students (+page)', () => {
	it('renders the heading count and every student name from STUDENTS', async () => {
		const { container, findByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`共 ${STUDENTS.length} 位學員`);
		for (const s of STUDENTS) expect(txt).toContain(s.name);
	});

	it('renders the average attendance KPI', async () => {
		const { container, findByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);
		const avg = Math.round(STUDENTS.reduce((sum, s) => sum + s.att, 0) / STUDENTS.length);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`${avg}%`);
	});

	it('a level filter narrows the rendered students', async () => {
		const { getByText, queryByText, getAllByText, findByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);
		// open the 程度 CoachDropdown (defaults to 全部程度) and pick 選手.
		await fireEvent.click(getByText('全部程度'));
		const athlete = getAllByText('選手').find((el) => el.closest('button'));
		expect(athlete).toBeTruthy();
		await fireEvent.click(athlete!);
		// 張家豪 is 選手 level; 王宥蓁 is 初階 — filtered out.
		expect(getByText('張家豪')).toBeInTheDocument();
		expect(queryByText('王宥蓁')).toBeNull();
	});

	it('shows the existing empty state when a filter matches zero students', async () => {
		// 啟蒙 is a valid level option but no seed student currently holds it.
		const { getByText, getAllByText, findByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);
		await fireEvent.click(getByText('全部程度'));
		const beginner = getAllByText('啟蒙').find((el) => el.closest('button'));
		await fireEvent.click(beginner!);
		expect(getByText('找不到符合的學員')).toBeInTheDocument();
	});
});

describe('/coach/students — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getStudents).mockReset();
		vi.mocked(getStudents).mockRejectedValue(new Error('network'));
		const { findByText } = render(StudentsPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getStudents).mockReset();
		vi.mocked(getStudents).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(StudentsPage);
		expect(getByTestId('students-skeleton')).toBeTruthy();
	});
});
