import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import StudentActionSheet from './StudentActionSheet.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import type { Student } from '$lib/coach/data';

/* Task 20：前身 StudentSkillsSheet 是純本地假調整分數(無後端)——Student 型別真後端
 * 只有單一 skill/pct(P2 佔位)，沒有多技能評量表可編輯。改為桌面 StudentCard 真正
 * 提供的兩個動作：寫評語(POST /report-cards)、發證書(POST /certificates)。
 *
 * R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，讓 createCertificate/
 * createReportCard(畫面直取 $lib/coach/api)走真實呼叫，同
 * CertificateDialog.test.ts/ReportCardDialog.test.ts 慣例。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

beforeEach(() => {
	vi.mocked(api).mockReset();
});

const STUDENT_ONE_COURSE: Student = {
	user_id: 'u1',
	name: '王小明',
	initial: '王',
	color: '#000',
	cls: '兒童體操初階 B 班',
	courses: [{ course_id: 'c1', course_name: '兒童體操初階 B 班', enrolment_id: 'en-1' }]
};

describe('StudentActionSheet — 發證書 (POST /certificates)', () => {
	it('submits a CreateCertificateBody for the student and closes on success', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /certificates': {} }));
		const onClose = vi.fn();
		render(StudentActionSheet, { props: { onClose, student: STUDENT_ONE_COURSE, mode: 'certificate' } });

		await fireEvent.input(screen.getByLabelText('證書名稱'), { target: { value: '結業證書' } });
		await fireEvent.click(screen.getByText('發放證書').closest('button')!);

		await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
		const body = JSON.parse(vi.mocked(api).mock.calls[0][1]?.body as string);
		expect(body).toMatchObject({ user_id: 'u1', title: '結業證書' });
	});

	it('disables submit until a title is entered', () => {
		render(StudentActionSheet, { props: { onClose: () => {}, student: STUDENT_ONE_COURSE, mode: 'certificate' } });
		expect(screen.getByText('發放證書').closest('button')).toBeDisabled();
	});
});

describe('StudentActionSheet — 寫評語 (POST /report-cards)', () => {
	it('single-course student: enrolment_id auto-filled, submits on valid input', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': {} }));
		const onClose = vi.fn();
		render(StudentActionSheet, { props: { onClose, student: STUDENT_ONE_COURSE, mode: 'reportCard' } });

		await fireEvent.input(screen.getByLabelText('期別'), { target: { value: '2026 夏季' } });
		await fireEvent.input(screen.getByLabelText('評語'), { target: { value: '進步很多' } });
		await fireEvent.click(screen.getByText('建立成績單').closest('button')!);

		await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(api).toHaveBeenCalledWith('/report-cards', {
			method: 'POST',
			body: JSON.stringify({ enrolment_id: 'en-1', term_label: '2026 夏季', comment: '進步很多' })
		});
	});

	it('multi-course student: shows a course picker instead of auto-filling', () => {
		const multi: Student = {
			...STUDENT_ONE_COURSE,
			courses: [
				{ course_id: 'c1', course_name: '兒童體操初階 B 班', enrolment_id: 'en-1' },
				{ course_id: 'c2', course_name: '兒童體操中階 A 班', enrolment_id: 'en-2' }
			]
		};
		render(StudentActionSheet, { props: { onClose: () => {}, student: multi, mode: 'reportCard' } });
		expect(screen.getByLabelText('課程')).toBeInTheDocument();
		expect(screen.getByText('建立成績單').closest('button')).toBeDisabled();
	});

	it('shows the backend error message on failure and does not close', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': new Error('此期別已建立過成績單') }));
		const onClose = vi.fn();
		render(StudentActionSheet, { props: { onClose, student: STUDENT_ONE_COURSE, mode: 'reportCard' } });

		await fireEvent.input(screen.getByLabelText('期別'), { target: { value: '2026 夏季' } });
		await fireEvent.input(screen.getByLabelText('評語'), { target: { value: '進步很多' } });
		await fireEvent.click(screen.getByText('建立成績單').closest('button')!);

		await vi.waitFor(() => expect(api).toHaveBeenCalled());
		expect(onClose).not.toHaveBeenCalled();
	});
});
