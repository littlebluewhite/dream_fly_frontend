import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	createContactForm,
	INITIAL_DRAFT,
	NAME_REQUIRED_ERROR,
	EMAIL_INVALID_ERROR,
	PHONE_INVALID_ERROR,
	MESSAGE_REQUIRED_ERROR,
	SEND_FAILED_ERROR,
	RESET_DELAY_MS
} from './contact-form';
import { ApiError } from '../api/client';
import type { ApiInquiry, ContactPayload } from './api';

/* contact-form.ts — public 洽詢表單機的單元測試（R10 架構深化 Wave 1 C 案）。只測
 * machine 機制（4 道守衛文案與 regex 邊界／phone 省略／送出生命週期／schedule 排程
 * 與殘留 timer 取消／in-flight 守衛／錯誤透傳），deps 全注入 mock、無渲染；元件端的
 * markup 綁定與 outcome→toast 佈線仍由既有 ContactForm.test.ts 把關（mock 面不變、
 * 4 it 原樣保留），兩層各測各的。
 *
 * 零 fake timers：schedule 是注入依賴，測試用 stub 把每次呼叫的 (fn, ms) 記錄下來，
 * 需要「timer 到期」時直接呼叫記錄到的 fn 模擬觸發，不呼叫 vi.useFakeTimers()
 * （TrialScreen.test.ts:36-38 明文警告：fake timers 會跟 findByText/waitFor 這類
 * 仰賴真實計時器 polling 的斷言打架）。 */

const INQUIRY: ApiInquiry = {
	id: 'inq-1',
	name: '王小明',
	email: 'a@b.com',
	phone: null,
	subject: '一般諮詢',
	message: '想詢問課程時間',
	status: 'new',
	assigned_to: null,
	created_at: '',
	updated_at: ''
};

/** state 的 idle 初始快照——本地複本（同 leave-form.test.ts INITIAL_VIEW 慣例，
 *  INITIAL_STATE 本就不是模組的 exported 成員）。 */
const INITIAL_STATE = { status: 'idle', errorMessage: '' };

/** schedule 的注入 stub：不用 vi.useFakeTimers()，把每次呼叫的 (fn, ms) 連同一個
 *  獨立的 cancel vi.fn() 記錄下來——測試需要「timer 到期」時直接呼叫 scheduled[i].fn()，
 *  需要驗證「殘留 timer 被取消」時斷言 scheduled[i].cancel 的呼叫次數。 */
function makeDeps() {
	const scheduled: { fn: () => void; ms: number; cancel: ReturnType<typeof vi.fn> }[] = [];
	return {
		send: vi.fn<(payload: ContactPayload) => Promise<ApiInquiry>>(),
		schedule: vi.fn((fn: () => void, ms: number) => {
			const cancel = vi.fn();
			scheduled.push({ fn, ms, cancel });
			return cancel;
		}),
		scheduled
	};
}

/** 手動控制 resolve/reject 時序的 promise，用於驗 in-flight 期間的守衛語意。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

let deps: ReturnType<typeof makeDeps>;
let form: ReturnType<typeof createContactForm>;

beforeEach(() => {
	deps = makeDeps();
	form = createContactForm(deps);
});

/** 把 draft 填成合法值，個別欄位可覆寫以測特定守衛。每次呼叫都全量設定
 *  name/email/phone/message，不依賴上一次呼叫留下的殘值。 */
function fillValid(overrides: { name?: string; email?: string; phone?: string; message?: string } = {}) {
	form.draft.update((d) => ({
		...d,
		name: '王小明',
		email: 'a@b.com',
		phone: '',
		message: '想詢問課程時間',
		...overrides
	}));
}

describe('createContactForm — 建構', () => {
	it('零副作用：draft 為 INITIAL_DRAFT、state 為 idle/空字串，不觸發 deps', () => {
		expect(get(form.draft)).toEqual(INITIAL_DRAFT);
		expect(get(form)).toEqual(INITIAL_STATE);
		expect(deps.send).not.toHaveBeenCalled();
		expect(deps.schedule).not.toHaveBeenCalled();
	});
});

describe('createContactForm — 文案常數（逐字對應原 ContactForm.svelte 字面值）', () => {
	it('5 個 exported const 與原元件內聯字串逐字相同', () => {
		expect(NAME_REQUIRED_ERROR).toBe('請輸入您的姓名');
		expect(EMAIL_INVALID_ERROR).toBe('請輸入有效的電子郵件地址');
		expect(PHONE_INVALID_ERROR).toBe('請輸入有效的電話號碼');
		expect(MESSAGE_REQUIRED_ERROR).toBe('請輸入訊息內容');
		expect(SEND_FAILED_ERROR).toBe('送出失敗，請稍後再試');
	});
});

describe('createContactForm — 四道守衛（依序；regex 邊界）', () => {
	it('姓名空白（純空白 trim 後為空）→ NAME_REQUIRED_ERROR；不打 deps.send；status 不變', async () => {
		fillValid({ name: '   ' });
		expect(await form.submit()).toEqual({ kind: 'validationFailed' });
		expect(get(form)).toEqual({ status: 'idle', errorMessage: NAME_REQUIRED_ERROR });
		expect(deps.send).not.toHaveBeenCalled();
	});

	it('email 格式不符 → EMAIL_INVALID_ERROR（regex 邊界：無 @ 擋、無網域擋）；合法格式過', async () => {
		fillValid({ email: 'not-an-email' });
		expect(await form.submit()).toEqual({ kind: 'validationFailed' });
		expect(get(form).errorMessage).toBe(EMAIL_INVALID_ERROR);

		fillValid({ email: 'a@b' }); // 有 @ 但缺網域（regex 要求 @ 後仍需一個 "."）
		expect(await form.submit()).toEqual({ kind: 'validationFailed' });
		expect(get(form).errorMessage).toBe(EMAIL_INVALID_ERROR);
		expect(deps.send).not.toHaveBeenCalled();

		deps.send.mockResolvedValue(INQUIRY);
		fillValid({ email: 'a@b.com' });
		expect((await form.submit()).kind).toBe('inquirySent');
	});

	it('phone 選填：留空略過守衛；有值時依 regex 字元類與碼數把關（邊界：9 碼擋、10 碼過、允許 -/空白/()、英文字母擋）', async () => {
		deps.send.mockResolvedValue(INQUIRY);
		fillValid({ phone: '' });
		expect((await form.submit()).kind).toBe('inquirySent'); // 留空 → 完全略過此守衛
		expect(deps.send).toHaveBeenCalledTimes(1);

		fillValid({ phone: '123456789' }); // 9 碼，字元合法但碼數不足
		expect(await form.submit()).toEqual({ kind: 'validationFailed' });
		expect(get(form).errorMessage).toBe(PHONE_INVALID_ERROR);
		expect(deps.send).toHaveBeenCalledTimes(1); // 未新增呼叫

		fillValid({ phone: 'abc-123-4567' }); // 含英文字母，字元類即不合法
		expect(await form.submit()).toEqual({ kind: 'validationFailed' });
		expect(get(form).errorMessage).toBe(PHONE_INVALID_ERROR);
		expect(deps.send).toHaveBeenCalledTimes(1);

		fillValid({ phone: '0912-345-678' }); // 10 碼 + 允許符號 -/空白/() → 過
		expect((await form.submit()).kind).toBe('inquirySent');
		expect(deps.send).toHaveBeenCalledTimes(2);
	});

	it('訊息內容空白 → MESSAGE_REQUIRED_ERROR', async () => {
		fillValid({ message: '   ' });
		expect(await form.submit()).toEqual({ kind: 'validationFailed' });
		expect(get(form).errorMessage).toBe(MESSAGE_REQUIRED_ERROR);
		expect(deps.send).not.toHaveBeenCalled();
	});
});

describe('createContactForm — 送出成功', () => {
	it('phone 省略：留空不進 payload；填寫時原樣附帶（同原元件 :58-64 條件展開）', async () => {
		deps.send.mockResolvedValue(INQUIRY);

		fillValid({ phone: '' });
		await form.submit();
		expect(deps.send).toHaveBeenCalledWith({
			name: '王小明',
			email: 'a@b.com',
			subject: '一般諮詢',
			message: '想詢問課程時間'
		});
		expect(deps.send.mock.calls[0][0]).not.toHaveProperty('phone');

		fillValid({ phone: '0912-345-678' });
		await form.submit();
		expect(deps.send).toHaveBeenLastCalledWith({
			name: '王小明',
			email: 'a@b.com',
			subject: '一般諮詢',
			message: '想詢問課程時間',
			phone: '0912-345-678'
		});
	});

	it('成功生命週期：guards 全過 → send → state 轉 success（errorMessage 清空）→ 排程 reset(RESET_DELAY_MS) → outcome inquirySent', async () => {
		deps.send.mockResolvedValue(INQUIRY);
		fillValid();

		const outcome = await form.submit();
		expect(outcome).toEqual({ kind: 'inquirySent' });
		expect(get(form)).toEqual({ status: 'success', errorMessage: '' });
		expect(deps.schedule).toHaveBeenCalledTimes(1);
		expect(deps.schedule).toHaveBeenCalledWith(expect.any(Function), RESET_DELAY_MS);
	});

	it('schedule stub 手動 fire → draft 與 state 都打回初始值（零 fake timers，直接呼叫記錄到的 fn）', async () => {
		deps.send.mockResolvedValue(INQUIRY);
		fillValid();
		await form.submit();
		form.draft.update((d) => ({ ...d, name: '編輯中' })); // success 展示期間使用者又動了草稿
		expect(deps.scheduled).toHaveLength(1);

		deps.scheduled[0].fn(); // 手動觸發「timer 到期」

		expect(get(form.draft)).toEqual(INITIAL_DRAFT);
		expect(get(form)).toEqual(INITIAL_STATE);
	});
});

describe('createContactForm — 殘留 timer 取消（bug 修復）', () => {
	it('二次成功前取消殘留 timer：第二次 submit() 呼叫時，第一次 schedule 回傳的 cancel 函式被呼叫一次', async () => {
		deps.send.mockResolvedValue(INQUIRY);
		fillValid();

		await form.submit(); // 第一次成功，排程 reset #1
		expect(deps.scheduled).toHaveLength(1);
		const firstCancel = deps.scheduled[0].cancel;
		expect(firstCancel).not.toHaveBeenCalled();

		await form.submit(); // 第二次成功，發生在第一顆 timer 到期之前（草稿未變、沿用原欄位）
		expect(firstCancel).toHaveBeenCalledTimes(1); // 修復：submit() 送出前取消殘留 timer
		expect(deps.scheduled).toHaveLength(2); // 另外排一顆 #2
		expect(get(form)).toEqual({ status: 'success', errorMessage: '' }); // 第二次的 success 未被第一顆殘留 timer 打斷
	});
});

describe('createContactForm — in-flight 守衛（程式層新增，原僅 markup disabled）', () => {
	it('deferred 送出期間再呼叫 submit() → alreadySubmitting，deps.send 只呼叫一次；resolve 後狀態復位', async () => {
		const d = deferred<ApiInquiry>();
		deps.send.mockReturnValue(d.promise);
		fillValid();

		const first = form.submit(); // 起飛，status 同步翻 submitting（不等 resolve）
		expect(get(form).status).toBe('submitting');
		expect(await form.submit()).toEqual({ kind: 'alreadySubmitting' }); // 第二發被擋
		expect(deps.send).toHaveBeenCalledTimes(1);

		d.resolve(INQUIRY);
		const outcome = await first;
		expect(outcome).toEqual({ kind: 'inquirySent' });
		expect(get(form).status).toBe('success');
	});
});

describe('createContactForm — 失敗透傳', () => {
	it('ApiError：errorMessage 用 ApiError.message；outcome 攜帶原始物件；status 轉 error', async () => {
		const err = new ApiError(422, '欄位格式錯誤');
		deps.send.mockRejectedValue(err);
		fillValid();

		const outcome = await form.submit();
		expect(outcome.kind).toBe('failed');
		if (outcome.kind === 'failed') expect(outcome.error).toBe(err); // 原始拋出物，非包裝/翻譯
		expect(get(form)).toEqual({ status: 'error', errorMessage: '欄位格式錯誤' });
	});

	it('非 ApiError：errorMessage 落回 SEND_FAILED_ERROR 通用句，outcome 仍攜帶原始拋出物', async () => {
		const err = new Error('network down');
		deps.send.mockRejectedValue(err);
		fillValid();

		const outcome = await form.submit();
		expect(outcome).toEqual({ kind: 'failed', error: err });
		expect(get(form)).toEqual({ status: 'error', errorMessage: SEND_FAILED_ERROR });
	});
});
