/* Dream Fly — public 洽詢表單機（R10 架構深化 Wave 1 C 案，ADR 0012 名冊第八例）。
 * 自 ContactForm.svelte 內聯的驗證/送出/重置編排（原 :20-84，含零覆蓋的
 * setTimeout(3000)）抽出，元件退薄殼。
 *
 * 位置：住 public surface lib（非 lib/components/——該目錄零 .ts 邏輯模組先例），
 * 與 sendContactInquiry（./api）、calendar-grid 同居；洽詢本屬 public 領域，不比照
 * login-submit 收在 lib 根（那是跨 surface 共用純編排，洽詢只有桌面一個呼叫端）。
 *
 * 形：仿 settings-form 的單物件草稿 Writable<ContactDraft> + 4 態快照
 * { status, errorMessage }（非 leave-form 拆欄位 Writable 的形——5 欄本身就是
 * 驗證對象，沒有「未選即無效」這種需要額外 derived valid 的欄位）。4 道守衛
 * 文案（姓名/email/phone/message）進本模組為 exported const——決定性先例是
 * login-submit.ts 的 EMPTY_FIELDS_ERROR：inline error box 的文案必須有單一
 * 字串源，不與內部映射各自維護一份可能分岔的複本。第 5 個常數
 * SEND_FAILED_ERROR 是失敗且非 ApiError 時的通用句。
 *
 * outcome 用領域 kind（ADR 0012 判準③），非通用 ok/error：inquirySent｜
 * validationFailed｜failed（原拋物；繁中文案已在本模組映射進 state.errorMessage，
 * 呼叫端不必再譯一次）｜alreadySubmitting（新增的程式層 in-flight 守衛——原
 * 元件只靠 markup disabled 擋二次送出，submit() 現在也擋，見下方 in-flight
 * 守衛附註）。
 *
 * schedule 為注入依賴，簽名 (fn, ms) => cancel，取代裸 setTimeout：submit() 於
 * 驗證通過、真正送出「前」呼叫 cancelReset?.() 取消上一輪殘留的重置排程——
 * 修一個真 bug：原本連續兩次成功送出（第二次發生在第一次的 3 秒重置 timer
 * 觸發前）時，第一次的 timer 仍會在原定的 3 秒準時觸發，把「應該再顯示滿
 * 3 秒」的第二次 success 提早打斷回 idle。「卸載後 timer 仍 fire、寫入已卸載
 * 元件」這個既有小缺陷刻意不修：重構後 timer 寫的是本模組的 store，不是元件
 * 變數，沒有可觀測後果，不值得為此加 onDestroy 介面稅。
 *
 * 元件仍持有：5 個科目選項 subjects 陣列（純顯示資料，非驗證對象）、outcome→
 * toast 的佈線（成功/失敗 toast 文案與時機，ADR 0011 呼叫端映射慣例）；且仍
 * import sendContactInquiry 後才注入本模組——元件測試以 fakeRouter 假造 api()
 * （HTTP seam）即可攔截，是佈線正確的證明。 */
import { get, writable, type Readable, type Writable } from 'svelte/store';
import { ApiError } from '../api/client';
import type { ContactPayload } from './api';
import type { InquiryResponse } from '$lib/api/generated';

export interface ContactDraft {
	name: string;
	email: string;
	phone: string;
	subject: string;
	message: string;
}

export const INITIAL_DRAFT: ContactDraft = {
	name: '',
	email: '',
	phone: '',
	subject: '一般諮詢',
	message: ''
};

/** 4 道守衛文案 + 1 個送出失敗通用句——單一字串源，元件的 inline error box 與
 *  本模組內部映射同讀這 5 個 const（決定性先例：login-submit.ts EMPTY_FIELDS_ERROR）。 */
export const NAME_REQUIRED_ERROR = '請輸入您的姓名';
export const EMAIL_INVALID_ERROR = '請輸入有效的電子郵件地址';
export const PHONE_INVALID_ERROR = '請輸入有效的電話號碼';
export const MESSAGE_REQUIRED_ERROR = '請輸入訊息內容';
export const SEND_FAILED_ERROR = '送出失敗，請稍後再試';

/** 成功後幾秒重置回 idle（逐字沿用原元件的 setTimeout(3000)）。 */
export const RESET_DELAY_MS = 3000;

export interface ContactFormState {
	status: 'idle' | 'submitting' | 'success' | 'error';
	errorMessage: string;
}

const INITIAL_STATE: ContactFormState = { status: 'idle', errorMessage: '' };

/** submit() 的結果——領域 kind（ADR 0012 判準③）；failed 攜帶原始拋出物，
 *  但繁中文案已在本模組映射進 state.errorMessage（呼叫端不必再譯一次；洽詢
 *  的失敗文案本就只有「ApiError.message 透傳」或「一句通用句」兩種，不像
 *  leave-form/settings-form 那類多重 4xx 分支需要呼叫端各自決定映射）。
 *  alreadySubmitting 是新增的程式層 in-flight 守衛擋下時的明確 kind（同
 *  settings-form 的 alreadySaving，非靜默 null）。 */
export type ContactFormOutcome =
	| { kind: 'inquirySent' }
	| { kind: 'validationFailed' }
	| { kind: 'failed'; error: unknown }
	| { kind: 'alreadySubmitting' };

export interface ContactFormDeps {
	/** 簽名對齊 public/api.ts 的 sendContactInquiry（POST /contact）。 */
	send(payload: ContactPayload): Promise<InquiryResponse>;
	/** setTimeout 的抽象注入，回傳 cancel()；submit() 於送出前用它取消上一輪
	 *  殘留的重置排程（見模組頂部附註的 bug 修復）。 */
	schedule(fn: () => void, ms: number): () => void;
}

export interface ContactForm extends Readable<ContactFormState> {
	draft: Writable<ContactDraft>;
	/** in-flight 中再呼叫 → { kind: 'alreadySubmitting' }；否則逐字重放原
	 *  handleSubmit 的四道依序守衛（姓名→email→phone(選填)→message），未通過
	 *  → { kind: 'validationFailed' } 且只更新 errorMessage（status 不變，
	 *  逐字對應原元件「guard 失敗不動 formStatus」的行為）。全數通過後取消
	 *  殘留 timer、送出；成功排程 RESET_DELAY_MS 後把 draft/state 都打回
	 *  初始值，失敗把 ApiError.message 或 SEND_FAILED_ERROR 寫入 errorMessage。 */
	submit(): Promise<ContactFormOutcome>;
}

function validateEmail(email: string): boolean {
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return re.test(email);
}

function validatePhone(phone: string): boolean {
	const re = /^[0-9\-\s\(\)]+$/;
	return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

export function createContactForm(deps: ContactFormDeps): ContactForm {
	const draft = writable<ContactDraft>({ ...INITIAL_DRAFT });
	const state = writable<ContactFormState>({ ...INITIAL_STATE });
	let cancelReset: (() => void) | null = null;

	async function submit(): Promise<ContactFormOutcome> {
		if (get(state).status === 'submitting') return { kind: 'alreadySubmitting' };

		state.update((s) => ({ ...s, errorMessage: '' }));
		const d = get(draft);

		if (!d.name.trim()) {
			state.update((s) => ({ ...s, errorMessage: NAME_REQUIRED_ERROR }));
			return { kind: 'validationFailed' };
		}
		if (!validateEmail(d.email)) {
			state.update((s) => ({ ...s, errorMessage: EMAIL_INVALID_ERROR }));
			return { kind: 'validationFailed' };
		}
		if (d.phone && !validatePhone(d.phone)) {
			state.update((s) => ({ ...s, errorMessage: PHONE_INVALID_ERROR }));
			return { kind: 'validationFailed' };
		}
		if (!d.message.trim()) {
			state.update((s) => ({ ...s, errorMessage: MESSAGE_REQUIRED_ERROR }));
			return { kind: 'validationFailed' };
		}

		cancelReset?.(); // 取消上一輪殘留的重置排程（bug 修復，見模組頂部附註）
		cancelReset = null;
		state.update((s) => ({ ...s, status: 'submitting' }));

		try {
			await deps.send({
				name: d.name,
				email: d.email,
				subject: d.subject,
				message: d.message,
				...(d.phone ? { phone: d.phone } : {})
			});
			state.set({ status: 'success', errorMessage: '' });
			cancelReset = deps.schedule(() => {
				draft.set({ ...INITIAL_DRAFT });
				state.set({ status: 'idle', errorMessage: '' });
			}, RESET_DELAY_MS);
			return { kind: 'inquirySent' };
		} catch (err) {
			const message = err instanceof ApiError ? err.message : SEND_FAILED_ERROR;
			state.set({ status: 'error', errorMessage: message });
			return { kind: 'failed', error: err };
		}
	}

	return { subscribe: state.subscribe, draft, submit };
}
