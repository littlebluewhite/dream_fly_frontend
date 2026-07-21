/**
 * session-gate — authStore 身分變更感知的 domain-store 水合閘門家族(架構深化 R7 C1)。
 *
 * 收斂六個 member/mobile domain store 對「session 身分變更」的非同構處理:waitlist/
 * leave 手抄了完整的 epoch/身分重置/序列化和解鏈骨架(位元組級雙生);notifications/
 * mobile-notifs 的 hydrated 旗標跨帳號存活(真缺陷:SPA 登出無整頁重載,B 帳號被
 * guarded() 短路、直接讀到 A 的資料);points/subscriptions 全無守衛。本模組把前二
 * 「吸收」成單源、把後四「抬升」到同一套守衛之下,提供三門工廠:
 *   - createSessionGate     完整 session gate(gate + 身分重置 + 序列化可重試和解鏈
 *                           + epoch 核對 fetch)—— waitlist / leave / member notifications
 *   - createSessionRefresher session refresher(保留無條件重抓語意,只加身分清空 +
 *                           在飛寫回 epoch 作廢;不套 guard)—— points / subscriptions
 *   - onSessionReset        外部旗標重置(gate 所有權留呼叫端)—— mobile notifs
 *
 * 座落位置:authStore 與 domain store 之間。刻意**不**深化 hydration-gate——後者被
 * ~49 頁全 surface 的 load-gate 消費(含 staff 面,其 identity 源非 member authStore),
 * 若把 member auth 維度打進那顆 core,等於把錯向依賴灌進 repo 最寬的 seam;且
 * hydration-gate 的檔頭憲章(零模組級副作用、零 store import、SSR-safe 葉)是 ADR 0016
 * 剛批的。session-gate 則明確依賴 authStore,但仍守零 import-time 副作用:authStore
 * .subscribe() 發生在 factory **被呼叫**時(call site 在各 store 模組頂層 = 現行
 * waitlist/leave 同位置),不是本模組 import 時——SSR 姿勢與現況一致。
 *
 * 每次 factory call 一個獨立的 authStore 訂閱(共六個模組級永生訂閱,與現狀同類),
 * 無共享 registry:registry 會違反零副作用憲章、需要新的 registry-reset 測試接縫,
 * 且 epoch 只與自身比較、無跨模組消費者(見 ADR 0016 定案 3)。
 */
import { get } from 'svelte/store';
import { authStore } from '$lib/stores/authStore';
import { createHydrationGate, type HydrationGate } from '$lib/hydration-gate';

/**
 * 私有 identity core:每次 factory call 建一個 authStore 訂閱,把「身分是否變更」
 * 這唯一決策收成一處。
 *
 * baseline 從 null 起 —— restored session 開機時 subscribe 的立即回呼會以「已登入」
 * 身分觸發一次 onChange(與現行 waitlist/leave 的模組級訂閱行為逐字相同);訪客開機
 * 身分為 null == baseline,零觸發。identity key = loggedIn ? (member?.id ?? '') : null
 * (現行慣例逐字:未登入為 null,登入但無 member.id 退化為空字串)。
 *
 * 回傳 epoch():單調遞增的 session 世代,身分每變一次 +1;fetch/mutate 出發時捕捉、
 * 落地前比對——跨登出/換帳號的在飛回應即以此作廢。
 */
function createSessionCore(onChange: () => void): { epoch: () => number } {
	let sessionEpoch = 0;
	let lastIdentity: string | null = null;
	authStore.subscribe(({ loggedIn, member }) => {
		const identity = loggedIn ? (member?.id ?? '') : null;
		if (identity !== lastIdentity) {
			sessionEpoch += 1;
			lastIdentity = identity;
			onChange();
		}
	});
	return { epoch: () => sessionEpoch };
}

/** 門 (a) 完整 session gate 的選項。 */
export interface SessionGateOptions<T> {
	/** 純域 fetch;P1′ 的 epoch 核對由工廠外包(呼叫端不再自己 throw stale)。 */
	fetch: () => Promise<T>;
	/** 成功時套用資料(通常寫回呼叫端的共享 store)。 */
	apply: (data: T) => void;
	/** identity 變更時還原 boot 態(翻旗是工廠的事,reset 只管內容)。boot-parity:
	 *  restored session 開機的立即回呼會打一次 reset,故 reset 須值冪等(store 開機帶
	 *  seed → reset 成 seed clone;開機空 → reset 空),否則首繪 badge teaser 被抹。 */
	reset: () => void;
}

/**
 * 門 (a) 對外面:HydrationGate(hydrated/hydrate/refresh/markMutated)再加 mutate。
 * mutate 吸收五份 mutator 骨架(waitlist join/cancel、leave create/cancel/bookMakeup):
 *   進場快照(await 之前捕捉 wasHydrated + epoch)→ await request → epoch 丟棄(過期即
 *   棄寫,結果仍回傳:server 端事實已成立)→ 寫回時重查完整度(stillIncomplete)→
 *   writeBack → markMutated → 條件式序列化和解。
 * 樂觀 mutator(notifications markRead/markAllRead:先寫後 await、失敗不還原)刻意
 * 不走 mutate(),繼續直接呼叫 markMutated()——故 markMutated 留在 interface。
 */
export interface SessionGate extends HydrationGate {
	mutate<R>(request: () => Promise<R>, writeBack: (result: R) => void): Promise<R>;
}

/**
 * 建立完整 session gate。**內部建構順序為契約**(單一稽核點,構造性消滅 TDZ/未初始化
 * 風險):
 *   1) createHydrationGate 先建 —— wrappedFetch 內對 core.epoch() 是 closure 前向
 *      參照,fetch 只在 hydrate/refresh 時才被呼叫,屆時 core 已就緒。
 *   2) reconcileChain 宣告。
 *   3) createSessionCore 訂閱 —— restored session 的立即回呼在此觸 onChange,而
 *      onChange 讀 gate 與 reconcileChain,兩者至此都已存在。順序若倒過來(先訂閱),
 *      立即回呼會在 gate 尚未建好時觸 onChange → 炸 module-load(waitlist/leave 原本
 *      各自靠「reconcileChain 宣告在 subscribe 之前」的 TDZ 註解手動維持,現收成一處)。
 *
 * onChange = opts.reset() + gate.hydrated.set(false) + reconcileChain 重置(舊 session
 * 卡死的和解不得堵住新 session 的鏈)。
 */
export function createSessionGate<T>(opts: SessionGateOptions<T>): SessionGate {
	// 1) gate 先建。wrappedFetch 對 core 的前向參照見上方契約說明。
	const gate = createHydrationGate<T>({
		fetch: async () => {
			const epoch = core.epoch();
			const data = await opts.fetch();
			// P1′:回應落地前核對 epoch —— 跨登出/換帳號的在飛回應整包作廢(throw 讓 gate
			// 既不 apply 也不 commit,見 hydration-gate 檔頭「fetch rejection 原樣拋出」)。
			// refresh 也走這條 wrappedFetch,故 gate.refresh 匯出者(leave 的 refreshLeaveRequests)
			// 一併獲得在飛作廢語意。
			if (epoch !== core.epoch()) throw new Error('stale session: 回應跨登出/換帳號,作廢');
			return data;
		},
		apply: opts.apply
	});
	// 2) reconcileChain 宣告。
	let reconcileChain: Promise<void> = Promise.resolve();
	// 3) core 訂閱。立即回呼(restored session)在此觸 onChange;gate 與 chain 已存在。
	const core = createSessionCore(() => {
		opts.reset();
		gate.hydrated.set(false);
		reconcileChain = Promise.resolve();
	});

	/**
	 * F2′ 和解重抓:序列化 + 失敗可重試 + 幽靈取消。
	 * - 序列化:多支未水合 mutation 各自排隊、先進先出——後出發的和解快照必然較新且
	 *   最後套用,消滅「舊快照晚到、倒序覆寫新 mutation」的窗口。
	 * - 可重試:和解失敗把旗標翻回 false(僅限同 epoch——跨登出的失敗交給 session 重置),
	 *   下一次 hydrate 重新真抓;不再吞錯佯裝完整。失敗翻回 false 不會拆掉 in-flight
	 *   hydrate 的 mutation-wins——gate 的 markMutated 帶單調世代(見 hydration-gate.ts)。
	 * - 幽靈取消:排隊當下的 session 若在起跑前已結束(epoch 變了),callback 直接跳過。
	 */
	function queueReconcile(): void {
		const epoch = core.epoch();
		reconcileChain = reconcileChain.then(() => {
			if (epoch !== core.epoch()) return; // 幽靈和解:排隊時的 session 已結束
			return gate.refresh().catch(() => {
				if (epoch === core.epoch()) gate.hydrated.set(false);
			});
		});
	}

	async function mutate<R>(request: () => Promise<R>, writeBack: (result: R) => void): Promise<R> {
		// 進場(await 之前)捕捉水合狀態 + epoch:旗標 commit(markMutated)後 guarded() 從此
		// 短路;若寫入當下尚未水合,store 只有本地直寫、server 既有列將永不補回,故 !wasHydrated
		// 時尾隨一次和解重抓(request 已先完成,快照必含新列)。捕捉點必須在 await 之前:
		// await 之後才捕捉,會讓「第一支 mutation 已 markMutated」誤導併發的第二支以為已水合、
		// 不排自己的和解(帳本閉合輪 P2)。
		const wasHydrated = get(gate.hydrated);
		const epoch = core.epoch();
		const result = await request();
		if (epoch !== core.epoch()) return result; // P1′:server 端已成立;本地棄寫(呼叫端元件已隨登出卸載)
		// 寫回時重查完整度:進場後旗標可能被「和解失敗」翻回 false(進場快照已失真)——此時
		// 不再排和解的話,markMutated 會把不完整 store 再度標成完整(帳本閉合輪 P2)。
		const stillIncomplete = !get(gate.hydrated);
		writeBack(result);
		gate.markMutated(); // commit:讓 in-flight 的 hydrate()(若有)mutationWins、不拿舊清單蓋掉這筆直寫
		if (!wasHydrated || stillIncomplete) queueReconcile();
		return result;
	}

	return { ...gate, mutate };
}

/**
 * 門 (b) session refresher —— points / subscriptions。
 *
 * 保留「無條件重抓」語意(getDashboard/getAccount/getPoints/checkout-sync afterOrder/
 * CheckoutDialog/CartSheet 開啟時都依賴每次真抓,不得硬套 guard),只加兩件事:
 * identity 變更清空(reset)+ 在飛換帳「靜默丟棄」。丟棄必須靜默(return,不 throw)——
 * redeemReward await refreshPoints、placeOrder 的 afterOrder 會傳播 rejection,若在飛
 * 換帳改成 throw,等於新增一個「換帳號」失敗模式打進那兩條傳播鏈。
 */
export function createSessionRefresher<T>(opts: {
	fetch: () => Promise<T>;
	apply: (data: T) => void;
	reset: () => void;
}): () => Promise<void> {
	const core = createSessionCore(opts.reset);
	return async () => {
		const epoch = core.epoch();
		const data = await opts.fetch();
		if (epoch !== core.epoch()) return; // 在飛換帳:靜默丟棄(不套用、不 throw)
		opts.apply(data);
	};
}

/**
 * 門 (c) 外部旗標重置 —— mobile notifs。
 *
 * gate 所有權留呼叫端(mobile 的 notifsHydrated 必須維持 plain Writable<boolean>,通知
 * 頁 createLoadGate 的 `hydrate:{flag}` 接線依賴它)。本門只做一件事:identity 變更時
 * 呼叫 reset(把旗標翻回 false + 重置 store 到 boot seed)。「set() 不繞這層」的載重約束
 * 仍為真——reset 走的是同一個公開 setter,水合本身由通知頁的 load-gate 自己翻旗。
 */
export function onSessionReset(reset: () => void): void {
	createSessionCore(reset);
}
