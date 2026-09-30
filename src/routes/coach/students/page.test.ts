import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StudentsPage from './+page.svelte';
import type { Student } from '$lib/coach/data';
import { getStudents } from '$lib/coach/api';
import { search } from '$lib/coach/stores';

// createCertificate/createReportCard 也在此一併 mock（不執行真呼叫）——
// CertificateDialog/ReportCardDialog（Task 13）從同一個模組 import，若省略會在
// dialog 元件初始化時解析成 undefined 的具名匯出;本檔案只驗證「發證書」「寫評語」
// 開啟 dialog 的接線，送出/錯誤分支見各 dialog 自己的測試檔。
vi.mock('$lib/coach/api', () => ({ getStudents: vi.fn(), createCertificate: vi.fn(), createReportCard: vi.fn() }));

// Task 1(C2 死種子退役):coach/data.ts 的 STUDENTS(值)已退役——改為檔內 inline
// fixture(2 筆,沿用真實種子 su01/su04 的欄位值)。
const STUDENTS: Student[] = [
	{ user_id: 'su01', name: '王宥蓁', initial: '王', color: '#0066CC', cls: '兒童體操初階 B 班', courses: [{ course_id: 'c-jr-b', course_name: '兒童體操初階 B 班', enrolment_id: 'en-su01' }] },
	{ user_id: 'su04', name: '張家豪', initial: '張', color: '#8B5CF6', cls: '競技選手培訓班', courses: [{ course_id: 'c-elite', course_name: '競技選手培訓班', enrolment_id: 'en-su04' }] }
];

beforeEach(() => {
	search.set('');
	vi.mocked(getStudents).mockReset();
	vi.mocked(getStudents).mockResolvedValue({ students: STUDENTS });
});

/* 我的學員 — KpiCard(學員總數)+ 篩選(班級)+ 學員卡片格。資料改由 getStudents()
 * 接縫載入,三態閘門(loading/error/ready)。 */
describe('/coach/students (+page)', () => {
	it('renders the heading count and every student name from STUDENTS', async () => {
		const { container, findByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`共 ${STUDENTS.length} 位學員`);
		for (const s of STUDENTS) expect(txt).toContain(s.name);
	});

	it('只留學員總數 KPI:不再有平均出席率/待加強(原本每位學員都被算成出席率低於 75%)', async () => {
		const { container, findByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('學員總數');
		expect(txt).not.toContain('平均出席率');
		expect(txt).not.toContain('待加強');
		expect(txt).not.toContain('出席率低於 75%');
	});

	it('學員卡不顯示後端沒有的程度/技能評量/出席率,也沒有「查看詳情」示範入口', async () => {
		const { container, findByText, queryByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);
		expect(queryByText('查看詳情')).toBeNull();
		expect(queryByText('全部程度')).toBeNull();
		expect(container.textContent ?? '').not.toContain('%');
	});

	it('同名學員各自渲染一張卡(列表 key 是 user_id,不是姓名)', async () => {
		const twin: Student = { ...STUDENTS[0], user_id: 'su99' };
		vi.mocked(getStudents).mockResolvedValue({ students: [STUDENTS[0], twin] });
		const { findAllByText } = render(StudentsPage);
		expect(await findAllByText(STUDENTS[0].name)).toHaveLength(2);
	});

	it('shows the existing empty state when the search matches zero students', async () => {
		const { getByText, findByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);
		search.set('___no-such-student___');
		expect(await findByText('找不到符合的學員')).toBeInTheDocument();
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

/* 發證書入口（Task 13；POST /certificates，見 integration-contract.md §3.22）——只驗證
 * 「點擊某位學員的發證書」開啟 CertificateDialog 並帶入該學員，且可關閉。實際送出/
 * 403/422 分支由 CertificateDialog.test.ts 覆蓋（該元件的送出邏輯與這裡的開關接線
 * 是獨立關注點，同 member/mine 頁對 LeaveDialog/MakeupDialog 開啟接線 vs 元件自身
 * 送出邏輯的分工）。 */
describe('/coach/students — 發證書', () => {
	it('點擊某位學員的「發證書」開啟 dialog 並帶入正確學員', async () => {
		const { getAllByText, findByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);

		const buttons = getAllByText('發證書');
		await fireEvent.click(buttons[0]);

		expect(await findByText(`頒發對象：${STUDENTS[0].name}`)).toBeInTheDocument();
	});

	it('不同學員各自帶入正確的頒發對象', async () => {
		const { getAllByText, findByText, queryByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);

		const buttons = getAllByText('發證書');
		await fireEvent.click(buttons[1]);

		expect(await findByText(`頒發對象：${STUDENTS[1].name}`)).toBeInTheDocument();
		expect(queryByText(`頒發對象：${STUDENTS[0].name}`)).toBeNull();
	});

	it('點擊「取消」關閉 dialog', async () => {
		const { getAllByText, findByText, getByText, queryByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);

		const buttons = getAllByText('發證書');
		await fireEvent.click(buttons[0]);
		await findByText(`頒發對象：${STUDENTS[0].name}`);

		await fireEvent.click(getByText('取消'));
		expect(queryByText(`頒發對象：${STUDENTS[0].name}`)).toBeNull();
	});
});

/* 寫評語入口（Task 13 續；POST /report-cards，§3.22）——同發證書的分工：只驗證
 * 開啟/帶入學員/關閉的接線，payload/409/多課選擇分支見 ReportCardDialog.test.ts。 */
describe('/coach/students — 寫評語', () => {
	it('點擊某位學員的「寫評語」開啟 dialog 並帶入正確學員', async () => {
		const { getAllByText, findByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);

		const buttons = getAllByText('寫評語');
		await fireEvent.click(buttons[0]);

		expect(await findByText(`評語對象：${STUDENTS[0].name}`)).toBeInTheDocument();
	});

	it('不同學員各自帶入正確的評語對象', async () => {
		const { getAllByText, findByText, queryByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);

		const buttons = getAllByText('寫評語');
		await fireEvent.click(buttons[1]);

		expect(await findByText(`評語對象：${STUDENTS[1].name}`)).toBeInTheDocument();
		expect(queryByText(`評語對象：${STUDENTS[0].name}`)).toBeNull();
	});

	it('點擊「取消」關閉 dialog', async () => {
		const { getAllByText, findByText, getByText, queryByText } = render(StudentsPage);
		await findByText(STUDENTS[0].name);

		const buttons = getAllByText('寫評語');
		await fireEvent.click(buttons[0]);
		await findByText(`評語對象：${STUDENTS[0].name}`);

		await fireEvent.click(getByText('取消'));
		expect(queryByText(`評語對象：${STUDENTS[0].name}`)).toBeNull();
	});
});
