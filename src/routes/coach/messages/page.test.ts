import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import MessagesPage from './+page.svelte';
import { search, toasts } from '$lib/coach/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs } from '$lib/testing/coach-session';
import { COACH_ROUTES, COACH_USER } from '$lib/testing/coach-routes';
import { authStore } from '$lib/stores/authStore';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* Task 12：訊息中心接真對話 API（§3.21）。
 * - 清單：getConversations()(GET /conversations/me)。
 * - 串：選定對話時 getThread(id)(GET /conversations/{id}/messages) + markRead(id)
 *   (PATCH .../read)，兩者各自 best-effort、互不阻塞。
 * - 傳送：sendMessage(id, body)(POST .../messages)，回應直接附加到本地串(同
 *   saveAttendance 用 mutation 回應同步本地狀態的慣例，非樂觀回顯、非整段重新 GET)。
 * - sharedFiles UI 區塊移除（v1 不支援檔案附件，契約依據）。
 * - 撰寫新對話：picker 名冊來自 getStudents()(GET /coaches/me/students，Task 10 已接真)，
 *   確認即 createConversation(user_id, name)(POST /conversations，get-or-create)——回傳
 *   既有對話 id 時選中既有列不重複插入；全新對話插入清單並選中。
 *
 * Round 8 C1：對話串編排（stale-guard、樂觀附加）收進 $lib/coach/messages-controller.ts
 * 後，原本靠 render 之舞驗證的「快速切換對話時較舊回應不覆蓋當前對話」「送出中途切換
 * 對話」兩段測試已搬到 messages-controller.test.ts 的無渲染單測（更快、更直接斷言
 * outcome/thread 快照）。「送出失敗還原輸入框」這段行為本身**搬不走**——reply 是頁面
 * 本地狀態（非 controller 收編範圍），controller 測試只驗得到 sendFailed outcome 有
 * 沒有攜帶正確的 text，驗不到頁面 `reply = outcome.text` 這行接線本身是否真的寫對
 * （codex 對抗審 P3：先前誤把這段也算進「已搬走」，導致這行接線一度可以被刪掉、
 * 套件仍全綠），故仍以獨立測試留在本檔下方覆蓋。本檔留下的仍是渲染必要的斷言：
 * 清單/三態/compose 佈線、outcome→toast 文案映射、以及這條 reply 接線本身。
 *
 * R16 Task 8(候選 10)：改 mock $lib/api/client 的 api()，六支 coach/api 函式全走真實
 * fetch adapter；原本斷言 getThread(id)/markRead(id)/sendMessage(id, body)/
 * createConversation(user_id, name)/getStudents() 的呼叫參數，改斷言對應的 HTTP 請求
 * (路徑 + body)。對話串判斷 who='me' 用 authStore 登入者 id(loginAs(COACH_USER))。 */

const ME = COACH_USER.id;

const CONVOS = [
	{ id: 'c1', peer_id: 'p1', peer_name: '王媽媽', last_message_body: '老師您好，小明明天的課可以調整時間嗎？', last_message_at: '2026-07-05T09:42:00Z', unread_count: 2 },
	{ id: 'c2', peer_id: 'su3', peer_name: '陳爸爸', last_message_body: '謝謝老師這學期的細心指導！', last_message_at: '2026-07-04T20:00:00Z', unread_count: 3 }
];

/** GET /conversations/{id}/messages 的分頁包裝；後端新到舊(DESC)，頁面反轉成舊到新。 */
const thread = (...messages: { id: string; sender_id: string; body: string; created_at: string }[]) => ({
	messages: messages.map((m) => ({ ...m, read_at: null })).reverse(),
	total: messages.length, page: 1, per_page: 100
});
const THREAD_C1 = thread(
	{ id: 'm1', sender_id: 'p1', body: '教練好！想請問小明最近的狀況', created_at: '2026-07-05T09:10:00Z' },
	{ id: 'm2', sender_id: ME, body: '王媽媽好！小明這週進步很多', created_at: '2026-07-05T09:15:00Z' }
);
const THREAD_C2 = thread({ id: 'm3', sender_id: 'su3', body: '謝謝老師', created_at: '2026-07-04T10:00:00Z' });

/* 撰寫新對話 picker 名冊(GET /coaches/me/students)——陳爸爸 對應既有對話 c2 的 peer，
 * 供 get-or-create 合併情境使用。 */
const MY_STUDENTS = [
	{ user_id: 'su1', name: '王小明', phone: null, courses: [{ course_id: 'c1', course_name: '兒童體操初階班', enrolment_id: 'en1' }] },
	{ user_id: 'su2', name: '林小美', phone: null, courses: [{ course_id: 'c2', course_name: '幼兒體操啟蒙班', enrolment_id: 'en2' }] },
	{ user_id: 'su3', name: '陳爸爸', phone: null, courses: [{ course_id: 'c3', course_name: '成人體適能班', enrolment_id: 'en3' }] }
];

const threadPath = (id: string) => `GET /conversations/${id}/messages?per_page=100`;
const readPath = (id: string) => `PATCH /conversations/${id}/read`;

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter(
			{
				'GET /conversations/me': CONVOS,
				[threadPath('c1')]: THREAD_C1,
				[threadPath('c2')]: THREAD_C2,
				[threadPath('c9')]: thread(),
				[readPath('c1')]: { updated: 2 },
				[readPath('c2')]: { updated: 3 },
				[readPath('c9')]: { updated: 0 },
				'POST /conversations/c1/messages': { id: 'm9', sender_id: ME, body: '好的', created_at: '2026-07-05T09:20:00Z', read_at: null },
				'GET /coaches/me/students': MY_STUDENTS,
				'POST /conversations': { id: 'c9', last_message_at: null },
				...overrides
			},
			COACH_ROUTES
		)
	);

/** 是否送出過某個 "METHOD path" 請求(取代原本對 coach/api 函式的呼叫斷言)。 */
const called = (key: string) =>
	vi.mocked(api).mock.calls.some(([p, init]) => `${(init?.method ?? 'GET').toUpperCase()} ${p}` === key);
/** 某個 "METHOD path" 請求送出的 JSON body(第一次)。 */
const bodyOf = (key: string) => {
	const call = vi.mocked(api).mock.calls.find(([p, init]) => `${(init?.method ?? 'GET').toUpperCase()} ${p}` === key);
	return call ? JSON.parse(call[1]!.body as string) : undefined;
};

beforeEach(async () => {
	search.set('');
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(COACH_USER);
	route();
});

describe('/coach/messages — 清單（getConversations）', () => {
	it('渲染 getConversations() 回傳的對話，unread badge 用 unread_count 映射後的 badge', async () => {
		const { findByText, findAllByText } = render(MessagesPage);
		// c1(王媽媽)同時是預設選取的對話，名稱在列表列 + 對話串標頭 + 資訊面板皆出現。
		const matches = await findAllByText('王媽媽');
		expect(matches.length).toBeGreaterThanOrEqual(1);
		await findByText('陳爸爸'); // 非選取中的對話，只在列表列出現一次
		// c2(陳爸爸)非選取中，不會被 markRead 清零——badge=3 應顯示未讀數字徽章。
		// c1 選取中，開啟即 mark read 會把自己的 badge 清零(見下一個 describe)。
		await findByText('3');
	});

	it('沒有任何對話時顯示空狀態', async () => {
		route({ 'GET /conversations/me': [] });
		const { findAllByText } = render(MessagesPage);
		const matches = await findAllByText('沒有符合的對話');
		expect(matches.length).toBeGreaterThanOrEqual(1);
	});
});

describe('/coach/messages — 對話串（getThread）+ 開啟即已讀（markRead）', () => {
	it('預設選取第一筆對話並載入其對話串', async () => {
		const { findByText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況');
		await findByText('王媽媽好！小明這週進步很多');
		expect(called(threadPath('c1'))).toBe(true);
	});

	it('getConversations 飛行期間輸入搜尋字 → resolve 後選中的是過濾後清單首筆，被濾掉的第一筆不會被誤發 getThread/markRead(codex R4 P2 回歸)', async () => {
		let resolveConversations!: (v: typeof CONVOS) => void;
		const pending = new Promise<typeof CONVOS>((res) => {
			resolveConversations = res;
		});
		route({ 'GET /conversations/me': () => pending });

		render(MessagesPage); // gate 進入 loading，GET /conversations/me 已送出但尚未 resolve

		search.set('陳爸爸'); // 使用者在飛行期間輸入搜尋字——只匹配 c2(陳爸爸)，c1(王媽媽)會被濾掉

		resolveConversations(CONVOS);
		await new Promise((r) => setTimeout(r, 0)); // 讓 promise 微任務鏈與 Svelte reactivity flush 完整跑完

		await waitFor(() => expect(called(threadPath('c2'))).toBe(true));
		expect(called(readPath('c2'))).toBe(true);
		// 舊碼（onData 手動選未過濾的 d.conversations[0]）會在此處對被濾掉的 c1 誤發
		// getThread/markRead——c1 從未被使用者看見卻被永久標記已讀。
		expect(called(threadPath('c1'))).toBe(false);
		expect(called(readPath('c1'))).toBe(false);
	});

	it('開啟對話串即呼叫 markRead(id)', async () => {
		render(MessagesPage);
		await waitFor(() => expect(called(readPath('c1'))).toBe(true));
	});

	it('markRead 成功後，該對話在列表中的未讀徽章清零', async () => {
		route({ 'GET /conversations/me': [{ ...CONVOS[0], unread_count: 5 }, CONVOS[1]] });
		const { findByText, queryByText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況'); // 對話串載入完成
		await waitFor(() => expect(called(readPath('c1'))).toBe(true));
		await waitFor(() => expect(queryByText('5')).not.toBeInTheDocument());
	});

	it('切換選取的對話會重新載入該對話的串', async () => {
		const { findByText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況');

		await fireEvent.click(await findByText('陳爸爸'));

		await findByText('謝謝老師');
		expect(called(threadPath('c2'))).toBe(true);
		expect(called(readPath('c2'))).toBe(true);
	});

	it('對話尚無訊息時顯示「尚無訊息」空狀態', async () => {
		route({ [threadPath('c1')]: thread() });
		const { findByText } = render(MessagesPage);
		await findByText('尚無訊息');
	});

	it('getThread 失敗時顯示空狀態且不會卡在載入中', async () => {
		route({ [threadPath('c1')]: new Error('network') });
		const { findByText } = render(MessagesPage);
		await findByText('尚無訊息');
	});
});

describe('/coach/messages — 傳送（sendMessage）', () => {
	it('送出後 POST /conversations/{id}/messages { body } 並將回應附加到對話串+更新列表預覽', async () => {
		const { findByText, findAllByText, getByPlaceholderText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況');

		const input = getByPlaceholderText('輸入訊息…') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '好的' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => expect(bodyOf('POST /conversations/c1/messages')).toEqual({ body: '好的' }));
		// 泡泡 + 對話列表 preview 兩處都會顯示送出的文字。
		const matches = await findAllByText('好的');
		expect(matches.length).toBeGreaterThanOrEqual(1);
	});

	it('送出失敗時提示錯誤 toast（outcome→toast 映射；stale-guard 已搬至 messages-controller.test.ts，輸入框還原見下一條）', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		route({ 'POST /conversations/c1/messages': new ApiError(422, '訊息長度需介於 1 到 2000 字') });
		const { findByText, getByPlaceholderText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況');

		const input = getByPlaceholderText('輸入訊息…') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '好的' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '傳送失敗', '訊息長度需介於 1 到 2000 字');
		});
	});

	it('送出失敗時還原輸入框內容(reply 接線，避免使用者遺失已輸入文字)', async () => {
		route({ 'POST /conversations/c1/messages': new ApiError(422, '訊息長度需介於 1 到 2000 字') });
		const { findByText, getByPlaceholderText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況');

		const input = getByPlaceholderText('輸入訊息…') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '好的' } });
		await fireEvent.keyDown(input, { key: 'Enter' }); // MessageComposer 送出當下先清空 input

		await waitFor(() => expect(input.value).toBe('好的')); // 失敗後頁面把 reply 還原回原文字
	});
});

describe('/coach/messages — sharedFiles 區塊移除（v1 不支援檔案附件）', () => {
	it('不再渲染「共用檔案」區塊', async () => {
		const { findByText, queryByText } = render(MessagesPage);
		await findByText('陳爸爸');
		expect(queryByText('共用檔案')).not.toBeInTheDocument();
	});
});

describe('/coach/messages — SLA 死概念移除（R11 R1：真資料下 urgent/sla 恆空，恆空 UI 退役）', () => {
	it('不再渲染「緊急」分頁', async () => {
		const { findByText, queryByText } = render(MessagesPage);
		await findByText('陳爸爸');
		expect(queryByText('緊急')).not.toBeInTheDocument();
	});
});

describe('/coach/messages — 對話種類假欄位移除（R16 Task 2a：會員即學員本人，不分家長）', () => {
	it('不再渲染「家長」分頁與對話種類標籤；搜尋提示改為「搜尋學員」', async () => {
		const { findByText, queryByText, container } = render(MessagesPage);
		await findByText('陳爸爸');
		expect(queryByText('家長')).not.toBeInTheDocument();
		expect(queryByText('會員')).not.toBeInTheDocument();
		expect(queryByText('搜尋學員')).toBeInTheDocument();
		expect(container.textContent ?? '').not.toContain('搜尋家長');
	});
});

describe('/coach/messages (+page) — 撰寫新對話（getStudents 名冊 + POST /conversations）', () => {
	it('撰寫 opens a dialog listing 我的學員（getStudents 名冊，取代虛構 MSG_DIRECTORY）', async () => {
		const { findByText, getByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('王小明');
		// 「陳爸爸」同名對話已在左側清單(c2)，改以 picker 按鈕內獨有的課程副標(cls)
		// 斷言每位學員都列出。
		for (const s of MY_STUDENTS) expect(getByText(s.courses[0].course_name)).toBeInTheDocument();
		expect(called('GET /coaches/me/students')).toBe(true);
	});

	it('選擇學員+確認 → POST /conversations { user_id }；全新對話插入清單、選中並載入其對話串', async () => {
		const { findByText, getByText, getAllByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('王小明');
		await fireEvent.click(getByText('王小明'));
		await fireEvent.click(getByText('建立對話'));

		await waitFor(() => expect(bodyOf('POST /conversations')).toEqual({ user_id: 'su1' }));
		// 對話框關閉後，新對話出現在清單列 + 對話串標頭（至少兩處）。
		await waitFor(() => expect(getAllByText('王小明').length).toBeGreaterThanOrEqual(2));
		// 選中即載入其對話串並標記已讀（真實 id，非本地假對話）。
		await waitFor(() => expect(called(threadPath('c9'))).toBe(true));
		await waitFor(() => expect(called(readPath('c9'))).toBe(true));
	});

	it('get-or-create 回傳既有對話 id → 選中既有列，不重複插入', async () => {
		route({ 'POST /conversations': { id: 'c2', last_message_at: CONVOS[1].last_message_at } });
		const { findByText, getByText, getAllByText, findByLabelText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況'); // c1 初始載入完成
		await fireEvent.click(await findByLabelText('撰寫'));
		// 「陳爸爸」同時出現在左側清單列(c2)與 picker，改點 picker 按鈕內獨有的課程
		// 副標(cls)來選人——點副標會冒泡到整顆選人按鈕。
		await findByText('成人體適能班');
		await fireEvent.click(getByText('成人體適能班'));
		await fireEvent.click(getByText('建立對話'));

		await waitFor(() => expect(bodyOf('POST /conversations')).toEqual({ user_id: 'su3' }));
		await waitFor(() => expect(called(threadPath('c2'))).toBe(true));
		// 既有列被選中：清單列 1 + 對話串標頭 1 + 資訊面板 1 = 恰 3 處，重複插入會變 4。
		await waitFor(() => expect(getAllByText('陳爸爸')).toHaveLength(3));
	});

	it('建立對話失敗（422 角色驗證）→ 繁中 toast 直通 ApiError.message，對話框保持開啟', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		route({ 'POST /conversations': new ApiError(422, '僅支援教練與會員間的對話') });
		const { findByText, getByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('王小明');
		await fireEvent.click(getByText('王小明'));
		await fireEvent.click(getByText('建立對話'));

		await waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '建立對話失敗', '僅支援教練與會員間的對話');
		});
		// 失敗後對話框不關閉，使用者可改選他人。
		expect(getByText('選擇收件對象')).toBeInTheDocument();
	});

	it('stays visible even when a stale search term would have filtered it out', async () => {
		search.set('zzzz-no-match');
		const { findByText, getByText, getAllByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('王小明');
		await fireEvent.click(getByText('王小明'));
		await fireEvent.click(getByText('建立對話'));
		await waitFor(() => expect(getAllByText('王小明').length).toBeGreaterThanOrEqual(1));
		expect(() => getByText('沒有符合的對話')).toThrow();
	});

	it('學員名冊載入失敗 → 對話框顯示載入失敗提示', async () => {
		route({ 'GET /coaches/me/students': new Error('network') });
		const { findByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('無法載入學員名單，請關閉後重試。');
	});

	it('沒有任何學員 → 對話框顯示空狀態', async () => {
		route({ 'GET /coaches/me/students': [] });
		const { findByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('目前沒有學員可發起對話。');
	});
});

describe('/coach/messages — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		route({ 'GET /conversations/me': new Error('network') });
		const { findByText } = render(MessagesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		route({ 'GET /conversations/me': () => new Promise(() => {}) });
		const { getByTestId } = render(MessagesPage);
		expect(getByTestId('messages-skeleton')).toBeTruthy();
	});
});
