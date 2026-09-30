import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createCertificateForm, createReportCardForm, RATING_OPTIONS } from './student-forms';
import type { CreateCertificateBody, CreateReportCardBody } from './api';

/* student-forms.ts — coach 學員表單機單元測試（R16 Task 3）。只測 machine 機制
 * （valid/守衛/trim/省略欄位/防雙送/錯誤透傳/預設值），deps 全注入 mock、無渲染；
 * toast 文案與 reset-on-open 仍由元件測試把關。 */

const STUDENT = { user_id: 'su01' };
const ONE_COURSE = { courses: [{ course_id: 'c1', course_name: 'A 班', enrolment_id: 'en-1' }] };
const TWO_COURSES = {
	courses: [
		{ course_id: 'c1', course_name: 'A 班', enrolment_id: 'en-a' },
		{ course_id: 'c2', course_name: 'B 班', enrolment_id: 'en-b' }
	]
};

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('createCertificateForm', () => {
	const makeDeps = () => ({ createCertificate: vi.fn<(b: CreateCertificateBody) => Promise<unknown>>() });

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 5, 0, 30)); // 本地 7/5 00:30（UTC 可能是 7/4）
	});
	afterEach(() => vi.useRealTimers());

	it('初始快照：未送出、未 valid', () => {
		const form = createCertificateForm(makeDeps());
		expect(get(form)).toEqual({ submitting: false, valid: false });
	});

	it('valid 只看證書名稱 trim 後非空', () => {
		const form = createCertificateForm(makeDeps());
		form.title.set('   ');
		expect(get(form).valid).toBe(false);
		form.title.set('結業證書');
		expect(get(form).valid).toBe(true);
	});

	it('reset() 清空欄位、核發日期用本地今天', () => {
		const form = createCertificateForm(makeDeps());
		form.title.set('x');
		form.level.set('x');
		form.note.set('x');
		form.reset();
		expect(get(form.title)).toBe('');
		expect(get(form.level)).toBe('');
		expect(get(form.note)).toBe('');
		expect(get(form.issuedOn)).toBe('2026-07-05');
	});

	it('submit 送 { user_id, title, issued_on }，level/note 留白時省略', async () => {
		const deps = makeDeps();
		deps.createCertificate.mockResolvedValue({});
		const form = createCertificateForm(deps);
		form.reset();
		form.title.set('  結業證書  ');
		form.level.set('  ');
		expect(await form.submit(STUDENT)).toEqual({ kind: 'certificateIssued' });
		expect(deps.createCertificate).toHaveBeenCalledWith({ user_id: 'su01', title: '結業證書', issued_on: '2026-07-05' });
		expect(Object.keys(deps.createCertificate.mock.calls[0][0])).toEqual(['user_id', 'title', 'issued_on']);
	});

	it('level/note 有填時 trim 後帶入', async () => {
		const deps = makeDeps();
		deps.createCertificate.mockResolvedValue({});
		const form = createCertificateForm(deps);
		form.reset();
		form.title.set('T');
		form.level.set(' 結業 ');
		form.note.set(' 優 ');
		await form.submit(STUDENT);
		expect(deps.createCertificate).toHaveBeenCalledWith({
			user_id: 'su01', title: 'T', issued_on: '2026-07-05', level: '結業', note: '優'
		});
	});

	it('invalid 時 submit 回 null 且不呼叫 deps', async () => {
		const deps = makeDeps();
		const form = createCertificateForm(deps);
		expect(await form.submit(STUDENT)).toBeNull();
		expect(deps.createCertificate).not.toHaveBeenCalled();
	});

	it('in-flight 期間 submitting=true、第二次 submit 回 null；結束後歸零', async () => {
		const deps = makeDeps();
		const d = deferred<unknown>();
		deps.createCertificate.mockReturnValue(d.promise);
		const form = createCertificateForm(deps);
		form.title.set('T');
		const first = form.submit(STUDENT);
		expect(get(form).submitting).toBe(true);
		expect(await form.submit(STUDENT)).toBeNull();
		expect(deps.createCertificate).toHaveBeenCalledTimes(1);
		d.resolve({});
		await first;
		expect(get(form).submitting).toBe(false);
	});

	it('deps 拋錯 → failed 攜帶原始拋出物，submitting 歸零', async () => {
		const deps = makeDeps();
		const err = new Error('boom');
		deps.createCertificate.mockRejectedValue(err);
		const form = createCertificateForm(deps);
		form.title.set('T');
		const out = await form.submit(STUDENT);
		expect(out).toEqual({ kind: 'failed', error: err });
		expect((out as { error: unknown }).error).toBe(err);
		expect(get(form).submitting).toBe(false);
	});
});

describe('createReportCardForm', () => {
	const makeDeps = () => ({ createReportCard: vi.fn<(b: CreateReportCardBody) => Promise<unknown>>() });
	const fill = (form: ReturnType<typeof createReportCardForm>) => {
		form.termLabel.set('2026 夏季');
		form.comment.set('進步很多');
	};

	it('RATING_OPTIONS：不評分 + 1–5 星', () => {
		expect(RATING_OPTIONS.map((o) => o.value)).toEqual(['', '1', '2', '3', '4', '5']);
	});

	it('reset(student) 單堂課預填 enrolment，多堂課留空', () => {
		const form = createReportCardForm(makeDeps());
		form.reset(ONE_COURSE);
		expect(get(form.enrolmentId)).toBe('en-1');
		form.reset(TWO_COURSES);
		expect(get(form.enrolmentId)).toBe('');
	});

	it('reset 清空期別/評語/評分', () => {
		const form = createReportCardForm(makeDeps());
		fill(form);
		form.rating.set('5');
		form.reset(ONE_COURSE);
		expect(get(form.termLabel)).toBe('');
		expect(get(form.comment)).toBe('');
		expect(get(form.rating)).toBe('');
	});

	it('valid 需課程 + 期別 + 評語（trim 後非空）', () => {
		const form = createReportCardForm(makeDeps());
		form.reset(TWO_COURSES);
		fill(form);
		expect(get(form).valid).toBe(false);
		form.enrolmentId.set('en-b');
		expect(get(form).valid).toBe(true);
		form.comment.set('  ');
		expect(get(form).valid).toBe(false);
	});

	it('submit 送 trim 後的 body，不評分時省略 rating', async () => {
		const deps = makeDeps();
		deps.createReportCard.mockResolvedValue({});
		const form = createReportCardForm(deps);
		form.reset(ONE_COURSE);
		form.termLabel.set('  2026 夏季  ');
		form.comment.set('  進步很多  ');
		expect(await form.submit()).toEqual({ kind: 'reportCardCreated' });
		expect(deps.createReportCard).toHaveBeenCalledWith({ enrolment_id: 'en-1', term_label: '2026 夏季', comment: '進步很多' });
		expect('rating' in deps.createReportCard.mock.calls[0][0]).toBe(false);
	});

	it('選了評分時 rating 為 number；多堂課送選定的 enrolment', async () => {
		const deps = makeDeps();
		deps.createReportCard.mockResolvedValue({});
		const form = createReportCardForm(deps);
		form.reset(TWO_COURSES);
		form.enrolmentId.set('en-b');
		fill(form);
		form.rating.set('4');
		await form.submit();
		expect(deps.createReportCard).toHaveBeenCalledWith({
			enrolment_id: 'en-b', term_label: '2026 夏季', comment: '進步很多', rating: 4
		});
	});

	it('invalid 時 submit 回 null 且不呼叫 deps', async () => {
		const deps = makeDeps();
		const form = createReportCardForm(deps);
		form.reset(TWO_COURSES);
		fill(form);
		expect(await form.submit()).toBeNull();
		expect(deps.createReportCard).not.toHaveBeenCalled();
	});

	it('in-flight 守衛與 submitting 生命週期', async () => {
		const deps = makeDeps();
		const d = deferred<unknown>();
		deps.createReportCard.mockReturnValue(d.promise);
		const form = createReportCardForm(deps);
		form.reset(ONE_COURSE);
		fill(form);
		const first = form.submit();
		expect(get(form).submitting).toBe(true);
		expect(await form.submit()).toBeNull();
		d.resolve({});
		await first;
		expect(get(form).submitting).toBe(false);
	});

	it('deps 拋錯 → failed 攜帶原始拋出物', async () => {
		const deps = makeDeps();
		const err = new Error('409');
		deps.createReportCard.mockRejectedValue(err);
		const form = createReportCardForm(deps);
		form.reset(ONE_COURSE);
		fill(form);
		const out = await form.submit();
		expect((out as { error: unknown }).error).toBe(err);
		expect(out?.kind).toBe('failed');
		expect(get(form).submitting).toBe(false);
	});
});
