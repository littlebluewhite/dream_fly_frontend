/**
 * session-gate — authStore 身分變更感知的 domain-store 水合閘門家族(架構深化 R7 C1)。
 *
 * 收斂六個 member/mobile domain store 對「session 身分變更」的非同構處理:waitlist/
 * leave 手抄了完整的 epoch/身分重置/序列化和解鏈骨架(位元組級雙生);notifications
 * 的 hydrated 旗標跨帳號存活(真缺陷:SPA 登出無整頁重載,B 帳號被 guarded() 短路、
 * 直接讀到 A 的資料);points/subscriptions 全無守衛。本模組把前二「吸收」成單源、
 * 把後四「抬升」到同一套守衛之下,提供兩門工廠:
 *   - createSessionGate     完整 session gate(gate + 身分重置 + 序列化可重試和解鏈
 *                           + epoch 核對 fetch;頁面進場包 pageEntry() 繼承自閘門)——
 *                           waitlist / leave / notifications;R13(docs/adr/0023)
 *                           再加本人帳號資料(self-account)、教練身分(coach/api 私有)
 *                           與 mobile-admin 訊息(messagesGate),共六個
 *   - createSessionRefresher session refresher(保留無條件重抓語意,只加身分清空 +
 *                           在飛寫回 epoch 作廢;不套 guard)—— points / subscriptions
 *
 * C3(架構深化 R9)新增 pageEntry(),關閉 ADR 0017 明載的 known-latent 殘窗(通知
 * **頁**的 load-gate 直接拿 raw getter 當 fetch,繞過 epoch 核對)。門 (c)
 * `onSessionReset` 已退役(其唯一消費者曾是 mobile 專屬的通知模組;架構深化 R12 起
 * mobile 併入 member notifications 這顆共用 gate;R15(候選 F-4)mobile 消費端改直接
 * `import from '$lib/member/notifications'`,不再經 `$lib/mobile/stores` 轉出——三門
 * 收斂為兩門的結論不變,只是 mobile 拿到這顆 gate 的路徑換了)。
 *
 * 架構深化 R10／R11 替 pageEntry() 交出的水合協定加上世代穩定重抓與 mutation settle 訊號,
 * 讓頁面 load-gate 的 refresh 族與 store 閘門讀**同一本**世代帳與**同一本**尾流帳(見
 * $lib/hydration-gate 內部的 fetchGenStable)。R14(候選 F1)把 pageEntry() 整個搬進
 * HydrationGate:本檔已把 epochFetch 當 fetch 餵給水合閘門,所以繼承下來的進場包自帶 epoch
 * 核對,本檔不再自己組。R15(候選 F-1)再把 pageEntry() 的形狀收成 `{ source: LoadSource }`
 * ——世代帳與尾流帳的讀取器連經 pageEntry() 交出這條路都收掉,只住 hydration-gate.ts 內部,
 * 頁面的 load-gate 只看得到 `source.load(isCurrent)`/`source.refresh(isCurrent)` 這兩支黑箱;
 * 本檔對此無感,`gate.pageEntry()` 原樣轉手。identity onChange 呼叫本閘門的
 * `reset()`(R15 起即水合閘門自帶的通用 reset() 再加重置兩條鏈;取代 R14 以前專供本檔用的內部
 * 工廠 `createOwnedHydrationGate`/`ownerChanged()`,兩者已退役——閘門的 reset() 翻旗 false +
 * 清尾流帳,後者即 R11 終審修波的跨身分清帳,理由見 createSessionGate 註解)。queueReconcile 與
 * mutate() 不受影響:前者的「和解快照 vs 後續 mutation」殘窗由 gate.refresh 自帶的世代比對免費
 * 閉合(見該函式註解);後者是 await-then-write,天生沒有「寫回時尾流仍在飛」的窗口,不需要入帳
 * (R11 的缺陷只在四個 mark-before-await 的通知域呼叫點)。
 *
 * R14(候選 F2)重開 ADR-0023 的「等第三處再說」:profile/coach 手抄的在飛合併、寫入鏈與
 * session 世代收進閘門——合併住 HydrationGate(hydrate 與頁面 load-gate 的 load 共用在飛 GET),
 * 寫入鏈住本檔(queueWrite)。身分基準改在建構當下決定:restored 開機零觸發,建構順序契約
 * 與消費端「let 必須宣告在前」的註解一併退役。
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
 * 且 epoch 只與自身比較、無跨模組消費者(見 ADR-0017、ADR-0024 的「不做 registry 測試縫」)。
 */
import { get } from 'svelte/store';
import { authStore, type AuthState } from '$lib/stores/authStore';
import { createHydrationGate, type HydrationGate } from '$lib/hydration-gate';

/** session 身分 key 的單一來源:未登入 null;登入但無 member.id 退化為空字串。 */
export function sessionIdentity(a: Pick<AuthState, 'loggedIn' | 'member'>): string | null {
	return a.loggedIn ? (a.member?.id ?? '') : null;
}

/**
 * 私有 identity core:每次 factory call 建一個 authStore 訂閱,把「身分是否變更」
 * 這唯一決策收成一處。
 *
 * 身分基準在建構當下決定(R14 F2):subscribe 的立即回呼只記 lastIdentity、不觸發
 * onChange——restored 與訪客開機一律零觸發(ADR-0017 的「reset 值 = 開機值」保證畫面無差別),
 * 故建構期間不會呼叫任何 reset,呼叫端的 let 宣告在哪都不炸。identity key 見 sessionIdentity()
 * (未登入為 null,登入但無 member.id 退化為空字串)。
 *
 * 回傳 epoch():單調遞增的 session 世代,身分每變一次 +1;fetch/mutate 出發時捕捉、
 * 落地前比對——跨登出/換帳號的在飛回應即以此作廢。
 */
function createSessionCore(onChange: () => void): { epoch: () => number } {
	let sessionEpoch = 0;
	let lastIdentity: string | null = null;
	let baselined = false;
	authStore.subscribe((a) => {
		const identity = sessionIdentity(a);
		if (!baselined) {
			baselined = true; // 立即回呼:只記身分基準
			lastIdentity = identity;
			return;
		}
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
	/** identity 變更時還原 boot 態(翻旗是工廠的事,reset 只管內容)。開機不觸發(R14 F2:
	 *  建構當下只記身分基準)。 */
	reset: () => void;
}

/**
 * 門 (a) 對外面:HydrationGate(hydrated/hydrate/refresh/invalidate/reset/markMutated/pageEntry)
 * 多 mutate 與 queueWrite;reset 覆寫為「閘門 reset + 重置兩條鏈」。pageEntry() 繼承自閘門
 * (R14 F1):資料來源抓的是**帶 epoch 核對**的 epochFetch(本工廠餵給水合閘門的那一支,
 * 不是呼叫端的 raw getter),頁面寫 `createLoadGate({ ...gate.pageEntry() })` 不再有機會繞過核對。
 * mutate 吸收五份 mutator 骨架(waitlist join/cancel、leave create/cancel/bookMakeup):
 *   進場快照(await 之前捕捉 wasHydrated + epoch)→ await request → epoch 丟棄(過期即
 *   棄寫,結果仍回傳:server 端事實已成立)→ 寫回時重查完整度(stillIncomplete)→
 *   writeBack → markMutated → 條件式序列化和解。
 * 樂觀 mutator(notifications markRead/markAllRead:先寫後 await、失敗不還原)刻意
 * 不走 mutate(),繼續直接呼叫 markMutated()——故 markMutated 留在 interface。
 * queueWrite(R14 F2,語意逐字取自 profile.ts 原 enqueue):排進本閘門的寫入鏈,前一筆
 * settle(成敗皆可)才輪到;輪到時 session 已換就回 `skipped`、task 不執行。task 拿到
 * `stale()` 供失敗處理判斷(換帳後不得回滾/重抓到新身分身上)。換帳號即重置這條鏈——
 * 舊身分卡住的寫入不得堵住新身分。
 */
export interface SessionGate extends HydrationGate {
	mutate<R>(request: () => Promise<R>, writeBack: (result: R) => void): Promise<R>;
	queueWrite<R>(task: (stale: () => boolean) => Promise<R>, skipped: R): Promise<R>;
}

/**
 * 建立完整 session gate。epochFetch 抽名,讓閘門的 pageEntry() 交給頁面 load-gate 的資料來源
 * 抓的是**同一支**核對過的 fetch(不是複製第二份判斷);它對 core 是 closure 前向參照,只在
 * hydrate/refresh 時才被呼叫。建構期不觸發 onChange(身分基準見 createSessionCore),
 * 宣告順序不再是契約。
 *
 * onChange = reset() = gate.reset()(opts.reset() + 翻旗 false + 丟在飛合併 GET + 清尾流帳——
 * R11 終審修波:舊 session 掛死的 mutation 尾流不得堵住新身分的 refresh,尾流帳的「必然自癒」
 * 前提只在同身分內成立,跨身分時 A 的一筆永不 settle 的 PATCH 會讓 B 的 GET 一次都不出發)+
 * reconcileChain / writeChain 重置(舊 session 卡死的和解或寫入不得堵住新 session 的鏈)。
 */
export function createSessionGate<T>(opts: SessionGateOptions<T>): SessionGate {
	const epochFetch = async (): Promise<T> => {
		const epoch = core.epoch();
		const data = await opts.fetch();
		// P1′:回應落地前核對 epoch —— 跨登出/換帳號的在飛回應整包作廢(throw 讓 gate
		// 既不 apply 也不 commit,見 hydration-gate 檔頭「fetch rejection 原樣拋出」)。
		// refresh 也走這條 fetch,故 gate.refresh 匯出者(leave 的 refreshLeaveRequests)
		// 與閘門 pageEntry() 交給頁面 load-gate 的資料來源,一併獲得在飛作廢語意。
		if (epoch !== core.epoch()) throw new Error('stale session: 回應跨登出/換帳號,作廢');
		return data;
	};
	const gate = createHydrationGate<T>({ fetch: epochFetch, apply: opts.apply, reset: opts.reset });
	let reconcileChain: Promise<void> = Promise.resolve();
	let writeChain: Promise<void> = Promise.resolve();
	function reset(): void {
		gate.reset(); // 內容還原 + 翻旗 false + 舊身分的在飛 GET 與尾流不得帶給新身分(理由見上方 onChange 說明)
		reconcileChain = Promise.resolve();
		writeChain = Promise.resolve();
	}
	const core = createSessionCore(reset);

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
				if (epoch === core.epoch()) gate.invalidate();
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

	function queueWrite<R>(task: (stale: () => boolean) => Promise<R>, skipped: R): Promise<R> {
		const mine = core.epoch();
		const stale = () => mine !== core.epoch();
		const run = writeChain.then(() => (stale() ? skipped : task(stale)));
		writeChain = run.then(
			() => {},
			() => {}
		);
		return run;
	}

	return { ...gate, reset, mutate, queueWrite };
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
