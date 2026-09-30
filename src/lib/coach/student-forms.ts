/* Dream Fly — coach 學員表單機（R16 Task 3，自 CertificateDialog/ReportCardDialog 與
 * mobile StudentActionSheet 的逐字複製編排抽出）。單檔雙工廠（不用 mode 旗標，
 * ADR 0012 K1），leave-form 形：deps 注入、Readable 快照、outcome 用領域 kind。
 *
 * 進模組的是 machine 機制：欄位 Writable、valid 衍生、valid/in-flight 守衛（擋下回 null）、
 * 欄位 trim、空的選填欄省略、submitting 旗標生命週期、本地日期預設；failed outcome 攜帶
 * 「原始拋出物」不做翻譯。留元件的是：toast 文案（apiErrorMessage 映射）與重置時機
 * （lastOpen 守衛，ADR 0015）。只 import 型別，建構零副作用。 */
import { derived, get, writable, type Readable, type Writable } from 'svelte/store';
import type { CreateCertificateBody, CreateReportCardBody } from './api';
import type { Student } from './data';

export interface StudentFormState {
	submitting: boolean;
	valid: boolean;
}

export type CertificateFormOutcome = { kind: 'certificateIssued' } | { kind: 'failed'; error: unknown };
export type ReportCardFormOutcome = { kind: 'reportCardCreated' } | { kind: 'failed'; error: unknown };

export const RATING_OPTIONS = [
	{ value: '', label: '不評分' },
	{ value: '1', label: '1 星' },
	{ value: '2', label: '2 星' },
	{ value: '3', label: '3 星' },
	{ value: '4', label: '4 星' },
	{ value: '5', label: '5 星' }
];

/** 本地日期(YYYY-MM-DD)，非 toISOString()——後者取 UTC 日期，在 Asia/Taipei(UTC+8)
 *  的凌晨 00:00–08:00 會早報一天。 */
function localIsoDate(): string {
	const d = new Date();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 共用 submit 生命週期：valid/in-flight 守衛 → null；通過後包 submitting 旗標，
 *  deps 拋錯原樣捕捉為 { kind: 'failed', error }。 */
function createSubmitCore(valid: Readable<boolean>) {
	const submitting = writable(false);
	const view: Readable<StudentFormState> = derived([submitting, valid], ([$submitting, $valid]) => ({
		submitting: $submitting,
		valid: $valid
	}));
	async function guarded<T>(run: () => Promise<T>): Promise<T | { kind: 'failed'; error: unknown } | null> {
		if (!get(valid) || get(submitting)) return null;
		submitting.set(true);
		try {
			return await run();
		} catch (error) {
			return { kind: 'failed', error };
		} finally {
			submitting.set(false);
		}
	}
	return { submitting, view, guarded };
}

export interface CertificateFormDeps {
	/** 簽名對齊 coach/api.ts 的 createCertificate（POST /certificates）。 */
	createCertificate(body: CreateCertificateBody): Promise<unknown>;
}

export interface CertificateForm extends Readable<StudentFormState> {
	title: Writable<string>;
	level: Writable<string>;
	issuedOn: Writable<string>;
	note: Writable<string>;
	/** 清空欄位、核發日期回到今天、submitting 歸零。 */
	reset(): void;
	/** null = 守衛擋下（證書名稱 trim 後為空或送出中）；level/note trim 後空字串 → 省略。 */
	submit(student: Pick<Student, 'user_id'>): Promise<CertificateFormOutcome | null>;
}

export function createCertificateForm(deps: CertificateFormDeps): CertificateForm {
	const title = writable('');
	const level = writable('');
	const issuedOn = writable('');
	const note = writable('');
	const core = createSubmitCore(derived(title, ($title) => $title.trim() !== ''));
	return {
		subscribe: core.view.subscribe,
		title,
		level,
		issuedOn,
		note,
		reset(): void {
			title.set('');
			level.set('');
			issuedOn.set(localIsoDate());
			note.set('');
			core.submitting.set(false);
		},
		submit(student): Promise<CertificateFormOutcome | null> {
			return core.guarded(async (): Promise<CertificateFormOutcome> => {
				const body: CreateCertificateBody = {
					user_id: student.user_id,
					title: get(title).trim(),
					issued_on: get(issuedOn)
				};
				if (get(level).trim()) body.level = get(level).trim();
				if (get(note).trim()) body.note = get(note).trim();
				await deps.createCertificate(body);
				return { kind: 'certificateIssued' };
			});
		}
	};
}

export interface ReportCardFormDeps {
	/** 簽名對齊 coach/api.ts 的 createReportCard（POST /report-cards）。 */
	createReportCard(body: CreateReportCardBody): Promise<unknown>;
}

export interface ReportCardForm extends Readable<StudentFormState> {
	enrolmentId: Writable<string>;
	termLabel: Writable<string>;
	comment: Writable<string>;
	/** '' = 不評分；'1'–'5'。 */
	rating: Writable<string>;
	/** 單堂課預填該 enrolment、多堂課留空待選；其餘欄位清空、submitting 歸零。 */
	reset(student: Pick<Student, 'courses'>): void;
	/** null = 守衛擋下（課程/期別/評語未填或送出中）；不評分時省略 rating。 */
	submit(): Promise<ReportCardFormOutcome | null>;
}

export function createReportCardForm(deps: ReportCardFormDeps): ReportCardForm {
	const enrolmentId = writable('');
	const termLabel = writable('');
	const comment = writable('');
	const rating = writable('');
	const core = createSubmitCore(
		derived(
			[enrolmentId, termLabel, comment],
			([$enrolmentId, $termLabel, $comment]) => !!$enrolmentId && $termLabel.trim() !== '' && $comment.trim() !== ''
		)
	);
	return {
		subscribe: core.view.subscribe,
		enrolmentId,
		termLabel,
		comment,
		rating,
		reset(student): void {
			enrolmentId.set(student.courses.length === 1 ? student.courses[0].enrolment_id : '');
			termLabel.set('');
			comment.set('');
			rating.set('');
			core.submitting.set(false);
		},
		submit(): Promise<ReportCardFormOutcome | null> {
			return core.guarded(async (): Promise<ReportCardFormOutcome> => {
				const body: CreateReportCardBody = {
					enrolment_id: get(enrolmentId),
					term_label: get(termLabel).trim(),
					comment: get(comment).trim()
				};
				if (get(rating)) body.rating = Number(get(rating));
				await deps.createReportCard(body);
				return { kind: 'reportCardCreated' };
			});
		}
	};
}
