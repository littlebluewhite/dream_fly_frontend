import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import MessagesPage from './+page.svelte';
import { search, toasts } from '$lib/coach/stores';
import { getConversations, getThread, sendMessage, markRead, getStudents, createConversation } from '$lib/coach/api';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/coach/api', () => ({
	getConversations: vi.fn(),
	getThread: vi.fn(),
	sendMessage: vi.fn(),
	markRead: vi.fn(),
	getStudents: vi.fn(),
	createConversation: vi.fn()
}));

/* Task 12：訊息中心接真對話 API（§3.21）。
 * - 清單：getConversations()(GET /conversations/me)。
 * - 串：選定對話時 getThread(id)(GET /conversations/{id}/messages) + markRead(id)
 *   (PATCH .../read)，兩者各自 best-effort、互不阻塞。
 * - 傳送：sendMessage(id, body)(POST .../messages)，回應直接附加到本地串(同
 *   saveAttendance 用 mutation 回應同步本地狀態的慣例，非樂觀回顯、非整段重新 GET)。
 * - sharedFiles UI 區塊移除（v1 不支援檔案附件，契約依據）。
 * - 撰寫新對話：picker 名冊來自 getStudents()(GET /coaches/me/students，Task 10 已接真)，
 *   確認即 createConversation(user_id, name)(POST /conversations，get-or-create)——回傳
 *   既有對話 id 時選中既有列不重複插入；全新對話插入清單並選中。 */

const CONVOS = [
	{
		id: 'c1', name: '王媽媽', initial: '王', color: '#0066CC', kind: '會員',
		time: '09:42', badge: 2, preview: '老師您好，小明明天的課可以調整時間嗎？', sla: '', slaTone: 'muted' as const
	},
	{
		id: 'c2', name: '陳爸爸', initial: '陳', color: '#EC4899', kind: '會員',
		time: '昨天', badge: 3, preview: '謝謝老師這學期的細心指導！', sla: '', slaTone: 'muted' as const
	}
];

const THREAD_C1 = [
	{ who: 'them' as const, text: '教練好！想請問小明最近的狀況', time: '2026-07-05 09:10' },
	{ who: 'me' as const, text: '王媽媽好！小明這週進步很多', time: '2026-07-05 09:15' }
];

/* 撰寫新對話 picker 名冊(getStudents)——陳爸爸 對應既有對話 c2 的 peer，供 get-or-create
 * 合併情境使用。 */
const MY_STUDENTS = [
	{ user_id: 'su1', name: '王小明', initial: '王', color: '#0066CC', cls: '兒童體操初階班', courses: [{ course_id: 'c1', course_name: '兒童體操初階班', enrolment_id: 'en1' }], level: '初階' as const, skill: '', pct: 0, att: 0 },
	{ user_id: 'su2', name: '林小美', initial: '林', color: '#0066CC', cls: '幼兒體操啟蒙班', courses: [{ course_id: 'c2', course_name: '幼兒體操啟蒙班', enrolment_id: 'en2' }], level: '初階' as const, skill: '', pct: 0, att: 0 },
	{ user_id: 'su3', name: '陳爸爸', initial: '陳', color: '#0066CC', cls: '成人體適能班', courses: [{ course_id: 'c3', course_name: '成人體適能班', enrolment_id: 'en3' }], level: '初階' as const, skill: '', pct: 0, att: 0 }
];

const NEW_CONVO = {
	id: 'c9', name: '王小明', initial: '王', color: '#0066CC', kind: '會員',
	time: '', badge: 0, preview: '尚無訊息', sla: '', slaTone: 'muted' as const
};

beforeEach(() => {
	search.set('');
	vi.mocked(getConversations).mockReset();
	vi.mocked(getThread).mockReset();
	vi.mocked(sendMessage).mockReset();
	vi.mocked(markRead).mockReset();
	vi.mocked(getStudents).mockReset();
	vi.mocked(createConversation).mockReset();

	vi.mocked(getConversations).mockResolvedValue({ conversations: CONVOS });
	vi.mocked(getThread).mockResolvedValue({ messages: THREAD_C1, total: 2 });
	vi.mocked(markRead).mockResolvedValue({ updated: 2 });
	vi.mocked(sendMessage).mockResolvedValue({ who: 'me', text: '好的', time: '2026-07-05 09:20' });
	vi.mocked(getStudents).mockResolvedValue({ students: MY_STUDENTS });
	vi.mocked(createConversation).mockResolvedValue(NEW_CONVO);
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
		vi.mocked(getConversations).mockResolvedValue({ conversations: [] });
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
		expect(getThread).toHaveBeenCalledWith('c1');
	});

	it('開啟對話串即呼叫 markRead(id)', async () => {
		render(MessagesPage);
		await waitFor(() => expect(markRead).toHaveBeenCalledWith('c1'));
	});

	it('markRead 成功後，該對話在列表中的未讀徽章清零', async () => {
		vi.mocked(getConversations).mockResolvedValue({
			conversations: [{ ...CONVOS[0], badge: 5 }, CONVOS[1]]
		});
		const { findByText, queryByText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況'); // 對話串載入完成
		await waitFor(() => expect(markRead).toHaveBeenCalledWith('c1'));
		await waitFor(() => expect(queryByText('5')).not.toBeInTheDocument());
	});

	it('切換選取的對話會重新載入該對話的串', async () => {
		const { findByText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況');
		vi.mocked(getThread).mockResolvedValue({ messages: [{ who: 'them', text: '謝謝老師', time: '2026-07-04 10:00' }], total: 1 });

		await fireEvent.click(await findByText('陳爸爸'));

		await findByText('謝謝老師');
		expect(getThread).toHaveBeenCalledWith('c2');
		expect(markRead).toHaveBeenCalledWith('c2');
	});

	it('快速切換對話時，較舊對話延遲回來的回應不會覆蓋目前選取對話的訊息（避免顯示錯誤對話串）', async () => {
		let resolveC1: (v: { messages: typeof THREAD_C1; total: number }) => void;
		const c1Pending = new Promise<{ messages: typeof THREAD_C1; total: number }>((res) => { resolveC1 = res; });
		vi.mocked(getThread).mockReturnValueOnce(c1Pending);

		const { findByText, queryByText } = render(MessagesPage);
		// c1 的 getThread 尚未 resolve（thread 仍在載入中）。

		vi.mocked(getThread).mockResolvedValueOnce({
			messages: [{ who: 'them', text: '謝謝老師', time: '2026-07-04 10:00' }],
			total: 1
		});
		await fireEvent.click(await findByText('陳爸爸')); // 切到 c2，c2 的 getThread 立即 resolve
		await findByText('謝謝老師');

		// c1 的請求這時才慢慢回來——不應覆蓋目前已切到的 c2 對話串。
		resolveC1!({ messages: THREAD_C1, total: 2 });
		await new Promise((r) => setTimeout(r, 0)); // 讓 promise 微任務鏈與 Svelte reactivity flush 完整跑完

		expect(queryByText('教練好！想請問小明最近的狀況')).not.toBeInTheDocument();
		expect(await findByText('謝謝老師')).toBeInTheDocument();
	});

	it('對話尚無訊息時顯示「尚無訊息」空狀態', async () => {
		vi.mocked(getThread).mockResolvedValue({ messages: [], total: 0 });
		const { findByText } = render(MessagesPage);
		await findByText('尚無訊息');
	});

	it('getThread 失敗時顯示空狀態且不會卡在載入中', async () => {
		vi.mocked(getThread).mockRejectedValue(new Error('network'));
		const { findByText } = render(MessagesPage);
		await findByText('尚無訊息');
	});
});

describe('/coach/messages — 傳送（sendMessage）', () => {
	it('送出後呼叫 sendMessage(id, body) 並將回應附加到對話串+更新列表預覽', async () => {
		const { findByText, findAllByText, getByPlaceholderText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況');

		const input = getByPlaceholderText('輸入訊息…') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '好的' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(sendMessage).toHaveBeenCalledWith('c1', '好的');
		// 泡泡 + 對話列表 preview 兩處都會顯示送出的文字。
		const matches = await findAllByText('好的');
		expect(matches.length).toBeGreaterThanOrEqual(1);
	});

	it('送出失敗時還原輸入框內容並提示錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		vi.mocked(sendMessage).mockRejectedValue(new ApiError(422, '訊息長度需介於 1 到 2000 字'));
		const { findByText, getByPlaceholderText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況');

		const input = getByPlaceholderText('輸入訊息…') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '好的' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '傳送失敗', '訊息長度需介於 1 到 2000 字');
		});
		await waitFor(() => expect(input.value).toBe('好的'));
	});

	it('送出後若使用者已切到另一個對話，遲來的回應不會附加到目前的對話串（且不覆蓋新對話的輸入框）', async () => {
		let resolveSend: (v: { who: 'me'; text: string; time: string }) => void;
		const sendPending = new Promise<{ who: 'me'; text: string; time: string }>((res) => { resolveSend = res; });
		vi.mocked(sendMessage).mockReturnValueOnce(sendPending);

		const { findByText, getByPlaceholderText, queryAllByText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況');

		const input = getByPlaceholderText('輸入訊息…') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '好的' } });
		await fireEvent.keyDown(input, { key: 'Enter' }); // c1 送出中，尚未 resolve

		vi.mocked(getThread).mockResolvedValueOnce({
			messages: [{ who: 'them', text: '謝謝老師', time: '2026-07-04 10:00' }],
			total: 1
		});
		await fireEvent.click(await findByText('陳爸爸')); // 切到 c2
		await findByText('謝謝老師');

		// c1 的送出回應這時才回來——列表中 c1 的 preview 更新為「好的」是正確行為(那則
		// 訊息確實送達 c1)，但不應被附加成目前顯示中的 c2 對話串的訊息泡泡。
		resolveSend!({ who: 'me', text: '好的', time: '2026-07-05 09:20' });
		await new Promise((r) => setTimeout(r, 0)); // 讓 promise 微任務鏈與 Svelte reactivity flush 完整跑完

		expect(queryAllByText('好的')).toHaveLength(1); // 僅 c1 列表 preview，非目前對話串的泡泡
		expect(input.value).toBe(''); // c2 的輸入框不應被 c1 的失敗/成功回應影響
	});
});

describe('/coach/messages — sharedFiles 區塊移除（v1 不支援檔案附件）', () => {
	it('不再渲染「共用檔案」區塊', async () => {
		const { findByText, queryByText } = render(MessagesPage);
		await findByText('陳爸爸');
		expect(queryByText('共用檔案')).not.toBeInTheDocument();
	});
});

describe('/coach/messages (+page) — 撰寫新對話（getStudents 名冊 + POST /conversations）', () => {
	it('撰寫 opens a dialog listing 我的學員（getStudents 名冊，取代虛構 MSG_DIRECTORY）', async () => {
		const { findByText, getByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('王小明');
		// 「陳爸爸」同名對話已在左側清單(c2)，改以 picker 按鈕內獨有的課程副標(cls)
		// 斷言每位學員都列出。
		for (const s of MY_STUDENTS) expect(getByText(s.cls)).toBeInTheDocument();
		expect(getStudents).toHaveBeenCalled();
	});

	it('選擇學員+確認 → createConversation(user_id, name)；全新對話插入清單、選中並載入其對話串', async () => {
		vi.mocked(getThread).mockResolvedValue({ messages: [], total: 0 });
		const { findByText, getByText, getAllByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('王小明');
		await fireEvent.click(getByText('王小明'));
		await fireEvent.click(getByText('建立對話'));

		expect(createConversation).toHaveBeenCalledWith('su1', '王小明');
		// 對話框關閉後，新對話出現在清單列 + 對話串標頭（至少兩處）。
		await waitFor(() => expect(getAllByText('王小明').length).toBeGreaterThanOrEqual(2));
		// 選中即載入其對話串並標記已讀（真實 id，非本地假對話）。
		await waitFor(() => expect(getThread).toHaveBeenCalledWith('c9'));
		await waitFor(() => expect(markRead).toHaveBeenCalledWith('c9'));
	});

	it('get-or-create 回傳既有對話 id → 選中既有列，不重複插入', async () => {
		vi.mocked(createConversation).mockResolvedValue({
			id: 'c2', name: '陳爸爸', initial: '陳', color: '#0066CC', kind: '會員',
			time: '昨天', badge: 0, preview: '尚無訊息', sla: '', slaTone: 'muted'
		});
		const { findByText, getByText, getAllByText, findByLabelText } = render(MessagesPage);
		await findByText('教練好！想請問小明最近的狀況'); // c1 初始載入完成(預設 THREAD_C1 mock)
		// c1 載入完才把 getThread 換成 c2 的串——太早換會連初始 c1 的串一起換掉。
		vi.mocked(getThread).mockResolvedValue({ messages: [{ who: 'them', text: '謝謝老師', time: '2026-07-04 10:00' }], total: 1 });
		await fireEvent.click(await findByLabelText('撰寫'));
		// 「陳爸爸」同時出現在左側清單列(c2)與 picker，改點 picker 按鈕內獨有的課程
		// 副標(cls)來選人——點副標會冒泡到整顆選人按鈕。
		await findByText('成人體適能班');
		await fireEvent.click(getByText('成人體適能班'));
		await fireEvent.click(getByText('建立對話'));

		expect(createConversation).toHaveBeenCalledWith('su3', '陳爸爸');
		await waitFor(() => expect(getThread).toHaveBeenCalledWith('c2'));
		// 既有列被選中：清單列 1 + 對話串標頭 1 + 資訊面板 1 = 恰 3 處，重複插入會變 4。
		await waitFor(() => expect(getAllByText('陳爸爸')).toHaveLength(3));
	});

	it('建立對話失敗（422 角色驗證）→ 繁中 toast 直通 ApiError.message，對話框保持開啟', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		vi.mocked(createConversation).mockRejectedValue(new ApiError(422, '僅支援教練與會員間的對話'));
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
		vi.mocked(getStudents).mockRejectedValue(new Error('network'));
		const { findByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('無法載入學員名單，請關閉後重試。');
	});

	it('沒有任何學員 → 對話框顯示空狀態', async () => {
		vi.mocked(getStudents).mockResolvedValue({ students: [] });
		const { findByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await findByText('目前沒有學員可發起對話。');
	});
});

describe('/coach/messages — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getConversations).mockReset();
		vi.mocked(getConversations).mockRejectedValue(new Error('network'));
		const { findByText } = render(MessagesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getConversations).mockReset();
		vi.mocked(getConversations).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(MessagesPage);
		expect(getByTestId('messages-skeleton')).toBeTruthy();
	});
});
