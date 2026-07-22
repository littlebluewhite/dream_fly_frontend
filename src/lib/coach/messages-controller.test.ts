import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createMessagesController, type MessagesController } from './messages-controller';
import type { Conversation, Student, ThreadMsg } from './data';
import type { ThreadData, StudentsData } from './api';

/* messages-controller.ts — coach/messages 訊息串編排層的單元測試(Round 8 C1)。自
 * routes/coach/messages/page.test.ts 搬出的無渲染測試:selectThread 的雙 best-effort
 * fetch(getThread+markRead)與 stale-guard、send 的樂觀附加與過期回應防護(雙 stale
 * 情境)、openCompose/pickRecipient/confirmCompose 的撰寫新對話三部曲(creating 守衛
 * 靜默)。convos 清單狀態、tab×搜尋過濾、toast 文案非本 controller 收編範圍,不在此
 * 測試(見 routes/coach/messages/page.test.ts)。
 *
 * selectThread() 回傳 { threadReady, badgeCleared } 兩條互不等待的 promise(非單一
 * outcome)——一度誤用 Promise.all 合併，導致任一方卡住/永不落定會拖住另一方(codex
 * 全輪審查 P2 回歸)。「threadReady 與 badgeCleared 互不阻塞」一組測試即為可證偽回歸
 * 測試：一方 mock 成永不 resolve/reject，斷言另一方仍立即落定。 */

const STUDENT_1: Student = {
	user_id: 'su1', name: '王小明', initial: '王', color: '#0066CC', cls: '兒童體操初階班',
	courses: [{ course_id: 'c1', course_name: '兒童體操初階班', enrolment_id: 'en1' }],
	level: '初階', skill: '', pct: 0, att: 0
};
const STUDENT_2: Student = {
	user_id: 'su2', name: '林小美', initial: '林', color: '#0066CC', cls: '幼兒體操啟蒙班',
	courses: [{ course_id: 'c2', course_name: '幼兒體操啟蒙班', enrolment_id: 'en2' }],
	level: '啟蒙', skill: '', pct: 0, att: 0
};

const THREAD_C1: ThreadMsg[] = [
	{ who: 'them', text: '教練好！想請問小明最近的狀況', time: '2026-07-05 09:10' },
	{ who: 'me', text: '王媽媽好！小明這週進步很多', time: '2026-07-05 09:15' }
];
const THREAD_C2: ThreadMsg[] = [{ who: 'them', text: '謝謝老師', time: '2026-07-04 10:00' }];

const NEW_CONVO: Conversation = {
	id: 'c9', name: '王小明', initial: '王', color: '#0066CC', kind: '會員',
	time: '', badge: 0, preview: '尚無訊息', sla: '', slaTone: 'muted'
};

/** 手動控制 resolve/reject 時序的 promise,用於驗 await 前/後的快照語意(同
 *  attendance-controller.test.ts 慣例)。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function makeDeps() {
	return {
		getThread: vi.fn<(conversationId: string) => Promise<ThreadData>>(),
		markRead: vi.fn<(conversationId: string) => Promise<{ updated: number }>>(),
		sendMessage: vi.fn<(conversationId: string, body: string) => Promise<ThreadMsg>>(),
		getStudents: vi.fn<() => Promise<StudentsData>>(),
		createConversation: vi.fn<(userId: string, peerName: string) => Promise<Conversation>>()
	};
}

let deps: ReturnType<typeof makeDeps>;
let ctrl: MessagesController;

beforeEach(() => {
	deps = makeDeps();
	ctrl = createMessagesController(deps);
});

describe('createMessagesController — 建構', () => {
	it('建構零副作用:初始快照全為空白狀態,未呼叫任何 dep(SSR 安全)', () => {
		const view = get(ctrl);
		expect(view).toEqual({
			sel: null, thread: null, composeOpen: false, composePhase: 'loading',
			recipients: [], composePick: null, creating: false
		});
		expect(deps.getThread).not.toHaveBeenCalled();
		expect(deps.markRead).not.toHaveBeenCalled();
		expect(deps.sendMessage).not.toHaveBeenCalled();
		expect(deps.getStudents).not.toHaveBeenCalled();
		expect(deps.createConversation).not.toHaveBeenCalled();
	});
});

describe('selectThread — 基本載入 + markRead badge 副作用', () => {
	it('成功:呼叫 getThread(id)+markRead(id),thread 設為回應訊息,badgeCleared true', async () => {
		deps.getThread.mockResolvedValue({ messages: THREAD_C1, total: 2 });
		deps.markRead.mockResolvedValue({ updated: 2 });

		const { threadReady, badgeCleared } = ctrl.selectThread('c1');
		const outcome = await threadReady;
		const cleared = await badgeCleared;

		expect(deps.getThread).toHaveBeenCalledWith('c1');
		expect(deps.markRead).toHaveBeenCalledWith('c1');
		expect(outcome).toEqual({ kind: 'threadLoaded' });
		expect(cleared).toBe(true);
		expect(get(ctrl).thread).toEqual(THREAD_C1);
		expect(get(ctrl).sel).toBe('c1');
	});

	it('選取後、getThread resolve 前,thread 先進入載入中(null)', () => {
		deps.getThread.mockReturnValue(new Promise(() => {})); // 永不 resolve
		deps.markRead.mockReturnValue(new Promise(() => {}));

		ctrl.selectThread('c1');

		expect(get(ctrl).thread).toBeNull();
		expect(get(ctrl).sel).toBe('c1');
	});

	it('對話尚無訊息:getThread 回傳空陣列 → thread=[],threadLoaded', async () => {
		deps.getThread.mockResolvedValue({ messages: [], total: 0 });
		deps.markRead.mockResolvedValue({ updated: 0 });

		const { threadReady } = ctrl.selectThread('c1');
		const outcome = await threadReady;

		expect(outcome.kind).toBe('threadLoaded');
		expect(get(ctrl).thread).toEqual([]);
	});

	it('getThread 失敗:thread=[](同「尚無訊息」空狀態的資料形),threadLoadFailed', async () => {
		deps.getThread.mockRejectedValue(new Error('network'));
		deps.markRead.mockResolvedValue({ updated: 1 });

		const { threadReady, badgeCleared } = ctrl.selectThread('c1');
		const outcome = await threadReady;
		const cleared = await badgeCleared;

		expect(outcome).toEqual({ kind: 'threadLoadFailed' });
		expect(cleared).toBe(true);
		expect(get(ctrl).thread).toEqual([]);
	});

	it('markRead 失敗不影響 thread 顯示(best-effort):badgeCleared false,thread 仍正常載入', async () => {
		deps.getThread.mockResolvedValue({ messages: THREAD_C1, total: 2 });
		deps.markRead.mockRejectedValue(new Error('network'));

		const { threadReady, badgeCleared } = ctrl.selectThread('c1');
		const outcome = await threadReady;
		const cleared = await badgeCleared;

		expect(outcome).toEqual({ kind: 'threadLoaded' });
		expect(cleared).toBe(false);
		expect(get(ctrl).thread).toEqual(THREAD_C1);
	});
});

describe('selectThread — threadReady 與 badgeCleared 互不阻塞(codex 全輪審查 P2 回歸修復)', () => {
	// 重構前 getThread/markRead 是兩條完全獨立的 promise chain，互不等待——一度誤用
	// Promise.all 合併成單一 outcome，導致 markRead 卡住/永不落定時連帶拖住 threadReady
	// （進而拖住失敗 toast 或已載入狀態的呈現），或反過來 getThread 卡住拖住徽章清零。
	// 以下驗證兩者確實互相獨立：一方永不落定不會拖住另一方——若退回 Promise.all 版本，
	// 以下測試會逾時掛住（vitest 預設測試逾時會讓該筆測試失敗，而非無限期卡住整個
	// process）。

	it('markRead 永不落定時,getThread 成功仍讓 threadReady 立即以 threadLoaded 落定', async () => {
		deps.getThread.mockResolvedValue({ messages: THREAD_C1, total: 2 });
		deps.markRead.mockReturnValue(new Promise(() => {})); // 永不 resolve/reject

		const { threadReady } = ctrl.selectThread('c1');
		const outcome = await threadReady;

		expect(outcome).toEqual({ kind: 'threadLoaded' });
		expect(get(ctrl).thread).toEqual(THREAD_C1);
	});

	it('markRead 永不落定時,getThread 失敗仍讓 threadReady 立即以 threadLoadFailed 落定(失敗 toast 路徑可達)', async () => {
		deps.getThread.mockRejectedValue(new Error('network'));
		deps.markRead.mockReturnValue(new Promise(() => {}));

		const { threadReady } = ctrl.selectThread('c1');
		const outcome = await threadReady;

		expect(outcome).toEqual({ kind: 'threadLoadFailed' });
		expect(get(ctrl).thread).toEqual([]);
	});

	it('getThread 永不落定時,markRead 成功仍讓 badgeCleared 立即落定為 true', async () => {
		deps.getThread.mockReturnValue(new Promise(() => {})); // 永不 resolve
		deps.markRead.mockResolvedValue({ updated: 1 });

		const { badgeCleared } = ctrl.selectThread('c1');
		const cleared = await badgeCleared;

		expect(cleared).toBe(true);
		expect(get(ctrl).thread).toBeNull(); // getThread 仍在飛,thread 維持載入中,未被拖累
	});
});

describe('selectThread — stale-guard(雙 stale 情境之一：快速切換對話)', () => {
	it('較舊對話延遲回來的 getThread 回應不覆蓋目前選取對話的 thread', async () => {
		const c1 = deferred<ThreadData>();
		deps.getThread.mockReturnValueOnce(c1.promise);
		deps.markRead.mockResolvedValue({ updated: 0 });

		const c1Handles = ctrl.selectThread('c1'); // c1 getThread 尚未 resolve

		deps.getThread.mockResolvedValueOnce({ messages: THREAD_C2, total: 1 });
		const outcome2 = await ctrl.selectThread('c2').threadReady; // c2 立即 resolve

		expect(outcome2).toEqual({ kind: 'threadLoaded' });
		expect(get(ctrl).thread).toEqual(THREAD_C2);

		c1.resolve({ messages: THREAD_C1, total: 2 }); // c1 的舊回應這時才回來
		const outcome1 = await c1Handles.threadReady;

		expect(outcome1).toEqual({ kind: 'stale' });
		expect(get(ctrl).thread).toEqual(THREAD_C2); // 未被 c1 的過期回應覆蓋
		expect(get(ctrl).sel).toBe('c2');
	});

	it('較舊對話失敗的 getThread 回應也不覆蓋(stale,非 threadLoadFailed)', async () => {
		const c1 = deferred<ThreadData>();
		deps.getThread.mockReturnValueOnce(c1.promise);
		deps.markRead.mockResolvedValue({ updated: 0 });

		const c1Handles = ctrl.selectThread('c1');
		deps.getThread.mockResolvedValueOnce({ messages: THREAD_C2, total: 1 });
		await ctrl.selectThread('c2').threadReady;

		c1.reject(new Error('network'));
		const outcome1 = await c1Handles.threadReady;

		expect(outcome1).toEqual({ kind: 'stale' });
		expect(get(ctrl).thread).toEqual(THREAD_C2); // 未被打成 []
	});
});

describe('send — 樂觀附加(回應同步 thread)', () => {
	beforeEach(async () => {
		deps.getThread.mockResolvedValue({ messages: THREAD_C1, total: 2 });
		deps.markRead.mockResolvedValue({ updated: 0 });
		await ctrl.selectThread('c1').threadReady;
	});

	it('成功:呼叫 sendMessage(id, text),回應附加到 thread 尾端', async () => {
		const msg: ThreadMsg = { who: 'me', text: '好的', time: '2026-07-05 09:20' };
		deps.sendMessage.mockResolvedValue(msg);

		const outcome = await ctrl.send('好的');

		expect(deps.sendMessage).toHaveBeenCalledWith('c1', '好的');
		expect(outcome).toEqual({ kind: 'messageSent', msg });
		expect(get(ctrl).thread).toEqual([...THREAD_C1, msg]);
	});

	it('失敗:{kind:sendFailed,error,text},thread 不變(不附加)', async () => {
		const err = new Error('連線失敗');
		deps.sendMessage.mockRejectedValue(err);

		const outcome = await ctrl.send('好的');

		expect(outcome).toEqual({ kind: 'sendFailed', error: err, text: '好的' });
		expect(get(ctrl).thread).toEqual(THREAD_C1);
	});
});

describe('send — 過期回應防護(雙 stale 情境之二：送出中途切換對話)', () => {
	it('送出後若已切到另一個對話,遲來的回應不附加到目前的 thread(但仍回報 messageSent)', async () => {
		deps.getThread.mockResolvedValue({ messages: THREAD_C1, total: 2 });
		deps.markRead.mockResolvedValue({ updated: 0 });
		await ctrl.selectThread('c1').threadReady;

		const sendPending = deferred<ThreadMsg>();
		deps.sendMessage.mockReturnValueOnce(sendPending.promise);
		const sendP = ctrl.send('好的'); // c1 送出中,尚未 resolve

		deps.getThread.mockResolvedValueOnce({ messages: THREAD_C2, total: 1 });
		await ctrl.selectThread('c2').threadReady; // 切到 c2
		expect(get(ctrl).thread).toEqual(THREAD_C2);

		sendPending.resolve({ who: 'me', text: '好的', time: '2026-07-05 09:20' }); // c1 的送出回應這時才回來
		const outcome = await sendP;

		// 訊息確實送達 c1(頁面據此仍更新 convos 該筆 preview,見 page.test.ts)——但不應
		// 附加成目前顯示中的 c2 對話串的訊息泡泡。
		expect(outcome.kind).toBe('messageSent');
		expect(get(ctrl).thread).toEqual(THREAD_C2); // 未被 c1 的遲來回應附加
		expect(get(ctrl).sel).toBe('c2');
	});
});

describe('send — 尚未選取對話(結構上不可達,型別層防護)', () => {
	it('sel 為初始 null 時呼叫 send 直接回傳 sendFailed,不呼叫 deps.sendMessage', async () => {
		const outcome = await ctrl.send('哈囉');

		expect(outcome.kind).toBe('sendFailed');
		if (outcome.kind === 'sendFailed') expect(outcome.text).toBe('哈囉');
		expect(deps.sendMessage).not.toHaveBeenCalled();
	});
});

describe('openCompose / pickRecipient', () => {
	it('openCompose 立即重置 composePick 並開啟 dialog(loading),成功後 recipients/ready', async () => {
		deps.getStudents.mockResolvedValue({ students: [STUDENT_1, STUDENT_2] });

		ctrl.openCompose();

		expect(get(ctrl).composeOpen).toBe(true);
		expect(get(ctrl).composePhase).toBe('loading');
		expect(get(ctrl).composePick).toBeNull();

		await new Promise((r) => setTimeout(r, 0)); // 讓 getStudents 的 .then 鏈跑完

		expect(get(ctrl).composePhase).toBe('ready');
		expect(get(ctrl).recipients).toEqual([STUDENT_1, STUDENT_2]);
	});

	it('openCompose 失敗 → composePhase error', async () => {
		deps.getStudents.mockRejectedValue(new Error('network'));

		ctrl.openCompose();
		await new Promise((r) => setTimeout(r, 0));

		expect(get(ctrl).composePhase).toBe('error');
	});

	it('pickRecipient 設定 composePick', () => {
		ctrl.pickRecipient(STUDENT_1);
		expect(get(ctrl).composePick).toEqual(STUDENT_1);
	});

	it('重新開啟會重置先前的 composePick(每次開啟都是新的一輪選人)', () => {
		ctrl.pickRecipient(STUDENT_1);
		deps.getStudents.mockReturnValue(new Promise(() => {}));

		ctrl.openCompose();

		expect(get(ctrl).composePick).toBeNull();
	});

	it('closeCompose 關閉對話框但不動 composePick(Dialog 的 onClose/取消/Esc 共用)', () => {
		deps.getStudents.mockReturnValue(new Promise(() => {}));
		ctrl.openCompose();
		ctrl.pickRecipient(STUDENT_1);

		ctrl.closeCompose();

		expect(get(ctrl).composeOpen).toBe(false);
		expect(get(ctrl).composePick).toEqual(STUDENT_1); // 下次 openCompose() 才重置
	});
});

describe('confirmCompose — creating 守衛(靜默,同 checkout-controller alreadyPaying 先例)', () => {
	it('尚未選取收件人 → alreadyCreating,不呼叫 createConversation', async () => {
		const outcome = await ctrl.confirmCompose();

		expect(outcome).toEqual({ kind: 'alreadyCreating' });
		expect(deps.createConversation).not.toHaveBeenCalled();
	});

	it('已在建立中的重複呼叫 → alreadyCreating,createConversation 只呼叫一次', async () => {
		ctrl.pickRecipient(STUDENT_1);
		const pending = deferred<Conversation>();
		deps.createConversation.mockReturnValueOnce(pending.promise);

		const p1 = ctrl.confirmCompose(); // creating=true,in-flight
		const outcome2 = await ctrl.confirmCompose(); // 重複呼叫(例如連點兩下確認鈕)

		expect(outcome2).toEqual({ kind: 'alreadyCreating' });
		expect(deps.createConversation).toHaveBeenCalledTimes(1);

		pending.resolve(NEW_CONVO);
		await p1;
	});
});

describe('confirmCompose — 成功 / 失敗', () => {
	it('成功:createConversation(user_id, name),回傳 conversationCreated,composeOpen/composePick 重置', async () => {
		deps.getStudents.mockReturnValue(new Promise(() => {})); // 本測試不關心名冊載入
		ctrl.openCompose();
		ctrl.pickRecipient(STUDENT_1);
		deps.createConversation.mockResolvedValue(NEW_CONVO);

		const outcome = await ctrl.confirmCompose();

		expect(deps.createConversation).toHaveBeenCalledWith('su1', '王小明');
		expect(outcome).toEqual({ kind: 'conversationCreated', conversation: NEW_CONVO });
		expect(get(ctrl).composeOpen).toBe(false);
		expect(get(ctrl).composePick).toBeNull();
		expect(get(ctrl).creating).toBe(false);
	});

	it('失敗:回傳 createFailed 攜原始 error,composeOpen/composePick 維持不變供改選', async () => {
		deps.getStudents.mockReturnValue(new Promise(() => {})); // 本測試不關心名冊載入
		ctrl.openCompose();
		ctrl.pickRecipient(STUDENT_1);
		const err = new Error('僅支援教練與會員間的對話');
		deps.createConversation.mockRejectedValue(err);

		const outcome = await ctrl.confirmCompose();

		expect(outcome).toEqual({ kind: 'createFailed', error: err });
		expect(get(ctrl).composeOpen).toBe(true);
		expect(get(ctrl).composePick).toEqual(STUDENT_1);
		expect(get(ctrl).creating).toBe(false); // finally 重置,允許重試
	});
});
