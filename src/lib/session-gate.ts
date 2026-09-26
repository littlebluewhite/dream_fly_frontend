/**
 * session-gate — authStore 身分變更感知的 domain-store 水合閘門家族(架構深化 R7 C1)。
 *
 * 收斂六個 member/mobile domain store 對「session 身分變更」的非同構處理:waitlist/
 * leave 手抄了完整的 epoch/身分重置/序列化和解鏈骨架(位元組級雙生);notifications
 * 的 hydrated 旗標跨帳號存活(真缺陷:SPA 登出無整頁重載,B 帳號被 guarded() 短路、
 * 直接讀到 A 的資料);points/subscriptions 全無守衛。本模組把前二「吸收」成單源、
 * 把後四「抬升」到同一套守衛之下,提供兩門工廠:
 *   - createSessionGate     完整 session gate(gate + 身分重置 + 序列化可重試和解鏈
 *                           + epoch 核對 fetch + 頁面進場包 pageEntry())——
 *                           waitlist / leave / notifications;R13(docs/adr/0023)
 *                           再加會員資料(member/profile)、教練身分(coach/api 私有)
 *                           與 mobile-admin 訊息(messagesGate),共六個
 *   - createSessionRefresher session refresher(保留無條件重抓語意,只加身分清空 +
 *                           在飛寫回 epoch 作廢;不套 guard)—— points / subscriptions
 *
 * C3(架構深化 R9)新增 pageEntry(),關閉 ADR 0017 明載的 known-latent 殘窗(通知
 * **頁**的 load-gate 直接拿 raw getter 當 fetch,繞過 epoch 核對)。門 (c)
 * `onSessionReset` 已退役(其唯一消費者曾是 mobile 專屬的通知模組;Task 5 架構深化
 * R12 起 mobile 併入 member notifications,經 $lib/mobile/stores 轉出同一顆 gate,
 * 三門收斂為兩門的結論不變)。
 *
 * 架構深化 R10／R11 動的主要是 pageEntry():R10 的 hydrate 包多帶 `gen: gate.mutationGen`
 * (世代穩定重抓),R11 再多帶 `pendingSettle: gate.pendingSettle`(mutation settle 訊號)
 * ——讓頁面 load-gate 的 refresh 族與 store 閘門讀**同一本**世代帳與**同一本**尾流帳
 * (見 $lib/hydration-gate 的 fetchGenStable)。R11 終審修波再於下方 identity onChange 補
 * **一行** `gate.clearPendingTails()`(跨身分清尾流帳,理由見該處與 createSessionGate 註解)。
 * 除這一行外本檔其餘一字未動——尤其 queueReconcile
 * 零 diff:它的「和解快照 vs 後續 mutation」殘窗由 gate.refresh 自帶的世代比對免費閉合
 * (見該函式註解);mutate() 也零 diff——它是 await-then-write,天生沒有「寫回時尾流仍在
 * 飛」的窗口,不需要入帳(R11 的缺陷只在四個 mark-before-await 的通知域呼叫點)。
 *
 * 座落位置:authStore 與 domain store 之間。刻意**不**深化 hydration-gate——後者被
 * ~49 頁全 surface 的 load-gate 消費(含 staff 面,其 identity 源非 member authStore),
 * 若把 member auth 維度打進那顆 core,等於把錯向依賴灌進 repo 最寬的 seam;且
 * hydration-gate 的檔頭憲章(零模組級副作用、零 store import、SSR-safe 葉)是 ADR 0016
 * 剛批的。session-gate 則明確依賴 authStore,但仍守零 import-time 副作用:authStore
 * .subscribe() 發生在 factory **被呼叫**時(call site 在各 store 模組頂層 = 現行
 * waitlist/leave 同位置),不是本模組 import 時——SSR 姿勢與現況一致。
 *
 * 每次 factory call 一個獨立的 authStore 訂閱(R13 起共八個模組級永生訂閱——六個
 * createSessionGate + 兩個 createSessionRefresher,與現狀同類),
 * 無共享 registry:registry 會違反零副作用憲章、需要新的 registry-reset 測試接縫,
 * 且 epoch 只與自身比較、無跨模組消費者(見 ADR 0016 定案 3)。
 */
import { get } from 'svelte/store';
import { authStore } from '$lib/stores/authStore';
import { createHydrationGate, type HydrationGate } from '$lib/hydration-gate';
import type { LoadGateHydrateOptions } from './load-gate'; // type-only:零 runtime 邊

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
 * 頁面進場包(C3):頁面建 load-gate 所需的兩件東西一次吐齊 —— fetch 是**帶 epoch
 * 核對**的那一支(不是呼叫端的 raw getter),hydrate 是閘門自己的旗標 + apply。
 * 頁面寫 `createLoadGate({ ...gate.pageEntry() })` 即可,不再有機會繞過核對。
 */
export interface PageEntry<T> {
	fetch: () => Promise<T>;
	hydrate: LoadGateHydrateOptions<T>;
}

/**
 * 門 (a) 對外面:HydrationGate(hydrated/hydrate/refresh/markMutated/mutationGen/
 * pendingSettle/clearPendingTails)再加 mutate 與 pageEntry。
 * mutate 吸收五份 mutator 骨架(waitlist join/cancel、leave create/cancel/bookMakeup):
 *   進場快照(await 之前捕捉 wasHydrated + epoch)→ await request → epoch 丟棄(過期即
 *   棄寫,結果仍回傳:server 端事實已成立)→ 寫回時重查完整度(stillIncomplete)→
 *   writeBack → markMutated → 條件式序列化和解。
 * 樂觀 mutator(notifications markRead/markAllRead:先寫後 await、失敗不還原)刻意
 * 不走 mutate(),繼續直接呼叫 markMutated()——故 markMutated 留在 interface。
 */
export interface SessionGate<T> extends HydrationGate {
	mutate<R>(request: () => Promise<R>, writeBack: (result: R) => void): Promise<R>;
	/** 頁面進場包;語意與成環證明見 PageEntry 與 createSessionGate 的 pageEntry 註解。 */
	pageEntry(): PageEntry<T>;
}

/**
 * 建立完整 session gate。**內部建構順序為契約**(單一稽核點,構造性消滅 TDZ/未初始化
 * 風險):
 *   0) epochFetch 抽名宣告 —— 純 const 宣告、零呼叫,對 core 與 1) 相同是 closure
 *      前向參照。抽名是為了讓 pageEntry() 能把**同一支**核對過的 fetch 交給頁面的
 *      load-gate(不是複製第二份判斷)。
 *   1) createHydrationGate 先建 —— fetch(= epochFetch)內對 core.epoch() 是 closure
 *      前向參照,fetch 只在 hydrate/refresh 時才被呼叫,屆時 core 已就緒。
 *   2) reconcileChain 宣告。
 *   3) createSessionCore 訂閱 —— restored session 的立即回呼在此觸 onChange,而
 *      onChange 讀 gate 與 reconcileChain,兩者至此都已存在。順序若倒過來(先訂閱),
 *      立即回呼會在 gate 尚未建好時觸 onChange → 炸 module-load(waitlist/leave 原本
 *      各自靠「reconcileChain 宣告在 subscribe 之前」的 TDZ 註解手動維持,現收成一處)。
 *
 * onChange = opts.reset() + gate.hydrated.set(false) + reconcileChain 重置(舊 session
 * 卡死的和解不得堵住新 session 的鏈)+ gate.clearPendingTails()(R11 終審修波:舊 session
 * 掛死的 mutation 尾流同樣不得堵住新身分的 refresh —— 尾流帳的「必然自癒」前提只在同身分
 * 內成立,跨身分時 A 的一筆永不 settle 的 PATCH 會讓 B 的 GET 一次都不出發)。
 */
export function createSessionGate<T>(opts: SessionGateOptions<T>): SessionGate<T> {
	// 0) epochFetch 抽名。對 core 的前向參照見上方契約說明。
	const epochFetch = async (): Promise<T> => {
		const epoch = core.epoch();
		const data = await opts.fetch();
		// P1′:回應落地前核對 epoch —— 跨登出/換帳號的在飛回應整包作廢(throw 讓 gate
		// 既不 apply 也不 commit,見 hydration-gate 檔頭「fetch rejection 原樣拋出」)。
		// refresh 也走這條 fetch,故 gate.refresh 匯出者(leave 的 refreshLeaveRequests)
		// 與 pageEntry() 交給頁面 load-gate 的那一支,一併獲得在飛作廢語意。
		if (epoch !== core.epoch()) throw new Error('stale session: 回應跨登出/換帳號,作廢');
		return data;
	};
	// 1) gate 先建。
	const gate = createHydrationGate<T>({ fetch: epochFetch, apply: opts.apply });
	// 2) reconcileChain 宣告。
	let reconcileChain: Promise<void> = Promise.resolve();
	// 3) core 訂閱。立即回呼(restored session)在此觸 onChange;gate 與 chain 已存在。
	const core = createSessionCore(() => {
		opts.reset();
		gate.hydrated.set(false);
		reconcileChain = Promise.resolve();
		gate.clearPendingTails(); // 舊身分的尾流不得堵住新身分的 refresh(理由見上方 onChange 說明)
	});

	/**
	 * F2′ 和解重抓:序列化 + 失敗可重試 + 幽靈取消。
	 * - 序列化:多支未水合 mutation 各自排隊、先進先出——後出發的和解快照必然較新且
	 *   最後套用,消滅「舊快照晚到、倒序覆寫新 mutation」的窗口。
	 * - 可重試:和解失敗把旗標翻回 false(僅限同 epoch——跨登出的失敗交給 session 重置),
	 *   下一次 hydrate 重新真抓;不再吞錯佯裝完整。失敗翻回 false 不會拆掉 in-flight
	 *   hydrate 的 mutation-wins——gate 的 markMutated 帶單調世代(見 hydration-gate.ts)。
	 * - 幽靈取消:排隊當下的 session 若在起跑前已結束(epoch 變了),callback 直接跳過。
	 * - 和解快照 vs 後續 mutation(架構深化 R10 閉合,本函式零 diff):R1 在飛期間若有第二支
	 *   mutation 完成而**不排** R2(它進場時旗標已 true、寫回時仍完整),R1 的舊快照舊碼會
	 *   無條件套用、蓋掉那筆直寫。gate.refresh() 收進世代穩定重抓後,R1 進場捕捉的世代早於
	 *   該 mutation,落地比對不符即丟棄並原地重抓——不必在這裡多排一支和解。
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

	/**
	 * 頁面進場包(C3,關閉 ADR 0017 的 known-latent 殘窗)。零新程式路徑——只是把既有
	 * 的 epochFetch 與既有的 hydrated/apply 包成 load-gate 認得的形狀:
	 *   - stale(跨登出/換帳)→ epochFetch throw → load-gate 既有 error 態;
	 *   - 使用者按 retry → load-gate 的 refresh 回落同一支 epochFetch → 新 epoch 下成功。
	 * 換帳當下 identity 重置(onChange)已同步清 store,新帳號永不見舊帳號資料。
	 * flag 是閘門自己的 hydrated **同一實例**、into 是 opts.apply **同一函式**、gen 是
	 * gate.mutationGen、pendingSettle 是 gate.pendingSettle **同一支讀取器**——頁面與
	 * store 模組共用同一顆守衛、同一本世代帳與同一本尾流帳,不是複本。
	 * gen(架構深化 R10)讓頁面的 refresh()/silentRefresh() 獲得世代穩定重抓:使用者按
	 * 「重新整理」的飛行窗口內做的本地 mutation(已讀、取消…)不會被姍姍來遲的舊快照蓋回
	 * (見 $lib/hydration-gate 的 fetchGenStable)。load() 不套此迴圈,hydrate 契約不變。
	 * pendingSettle(架構深化 R11)補上正交的等待軸:頁面的 refresh 族在樂觀 mutation 的
	 * PATCH 尚未 settle 時不出發 GET——世代軸看不見「尾流還在飛」,GET 搶跑就會拿到 server
	 * 舊真值、而世代此刻已穩定,舊快照照套(ADR 0020 誠實界線記載的 GET/PATCH server-race)。
	 */
	function pageEntry(): PageEntry<T> {
		return {
			fetch: epochFetch,
			hydrate: {
				flag: gate.hydrated,
				into: opts.apply,
				gen: gate.mutationGen,
				pendingSettle: gate.pendingSettle
			}
		};
	}

	return { ...gate, mutate, pageEntry };
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
