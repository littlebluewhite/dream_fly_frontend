import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import MessagesPage from './+page.svelte';
import { MSG_DIRECTORY } from '$lib/coach/data';
import { search, toasts } from '$lib/coach/stores';
import { getConversations, getThread, sendMessage, markRead } from '$lib/coach/api';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/coach/api', () => ({
	getConversations: vi.fn(),
	getThread: vi.fn(),
	sendMessage: vi.fn(),
	markRead: vi.fn()
}));

/* Task 12：訊息中心接真對話 API（§3.21）。
 * - 清單：getConversations()(GET /conversations/me)。
 * - 串：選定對話時 getThread(id)(GET /conversations/{id}/messages) + markRead(id)
 *   (PATCH .../read)，兩者各自 best-effort、互不阻塞。
 * - 傳送：sendMessage(id, body)(POST .../messages)，回應直接附加到本地串(同
 *   saveAttendance 用 mutation 回應同步本地狀態的慣例，非樂觀回顯、非整段重新 GET)。
 * - sharedFiles UI 區塊移除（v1 不支援檔案附件，契約依據）。
 * - 撰寫新對話（MSG_DIRECTORY）維持既有前端本地示範行為，未串接 POST /conversations
 *   （不在本任務端點清單內）；新建立對話 id 固定 'new-' 前綴，選取時不會嘗試呼叫
 *   getThread/markRead（該對話在後端不存在）。 */

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

beforeEach(() => {
	search.set('');
	vi.mocked(getConversations).mockReset();
	vi.mocked(getThread).mockReset();
	vi.mocked(sendMessage).mockReset();
	vi.mocked(markRead).mockReset();

	vi.mocked(getConversations).mockResolvedValue({ conversations: CONVOS });
	vi.mocked(getThread).mockResolvedValue({ messages: THREAD_C1, total: 2 });
	vi.mocked(markRead).mockResolvedValue({ updated: 2 });
	vi.mocked(sendMessage).mockResolvedValue({ who: 'me', text: '好的', time: '2026-07-05 09:20' });
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

describe('/coach/messages (+page) — 撰寫（前端本地示範，未串接 POST /conversations）', () => {
	const REC = MSG_DIRECTORY[0]; // 張媽媽

	it('撰寫 opens a dialog listing the recipient directory', async () => {
		const { getByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		for (const r of MSG_DIRECTORY) expect(getByText(r.name)).toBeInTheDocument();
	});

	it('selecting a recipient + confirming adds the conversation and selects it (不呼叫 getThread/markRead)', async () => {
		const { getByText, getAllByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await fireEvent.click(getByText(REC.name));
		await fireEvent.click(getByText('建立對話'));
		expect(getAllByText(REC.name).length).toBeGreaterThanOrEqual(2);
		// 本地示範對話沒有真實後端 id，選取後不應嘗試呼叫 getThread/markRead。
		expect(getThread).not.toHaveBeenCalledWith(expect.stringMatching(/^new-/));
		expect(markRead).not.toHaveBeenCalledWith(expect.stringMatching(/^new-/));
	});

	it('stays visible even when a stale search term would have filtered it out', async () => {
		search.set('zzzz-no-match');
		const { getByText, getAllByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await fireEvent.click(getByText(REC.name));
		await fireEvent.click(getByText('建立對話'));
		expect(getAllByText(REC.name).length).toBeGreaterThanOrEqual(1);
		expect(() => getByText('沒有符合的對話')).toThrow();
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
