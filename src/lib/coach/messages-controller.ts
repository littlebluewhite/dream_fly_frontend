/* Dream Fly — coach/messages 訊息串編排層（Round 8 C1，自 +page.svelte 的訊息串編排
 * 抽出）。仿 attendance-controller 的「單一快照 store + 效應注入」分層、clock-controller
 * 的 outcome 形。
 *
 * 收斂範圍：對話串載入（selectThread，內部化 getThread + markRead 雙 best-effort fetch
 * 與 stale-guard）、傳送（send，回應同步 thread 的過期回應防護）、撰寫新對話三部曲
 * （openCompose/pickRecipient/confirmCompose，creating 守衛靜默，同 checkout-controller
 * 的 alreadyPaying 先例）。
 *
 * 不收：對話清單（convos）與其 gate（getConversations 留頁面）、tab×搜尋過濾與選取
 * 回退（conversations-filter.ts 純函式，留頁面呼叫）、toast 文案（頁面據 outcome 翻譯）。
 * badge 清零與傳送後的 convos 預覽/時間更新都作用在 convos（頁面狀態，非本 controller
 * 收編範圍）——故以 selectThread() 回傳的 badgeCleared promise 或頁面自行以呼叫當下
 * 捕捉的 id 交還頁面套用，而非由 controller 直接改寫 convos。
 *
 * selectThread 的 stale-guard 仿 attendance-controller 的 save-token guard：遞增序號
 * token，getThread 的 resolve/reject 皆驗 token===seq，不符即丟棄過期回應（不寫
 * thread）——避免快速切換對話時，較舊對話延遲回來的回應覆蓋目前選取對話的訊息。
 * markRead 的 badge 副作用不受此 guard 限制（逐字複刻頁面現行行為：badgeCleared 只看
 * markRead 本身成功與否，與目前是否還停留在該對話無關）。
 *
 * selectThread 回傳 threadReady/badgeCleared 兩條「各自獨立、互不等待」的 promise
 * （而非單一 outcome）——曾誤用 Promise.all 合併成一顆 outcome，導致 markRead 卡住/
 * 永不落定時連帶拖住 threadReady，使失敗 toast 或已載入狀態遲遲無法呈現、或 getThread
 * 卡住時連帶拖住徽章清零（codex 全輪審查 P2 回歸；本檔 messages-controller.test.ts 的
 * 「threadReady 與 badgeCleared 互不阻塞」一組測試即為此問題的可證偽回歸測試）。逐字
 * 複刻重構前頁面 getThread/markRead 兩條 promise chain 各自完成、互不阻塞的行為。
 *
 * send 的過期回應防護沿用頁面現行 `sel === conversationId` 快照比對（非 token 機制，
 * 與 selectThread 分開）：送出當下捕捉 conversationId，await 期間使用者可能已切到
 * 另一個對話，套用回應（附加到 thread）前重新檢查，避免遲來的回應附加到「現在正在看」
 * 的另一個對話串。
 *
 * 無 svelte 元件相依、建構零副作用（SSR 安全）。 */
import { writable, type Readable } from 'svelte/store';
import type { Conversation, Student, ThreadMsg } from '$lib/coach/data';
import type { ThreadData, StudentsData } from '$lib/coach/api';

export interface MessagesViewState {
	sel: string | null;
	/** null = 該對話串載入中；[] = 已載入但尚無訊息（或載入失敗）。兩者分開渲染避免
	 *  誤判空狀態，逐字複刻頁面現行語意。 */
	thread: ThreadMsg[] | null;
	composeOpen: boolean;
	composePhase: 'loading' | 'error' | 'ready';
	recipients: Student[];
	composePick: Student | null;
	creating: boolean;
}

export interface MessagesControllerDeps {
	/** 簽名對齊 coach/api.ts 的 getThread（GET /conversations/{id}/messages）。 */
	getThread: (conversationId: string) => Promise<ThreadData>;
	/** 簽名對齊 coach/api.ts 的 markRead（PATCH /conversations/{id}/read）。 */
	markRead: (conversationId: string) => Promise<{ updated: number }>;
	/** 簽名對齊 coach/api.ts 的 sendMessage（POST /conversations/{id}/messages）。 */
	sendMessage: (conversationId: string, body: string) => Promise<ThreadMsg>;
	/** 簽名對齊 coach/api.ts 的 getStudents（GET /coaches/me/students）。 */
	getStudents: () => Promise<StudentsData>;
	/** 簽名對齊 coach/api.ts 的 createConversation（POST /conversations，get-or-create）。 */
	createConversation: (userId: string, peerName: string) => Promise<Conversation>;
}

/** stale 只描述 getThread 這支回應是否過期被丟棄（thread 未變動）——與 markRead 的
 *  badgeCleared（見 SelectThreadHandles）完全無關，兩者是彼此獨立落定的兩條通道。 */
export type SelectThreadOutcome =
	| { kind: 'threadLoaded' }
	| { kind: 'threadLoadFailed' }
	| { kind: 'stale' };

/** selectThread() 的回傳形：threadReady 決定 thread 顯示/失敗 toast 的時機，badgeCleared
 *  （markRead(id) 是否成功）決定 convos 中該對話 badge 是否清零（convos 非 controller
 *  狀態，清零動作留頁面套用）——兩者刻意分成兩條 promise、不用 Promise.all 合併，任一方
 *  卡住或永不落定都不影響另一方落定（見檔頭 P2 回歸修復附註）。badgeCleared 不受
 *  stale-guard 限制，逐字複刻頁面現行 markRead handler 不檢查 sel 的行為。 */
export interface SelectThreadHandles {
	threadReady: Promise<SelectThreadOutcome>;
	badgeCleared: Promise<boolean>;
}

/** sendFailed 攜 text（原輸入內容）供頁面還原輸入框——是否真的還原、convos 預覽是否
 *  更新，皆由頁面比對呼叫當下捕捉的 conversationId 與現在的 sel 決定（同 loadThread
 *  的過期回應防護慣例，見檔頭）。 */
export type SendOutcome =
	| { kind: 'messageSent'; msg: ThreadMsg }
	| { kind: 'sendFailed'; error: unknown; text: string };

/** alreadyCreating：creating 守衛（含「尚未選取收件人」）靜默不做事，同
 *  checkout-controller 的 alreadyPaying 先例。conversationCreated 攜原始
 *  Conversation——插入/選取邏輯（applyCreatedConversation）留頁面自行呼叫（convos 非
 *  controller 狀態）。 */
export type ConfirmComposeOutcome =
	| { kind: 'conversationCreated'; conversation: Conversation }
	| { kind: 'createFailed'; error: unknown }
	| { kind: 'alreadyCreating' };

export interface MessagesController extends Readable<MessagesViewState> {
	selectThread(id: string): SelectThreadHandles;
	send(text: string): Promise<SendOutcome>;
	openCompose(): void;
	/** 取消/關閉撰寫對話框（Dialog 的 onClose、遮罩點擊、Esc、「取消」次要按鈕共用）——
	 *  composeOpen 已移入 controller 狀態後，頁面不能再直接對它賦值（賦值只會改到頁面
	 *  destructure 出的鏡射變數，下一次 controller publish 就會被蓋回 true）。不動
	 *  composePick，逐字複刻頁面現行行為（下次 openCompose() 自然重置）。 */
	closeCompose(): void;
	pickRecipient(r: Student): void;
	confirmCompose(): Promise<ConfirmComposeOutcome>;
}

export function createMessagesController(deps: MessagesControllerDeps): MessagesController {
	let sel: string | null = null;
	let thread: ThreadMsg[] | null = null;
	let composeOpen = false;
	let composePhase: 'loading' | 'error' | 'ready' = 'loading';
	let recipients: Student[] = [];
	let composePick: Student | null = null;
	let creating = false;
	// selectThread 的 save-token guard（仿 attendance-controller）：遞增序號，getThread
	// 的 resolve/reject 皆驗 token===seq，不符即丟棄過期回應。
	let seq = 0;

	function viewState(): MessagesViewState {
		return { sel, thread, composeOpen, composePhase, recipients, composePick, creating };
	}
	const store = writable<MessagesViewState>(viewState());
	const publish = (): void => store.set(viewState());

	function selectThread(id: string): SelectThreadHandles {
		sel = id;
		thread = null;
		publish();
		const token = ++seq;

		// threadReady：不 await、不與 badgeCleared 用 Promise.all 合併——markRead 卡住
		// 或永不落定都不能拖住這裡的落定（見檔頭 P2 回歸修復附註）。
		const threadReady: Promise<SelectThreadOutcome> = deps.getThread(id).then(
			(d) => {
				if (token !== seq) return { kind: 'stale' };
				thread = d.messages;
				publish();
				return { kind: 'threadLoaded' };
			},
			() => {
				if (token !== seq) return { kind: 'stale' };
				thread = [];
				publish();
				return { kind: 'threadLoadFailed' };
			}
		);
		// best-effort：已讀標記失敗不影響訊息顯示（同 auth logout 的 fire-and-forget
		// revoke 慣例）——不檢查 token，逐字複刻頁面現行 markRead handler 行為；也不與
		// threadReady 互相等待，getThread 卡住不能拖住這裡的落定。
		const badgeCleared: Promise<boolean> = deps.markRead(id).then(
			() => true,
			() => false
		);

		return { threadReady, badgeCleared };
	}

	/** conversationId 在送出當下（呼叫瞬間的 sel）被捕捉為區域變數；await 期間使用者
	 *  可能已切到另一個對話（sel 改變）——套用回應（附加到 thread）前以
	 *  `sel === conversationId` 重新檢查，避免遲來的回應附加到「現在正在看」的另一個
	 *  對話串。sel 若在呼叫當下即為 null（結構上不可達——composer 只在有選取對話時
	 *  渲染），以 sendFailed 靜默失敗，不呼叫 deps.sendMessage。 */
	async function send(text: string): Promise<SendOutcome> {
		const conversationId = sel;
		if (!conversationId) return { kind: 'sendFailed', error: new Error('尚未選取對話'), text };
		try {
			const msg = await deps.sendMessage(conversationId, text);
			if (sel === conversationId) {
				thread = [...(thread ?? []), msg];
				publish();
			}
			return { kind: 'messageSent', msg };
		} catch (error) {
			return { kind: 'sendFailed', error, text };
		}
	}

	/** 每次開啟都重新拉 getStudents() 名冊——失敗後關閉重開即重試，不需要另外的重試
	 *  按鈕。逐字複刻頁面現行行為：無 stale-guard（並非遺漏，是原行為本就沒有）。 */
	function openCompose(): void {
		composePick = null;
		composeOpen = true;
		composePhase = 'loading';
		publish();
		deps
			.getStudents()
			.then((d) => {
				recipients = d.students;
				composePhase = 'ready';
				publish();
			})
			.catch(() => {
				composePhase = 'error';
				publish();
			});
	}

	function closeCompose(): void {
		composeOpen = false;
		publish();
	}

	function pickRecipient(r: Student): void {
		composePick = r;
		publish();
	}

	/** POST /conversations（get-or-create）。composePick 為空或 creating 中皆靜默返回
	 *  alreadyCreating（逐字複刻頁面現行 `if (!composePick || creating) return;` 合併
	 *  守衛）。插入/選取指令邏輯（applyCreatedConversation）留頁面自行呼叫成功時
	 *  返回的 conversation（convos 非 controller 狀態）。失敗時 composeOpen/composePick
	 *  維持不變，供使用者改選。 */
	async function confirmCompose(): Promise<ConfirmComposeOutcome> {
		if (!composePick || creating) return { kind: 'alreadyCreating' };
		const r = composePick;
		creating = true;
		publish();
		try {
			const conversation = await deps.createConversation(r.user_id, r.name);
			composeOpen = false;
			composePick = null;
			return { kind: 'conversationCreated', conversation };
		} catch (error) {
			return { kind: 'createFailed', error };
		} finally {
			creating = false;
			publish();
		}
	}

	return { subscribe: store.subscribe, selectThread, send, openCompose, closeCompose, pickRecipient, confirmCompose };
}
