/**
 * 共享 store 水合閘門 factory。
 *
 * 收斂「共享 store 的水合協定」：guard 短路 + post-await re-check（mutation 勝出）
 * + mutator 翻旗。最初是 src/lib/mobile-admin/stores.ts 中 ops 集合與訊息水合
 * 兩段逐字重複協定的深模組化——該檔的 ops 集合（三個水合單位）仍直接用本 factory；訊息那段自 R13（docs/adr/0023）改建在
 * session-gate.ts 的 createSessionGate 上（換帳號即重置），R20 起已是教練對話列表
 * （coach/conversations.ts，同樣建在 createSessionGate 上，桌面與 mobile-admin 共用），
 * 仍間接用本 factory。
 *
 * 核心語意：hydrate() 開頭若已水合就短路、不打 API；fetch 進行中若發生 mutation
 * （write()，或併發的另一方先套用並翻旗），await 結束後的 re-check 會
 * 讓 mutation 勝出、放棄套用剛抓回的資料——避免「水合前的本地寫入」被姍姍來遲的
 * 首次水合覆蓋（mobile-admin 的 C1 regression 即此類 bug）。refresh() 略過 guard、
 * 一律真抓，供使用者明確要求的「重新整理」與失敗重試共用；抓回的快照則走**世代穩定
 * 重抓**（fetchGenStable，R10 新增的第四決策點）——進場捕捉 mutation 世代、落地比對，
 * 期間發生的本地 mutation 會讓那份快照作廢並原地重抓，直到抓回一份「不早於最後一次
 * 本地 mutation 出發點」的快照才套用。R11 再補上**第五決策點：mutation settle 訊號**
 * ——refresh 族每次出發 fetch 之前，先等未 settle 的樂觀 mutation 尾流（樂觀 write() 記帳
 * 的 PATCH promise）全數落地，關掉「GET 搶在 PATCH 前面出發、server 回舊真值而世代
 * 又已穩定」的 server-race 窗（ADR 0020 誠實界線）。等待軸與丟棄軸正交。
 *
 * hydrate 路徑刻意**不**套這個迴圈：hydrate 的契約是 mutation-wins 直接丟棄（本地即
 * 真相，補抓的責任在後續的和解鏈）；refresh 的契約是顯式新鮮度，丟棄之後**必須**補抓，
 * 否則使用者按了「重新整理」卻什麼都沒發生。此不對稱是協定本體，不是遺漏。
 *
 * C1（架構深化 R5）：協定的三個決策點（guarded／mutationWins／commit）單一住所。R15（候選
 * F-1）起連「套用」本身也收回閘門：頁面 load-gate 不再拿旗標與 into 自己組協定，而是由
 * pageEntry() 交出資料來源（LoadSource）——load-gate 把棄追判準 isCurrent 交進來，閘門的
 * loadRun／refreshRun 在 apply 與 commit 之間尊重頁面的 run 身分（重入防護(F1)／(F5)），
 * 對外的 hydrate()／refresh() 即 isCurrent 恆真的同一支。當年擋住整體委派的就是「閘門
 * 看不到頁面的 run 身分」，isCurrent 由呼叫方交進來之後這個理由不再成立（取代 ADR-0016
 * 決定一）。phase、run 世代的寫入點與棄追判準仍在 load-gate，故不是 ADR-0020 否決的形 3。
 *
 * R14(候選 F1):頁面進場包 pageEntry() 自 session-gate 搬進 HydrationGate——plain 閘門
 * (mobile-admin ops 集合的水合單位)與 session 閘門的頁面自此同一條接法
 * `createLoadGate({ ...gate.pageEntry() })`。
 *
 * R14(候選 F2):**hydrate 合併**——hydrate() 與頁面 load-gate 的 load 共用同一支在飛 GET(子頁
 * onMount 先於 layout,暖機與頁面載入必然同時水合)。只共用「同一次 GET」,沒有世代迴圈,
 * 不是 ADR-0020 否決的形 3;refresh 族(refresh()、頁面 load-gate 的 refresh 族)一律真抓、不併入。
 * 同時新增 invalidate():外部 production 把旗標翻回 false 的唯一寫法(reset() 也翻,但它是整顆閘門的重置)。
 *
 * R15(候選 閘門重置):閘門自帶 reset()——內容還原開機值(opts.reset)+ 翻旗 false + 丟在飛合併
 * GET + 換尾流帳本。session-gate 的 identity 重置與各模組的測試出口 reset…ForTests 共用這一支
 * (取代 R14 只給 session-gate 的內部「擁有者換人」出口);hydrated 自此唯讀(收掉
 * ADR-0024 D-F2a),測試不再直寫旗標。
 *
 * 寫入動詞 write()(docs/adr/0027 §5):「寫 store → 宣告水合真相 → 記尾流 → 失敗復原 → 未水合時
 * 和解」整條在閘門內,和解鏈以 resetEpoch 為軸(reset() 一併清)。樂觀路徑同一同步段先寫 store 再記
 * 尾流,非樂觀路徑 await send 之後才寫;丟棄軸(fetchGenStable)與等待軸(尾流帳)各自獨立。write()
 * 是唯一的寫入動詞(推世代、翻旗、尾流入帳都只經由它)。
 *
 * R21:**第六決策點:出發序帳**(createDepartureLedger)——後出發者贏。hydrate 的合併 GET
 * 與 refresh 族(store refresh()、頁面 source.refresh、世代重抓輪、和解、resync)出發時同步取號,落地時已有
 * 更晚出發的落地就靜默返回。先出發的快照較晚落地不再蓋回,不分是哪個 caller 出發的——消費端不必手寫序號。
 * 三軸互相獨立:世代軸管丟棄、尾流軸管等待、出發序帳只管「誰的落地算數」。
 *
 * Legacy store-factory 風格（仿 load-gate.ts／stores/toasts.ts）：closure、無
 * `this`、無模組層副作用（SSR 安全，模組可被伺服端 import），不使用 runes。
 * fetch rejection 一律原樣拋出、不在此攔截——呼叫端的 load-gate 接手轉 error 態。
 */
import { writable, get, type Readable } from 'svelte/store';
import type { LoadSource } from './load-gate'; // type-only:零 runtime 邊(執行期只剩單向依賴)

/**
 * 第四決策點（R10）：**世代穩定重抓**——refresh 族專用。
 *
 * 進場捕捉 `gen()` → `fetch()` → 落地再讀一次 `gen()` 比對：相同代表這份快照的出發點
 * 不早於最後一次本地 mutation，可以套用；不同代表「refresh **進場之後**」有 mutation
 * 落地（例如使用者在飛行窗口內按了取消／已讀），該份快照已是舊事實，丟棄並原地重抓，
 * 直到世代穩定為止。
 *
 * 判準只認「進場之後才發生的 mutation」，**絕不可**改讀旗標／世代的當下值：像
 * mobile-admin ops 寫入動詞的「await 寫入 → await 單位 refresh()」是正常序列，mutation 發生
 * 在進場之前，那份快照必須照常套用、且只能發一次 fetch。
 *
 * `opts.iterate` 是棄追判準（即 refreshRun 收到的 isCurrent；store 層的 refresh() 傳恆真＝抓到
 * 穩定為止）：這一輪重抓不再有意義（load-gate 的「已卸載／被新一輪 run 取代」）時回傳假即停，
 * 回傳 `undefined` 表示「最後那份快照不要套用」。
 *
 * `opts.pendingSettle` 是**第五決策點（R11）：mutation settle 訊號**——迴圈前導（每次
 * 出發前，含第 N 次補抓輪）先問「還有未 settle 的樂觀 mutation 尾流嗎」，有就等到全數
 * settle 再捕捉世代、出發 fetch。理由：樂觀 mutation 是 mark-before-await（write() 先寫
 * store ＋ 宣告 mutation，才 await PATCH），GET 若在 PATCH 仍在飛時出發，server 回的是舊真值、
 * 而世代此刻**已經穩定**，舊快照照樣落地（ADR 0020 誠實界線記載的 GET/PATCH
 * server-race）。**等待軸與丟棄軸正交**：等待不看世代，丟棄仍只看進出場世代比對，兩者
 * 不得互換。等待期間醒來後先問一次 `iterate()`——這一輪可能已被取代／卸載。
 *
 * 任何一次 fetch 的 rejection（含第 N 次重抓的）一律**原樣拋出**，不吞、不回頭補套
 * 已被丟棄的舊快照——與本模組檔頭的「fetch rejection 原樣拋出」一致。
 */
async function fetchGenStable<T>(
	fetch: () => Promise<T>,
	gen: () => number,
	opts: {
		/** 棄追判準;語意見上方註解。 */
		iterate: () => boolean;
		/** mutation 尾流的 settle 訊號（第五決策點，R11）：有未 settle 的尾流就回一個
		 *  「全數 settle 時 resolve」的 promise，靜止時**同步**回 undefined。 */
		pendingSettle: () => Promise<void> | undefined;
	}
): Promise<T | undefined> {
	const { iterate, pendingSettle } = opts;
	for (;;) {
		// 第五決策點:未 settle 的 mutation 尾流在場就等,不讓 GET 搶在 PATCH 前面出發。
		// 靜止時 pendingSettle() **同步**回 undefined,迴圈體一次都不跑、一個 microtask 都不
		// 多花——世代捕捉因此仍與呼叫端同步發生,「refresh 之後才寫入」的在飛判準不鬆動。
		// 必須是**迴圈**不是單次 await:等待的 promise 已 resolve、本函式卻還沒恢復執行,這
		// 中間的 microtask 仍可能跑一筆樂觀 write()(尾流入帳;pendingSettle 內部的醒後重查補不到
		// 這一段)。醒來一律重問,不靜止就再等;從最後一次重問到下面的 gen()/fetch() 之間全
		// 程同步,沒有第三方插隊的餘地。
		for (let wait = pendingSettle(); wait; wait = pendingSettle()) {
			await wait;
			if (!iterate()) return undefined; // 棄追:等待期間這一輪已無意義
		}
		const entered = gen();
		const data = await fetch();
		if (entered === gen()) return data; // 世代穩定:進場之後零 mutation,快照可套用
		if (!iterate()) return undefined; // 棄追:呼叫端宣告這一輪已無意義
	}
}

/**
 * 第六決策點(R21):**出發序帳**——後出發者贏。水合閘門自用,並匯出供 session refresher
 * (session-gate.ts 的 createSessionRefresher)共用。
 *
 * 每支可能套用資料的 GET 出發時**同步**取號(`depart()`);落地、確定要套用的那一刻問
 * `overtaken(seq)`:已有更晚出發的落地 → true,呼叫端靜默返回(不等、不重抓、不拋);否則把水位推到
 * seq、回 false,呼叫端接著套用。同號不算超車(合併 GET 的加入者共用一號)。先出發的先落地照常套用、
 * 之後再被蓋過;後出發的 reject 不推水位,先出發的照常套用。
 *
 * overtaken 會推水位,所以只在「其他判準都放行、接著就要套用」時問——因 epoch/卸載/mutation 勝出而
 * 作廢的落地不得問。與世代軸(丟棄)、尾流軸(等待)互相獨立:不看世代,也不等任何人。不採「被取代
 * 者等贏家」:那是第二條等待軸(ADR 0021 只許尾流),贏家的頁面卸載時等的人會卡住,贏家 reject 時
 * 還會連帶丟掉手上好的舊快照。
 */
export interface DepartureLedger {
	/** 出發取號:同步、單調遞增。 */
	depart(): number;
	/** 落地:seq 已被更晚出發的落地超車 → true(不套用);否則推水位、回 false(接著套用)。 */
	overtaken(seq: number): boolean;
}

export function createDepartureLedger(): DepartureLedger {
	let departed = 0;
	let landed = 0;
	return {
		depart: () => ++departed,
		overtaken(seq) {
			if (seq < landed) return true;
			landed = seq;
			return false;
		}
	};
}

/** promise 結局收成值(不拋):write() 落地後才依結局分流。 */
function settle<R>(p: Promise<R>): Promise<PromiseSettledResult<R>> {
	return p.then(
		(value): PromiseSettledResult<R> => ({ status: 'fulfilled', value }),
		(reason): PromiseSettledResult<R> => ({ status: 'rejected', reason })
	);
}

/** 對外的 hydrate()/refresh() 沒有頁面 run 可追:棄追判準恆真。 */
const ALWAYS = (): boolean => true;

export interface HydrationGateOptions<T> {
	/** 主要抓取函式 */
	fetch: () => Promise<T>;
	/** 成功時套用資料（通常是寫回呼叫端的共享 store） */
	apply: (data: T) => void;
	/** reset() 時把內容還原成開機值(翻旗等閘門自己的帳由 reset() 處理,這裡只管內容)。 */
	reset?: () => void;
}

/**
 * 頁面進場包:頁面寫 `createLoadGate({ ...gate.pageEntry() })` 即可。R15(候選 F-1)起只交出一個
 * 資料來源(LoadSource)——guarded/load/refresh 都是閘門自己的閉包,頁面 load-gate 拿不到旗標、
 * 世代帳或尾流帳,只把自己的棄追判準 isCurrent 交進來。去泛型:資料型別封在閘門內部。
 * R14(候選 F1)自 session-gate.ts 搬來住在 HydrationGate:mobile-admin 的 ops 頁接的是 plain
 * 閘門(ops 集合的水合單位),進場包若只住 session 閘門,它們只能拿 hydrate/refresh 當 load-gate 的
 * fetch/refresh——store 閘門自己 apply,load-gate 的「已卸載/被新一輪取代」守衛管不到寫入。
 */
export interface PageEntry {
	source: LoadSource;
}

/** 寫入失敗後閘門做了什麼:keep 不動 / rollback 呼叫 undo / resync 整包重抓(重抓也失敗則退回 undo)。 */
export type WriteRecovery = 'kept' | 'rolledBack' | 'resynced';

/** write() 的結果。stale = send 落地時閘門已重置(擁有者換人),store 一律不碰;settled 照實交付
 *  send 的結局(server 端事實可能已成立,呼叫端要不要用由它決定)。 */
export type WriteOutcome<R> =
	| { kind: 'written'; result: R }
	| { kind: 'stale'; settled: PromiseSettledResult<R> }
	| { kind: 'failed'; error: unknown; recovery: WriteRecovery };

export interface Write<R> {
	/** send 之前同步寫本地 store(樂觀),回傳 undo。有它即走樂觀路徑(send 記成尾流)。 */
	optimistic?: () => (() => void) | void;
	/** 純網路。不得 await 本閘門的 refresh(樂觀路徑下 refresh 會等它,互等即死結)。 */
	send: () => Promise<R>;
	/** 伺服器回覆寫回 store(send 成功且閘門未重置才呼叫)。 */
	commit?: (result: R) => void;
	/** 失敗復原策略,預設 keep。 */
	onFailure?: 'keep' | 'rollback' | 'resync';
}

/** 把 WriteOutcome 還原成「await send 的結果」語意:written/stale 成功給值,失敗(含 stale 的失敗)
 *  原樣拋出。給回傳 server 結果、失敗即拋的 mutator 用。 */
export function resultOf<R>(o: WriteOutcome<R>): R {
	if (o.kind === 'written') return o.result;
	if (o.kind === 'failed') throw o.error;
	if (o.settled.status === 'fulfilled') return o.settled.value;
	throw o.settled.reason;
}

/** write() 失敗後的復原步驟(session 閘門的 queueWrite 在寫前水合失敗時共用):keep 不動;rollback
 *  呼叫 undo;resync 先 refresh,重抓也失敗才退回 undo。沒有 undo 可呼叫 → 'kept'。resync 期間擁有者
 *  換人(stale())→ 'stale':refresh 已靜默收束(不寫),不得謊報 resynced,也不得 undo 到新擁有者身上。 */
export async function recoverWrite(
	policy: Write<unknown>['onFailure'],
	undo: (() => void) | void,
	refresh: () => Promise<void>,
	stale: () => boolean
): Promise<WriteRecovery | 'stale'> {
	if (policy === 'resync') {
		const resynced = await refresh().then(
			() => true,
			() => false // 重抓也失敗:退回 undo
		);
		if (stale()) return 'stale';
		if (resynced) return 'resynced';
	}
	if ((policy ?? 'keep') === 'keep' || !undo) return 'kept';
	undo();
	return 'rolledBack';
}

export interface HydrationGate {
	/** 是否已水合(唯讀投影)。翻 true 走 write()/水合落地,翻 false 走 `invalidate()`/`reset()`。 */
	hydrated: Readable<boolean>;
	/** 併發呼叫(含頁面 load-gate 的 load)共用同一支在飛 GET,settle 即清掉;只併入「同世代出發」
	 *  的那支——出發後有 mutation 的舊快照不借給之後進場者。 */
	hydrate(): Promise<void>;
	refresh(): Promise<void>;
	/** 只把旗標翻 false(下次 hydrate 重新真抓);不碰世代帳、尾流帳、出發序帳、在飛合併。 */
	invalidate(): void;
	/** 整顆閘門還原開機態:丟在飛合併 GET → 換尾流帳本(resetEpoch)→ 清尾流帳與和解鏈 → opts.reset()
	 *  → 翻旗 false → 喚醒全部等待者(帳本清算先於通知,重入 hydrate() 不併到重置前的舊 GET)。
	 *  重置之前出發的 hydrate/refresh 落地一律不寫;被喚醒的舊
	 *  refresh 不再出發 GET。世代帳(mutationGen)與出發序帳不動——兩者只增不減,重置後仍是有效的單調序。 */
	reset(): void;
	/** 唯一的寫入動詞(docs/adr/0027 §5)。進場記 owner(resetEpoch)與 wasHydrated:
	 *   - 樂觀(有 optimistic):同一同步段 optimistic() → send() → 尾流入帳 → 世代 +1 翻旗,再 await;
	 *     尾流以 `then(done, done)` 記帳,**reject 也算 settle**;
	 *   - 非樂觀:await send() 之後才 commit → 世代 +1 翻旗;
	 *   - send 同步拋出等同回傳 rejected promise(走失敗路徑,不讓 write 本身 reject);
	 *   - send 落地時 owner 已變 → stale,不碰 store;成功 → commit;失敗 → 依 onFailure 復原
	 *     (rollback/resync 退回 undo 時沒有 undo 可呼叫 → recovery 'kept';resync 期間 owner 變了 → stale);
	 *   - 寫入翻了旗而 store 可能不完整(寫入前未水合,或非樂觀寫回時旗標已被翻回 false)→ 排和解重抓。 */
	write<R>(w: Write<R>): Promise<WriteOutcome<R>>;
	/** 頁面進場包。source 的三支是閘門自己的閉包(不是複本):
	 *   - guarded:讀閘門自己的 hydrated **同一實例**;
	 *   - load:= hydrate() 的同一支 loadRun,只多帶頁面的 isCurrent——與 hydrate() 共用在飛 GET、
	 *     同一個 mutation 勝出判準(進場世代比對 + 旗標);
	 *   - refresh:= refresh() 的同一支 refreshRun,只多帶頁面的 isCurrent——opts.fetch 真抓、不合併
	 *     (session 閘門餵進來的是 epochFetch,故自帶 epoch 核對),世代穩定重抓與尾流等待讀的是
	 *     閘門**同一本**世代帳與尾流帳(ADR-0020 形 1:世代由閘門持有)。
	 *     【硬契約】尾流帳靜止時 pendingSettle **同步**回 `undefined`,不得回 resolved promise:
	 *     多一個 microtask 會讓 fetchGenStable 的世代捕捉晚於「refresh 之後同步的樂觀 write()」,
	 *     在飛丟棄的時序判準就此鬆掉(可觀察面:靜止時頁面 refresh() 同步呼叫 fetch)。 */
	pageEntry(): PageEntry;
}

export function createHydrationGate<T>(opts: HydrationGateOptions<T>): HydrationGate {
	const flag = writable(false);
	// 帳本閉合輪：寫入(write)帶單調世代，與「完整度」旗標分離。旗標可被呼叫端翻回
	// false（如 waitlist/leave 的和解重抓失敗留可重試路徑）——若 mutation-wins 只讀
	// 旗標當下值，翻回 false 等於拆掉 in-flight hydrate 的武裝，舊快照落地、直寫列
	// 蒸發。世代只增不減，hydrate 進場時捕捉、resolve 後比對，不受旗標之後的起落影響。
	let mutationGen = 0;
	// 第五決策點（R11）：未 settle 的 mutation 尾流帳。樂觀 write() 的 PATCH 入帳、settle
	// （fulfil 或 reject 都算）出帳；帳上非空時 refresh 族等待,不讓 GET 搶在 PATCH 前面。
	// 與世代帳分離:世代管「丟棄」、尾流帳管「等待」,兩軸正交。
	let pendingTails = 0;
	let settleWaiters: Array<() => void> = [];
	// 重置世代(R11 終審修波的尾流帳本世代,R15 起兼管 hydrate/refresh 落地):reset() 推進它。
	// 在飛舊尾流的出帳回呼據此作廢——否則「清帳 → 新尾流入帳 → 舊尾流姍姍來遲地 settle」會把
	// 新帳減掉(甚至減成負數),F2 想關的窗換一個身分原封不動地重開;重置前出發的 GET 落地也據此不寫。
	let resetEpoch = 0;
	// hydrate 合併(R14 F2):在飛的那支 GET、它出發時的世代與出發序號(加入者共用)。reset() 丟掉它。
	let inflight: { gen: number; seq: number; data: Promise<T> } | null = null;
	// 第六決策點(R21):出發序帳。hydrate 與 refresh 族共用一本;write()/invalidate()/reset() 不碰——
	// 序號只增不減,重置之後出發的必然比重置前的新,重置前出發的落地已由 resetEpoch 作廢。
	const ledger = createDepartureLedger();
	// 和解鏈(以 resetEpoch 為軸):序列化、失敗翻旗可重試、
	// 重置前排隊的不在新擁有者身上起跑。reset() 換一條新鏈——舊擁有者卡死的和解不得堵住新擁有者。
	let reconcileChain: Promise<void> = Promise.resolve();

	// 水合協定的三個決策點(C1 詞彙,ADR-0016):
	//  - guarded():進場 guard——已水合就短路、不發 fetch。
	//  - mutationWins(entered):fetch 落地後的 re-check——進場之後世代變了(write),或旗標
	//    被直接翻 true(併發的另一方先套用並翻旗),都算 mutation 勝出、放棄套用。只看旗標不夠:
	//    旗標可被 invalidate() 翻回 false,那等於拆掉在飛那一輪的武裝(見上方 mutationGen 註解)。
	//  - commit():套用完成(或寫入)後翻旗,宣告水合真相成立。
	const guarded = (): boolean => get(flag);
	const mutationWins = (entered: number): boolean => entered !== mutationGen || get(flag);
	const commit = (): void => flag.set(true);

	function coalescedFetch(): { seq: number; data: Promise<T> } {
		// 只併入同世代出發的那支:出發後有 mutation,那份快照對之後進場者已是舊事實。
		if (inflight?.gen !== mutationGen) {
			const entry: { gen: number; seq: number; data: Promise<T> } = {
				gen: mutationGen,
				seq: ledger.depart(),
				data: opts.fetch().finally(() => {
					if (inflight === entry) inflight = null; // 已被取代/丟掉的不清新的
				})
			};
			inflight = entry;
		}
		return inflight;
	}

	/** 水合路徑:hydrate()(isCurrent 恆真)與頁面 load-gate 的 load(isCurrent =「未卸載且仍是
	 *  這一輪 run」)共用。契約是 mutation-wins 丟棄了事,不補抓(見檔頭的不對稱)。 */
	async function loadRun(isCurrent: () => boolean): Promise<void> {
		if (guarded()) return;
		const entered = mutationGen;
		const epoch = resetEpoch;
		const { seq, data: landing } = coalescedFetch();
		const data = await landing;
		if (!isCurrent() || epoch !== resetEpoch) return; // 過期、已卸載或已重置:不寫
		// 併發的另一方(另一支 hydrate 或頁面 load-gate)先套用並翻旗,也在這裡短路——只 apply 一次。
		if (mutationWins(entered)) return;
		// 第六決策點:已有更晚出發的落地(例:invalidate() 翻掉旗標之後才落地的舊 GET)→ 靜默返回。
		if (ledger.overtaken(seq)) return;
		opts.apply(data);
		// 重入防護(F1)(codex B0 r1):apply 通常寫共享 writable,其 subscriber 可能同步重入頁面的
		// load()、開出新一輪 run。重查 isCurrent,不符即不翻旗(翻旗交給新一輪)——否則舊一輪的翻旗
		// 會讓新一輪的落地誤判 mutation 勝出,把真正的新資料丟棄。
		if (!isCurrent()) return;
		commit();
	}

	/** refresh 族:refresh()(isCurrent 恆真＝抓到穩定為止)與頁面 load-gate 的 refresh/
	 *  silentRefresh 共用。一律真抓,無視 guard——守衛短路後的重新整理／重試仍要重抓;不併入
	 *  在飛的 hydrate。落地走世代穩定重抓(進場之後才發生的 mutation 讓那份快照作廢、原地補抓),
	 *  出發前先等自家的 mutation 尾流 settle(第五決策點),見 fetchGenStable。 */
	async function refreshRun(isCurrent: () => boolean): Promise<void> {
		const epoch = resetEpoch;
		const live = (): boolean => isCurrent() && epoch === resetEpoch; // 重置之後這一輪即作廢
		// 第六決策點:每次真正出發都重新取號(含世代重抓輪——補抓那發才是這份快照的出發點)。
		// 取號同步,靜止時同步出發的硬契約不變。
		let seq = 0;
		const departing = (): Promise<T> => {
			seq = ledger.depart();
			return opts.fetch();
		};
		const data = await fetchGenStable(departing, () => mutationGen, { iterate: live, pendingSettle });
		// fetchGenStable 回 undefined(棄追)必然是 live 已翻 false——兩個條件都單向不可逆,
		// 故 !live() 同時攔下「過期、已卸載或已重置」與棄追,走到下面的 data 必是真快照。
		// 被超車(已有更晚出發的落地)靜默返回:不等、不重抓;和解因此不 invalidate,resync 照報 resynced。
		if (!live() || ledger.overtaken(seq)) return;
		opts.apply(data as T);
		// 重入防護(F5)(codex B0 r1 追補):與 loadRun 對稱——apply 的 subscriber 可能同步重入頁面的
		// load()(此刻旗標尚未翻,load 不短路);不符即不翻旗。
		if (!isCurrent()) return;
		commit();
	}

	const hydrate = (): Promise<void> => loadRun(ALWAYS);
	const refresh = (): Promise<void> => refreshRun(ALWAYS);

	/** 尾流入帳(第五決策點):tail settle(fulfil 或 reject 都算)才出帳。 */
	function track(tail: Promise<unknown>): void {
		const epoch = resetEpoch; // 這筆尾流記在哪一本帳上
		pendingTails += 1;
		const settled = (): void => {
			if (epoch !== resetEpoch) return; // 帳已被清(reset):這筆不再出帳
			pendingTails -= 1;
			if (pendingTails > 0) return;
			const waiters = settleWaiters;
			settleWaiters = []; // 先清空再喚醒：醒來者若重新排隊，排的是新一批
			waiters.forEach((wake) => wake());
		};
		tail.then(settled, settled); // reject 也出帳（失敗的 mutation 一樣是「不再在飛」）
	}

	/** 宣告 mutation:推世代(在飛快照作廢)+ 翻旗(水合真相成立)。 */
	function bump(): void {
		mutationGen += 1;
		commit();
	}

	/** send 同步拋出收成 rejected promise:同步 throw 與非同步 reject 走同一條失敗路徑。 */
	function sendOf<R>(w: Write<R>): Promise<R> {
		try {
			return w.send();
		} catch (e) {
			return Promise.reject(e);
		}
	}

	/** 和解重抓:序列化 + 失敗可重試 + 幽靈取消(語意逐字取自 R7 session-gate 的 queueReconcile)。
	 *  - 序列化:多支未水合寫入各自排隊、先進先出——後出發的和解快照必然較新且最後套用。
	 *  - 可重試:和解失敗把旗標翻回 false(僅限同一擁有者),下一次 hydrate 重新真抓。
	 *  - 幽靈取消:排隊時的擁有者在起跑前已換人(reset),直接跳過。
	 *  和解快照 vs 後續寫入的殘窗由 refreshRun 的世代穩定重抓閉合(ADR-0020),這裡不多排。 */
	function queueReconcile(): void {
		const owner = resetEpoch;
		reconcileChain = reconcileChain.then(() => {
			if (owner !== resetEpoch) return;
			return refreshRun(ALWAYS).catch(() => {
				if (owner === resetEpoch) invalidate();
			});
		});
	}

	async function write<R>(w: Write<R>): Promise<WriteOutcome<R>> {
		const owner = resetEpoch;
		const wasHydrated = guarded();
		let undo: (() => void) | void = undefined;
		let settled: PromiseSettledResult<R>;
		if (w.optimistic) {
			// 樂觀路徑:整段同步——尾流**先**入帳,才推世代/翻旗(記帳順序是契約)。bump() 的翻旗在
			// 旗標原為 false 時(寫入前尚未水合、或和解失敗把旗標翻回 false)走 false→true 這道邊沿,
			// 會同步通知 subscriber(svelte writable 只對 primitive **相同值**短路);subscriber 若在
			// 那個回呼裡同步重入 refresh(),而尾流還沒入帳,pendingSettle() 就會回 undefined —— GET
			// 帶著已遞增的世代同步出發,settle 後世代比對相符、server 舊真值照樣落地(丟棄軸接不住)。
			// 入帳全程同步,靜止路徑一個 microtask 都不多花。
			undo = w.optimistic();
			const tail = sendOf(w);
			track(tail); // 出帳回呼掛在下面的 await 之前:失敗時 resync 的 refresh 不會等到自己
			bump();
			settled = await settle(tail);
		} else {
			settled = await settle(sendOf(w));
		}
		if (owner !== resetEpoch) return { kind: 'stale', settled }; // 擁有者換人:store 不碰

		if (settled.status === 'fulfilled') {
			// 寫回時重查完整度:進場後旗標可能被「和解失敗」翻回 false(進場快照已失真)。
			const stillIncomplete = !guarded();
			w.commit?.(settled.value);
			if (!w.optimistic) bump(); // 非樂觀:寫回之後才宣告(樂觀路徑進場時已宣告)
			if (!wasHydrated || stillIncomplete) queueReconcile();
			return { kind: 'written', result: settled.value };
		}

		const error = settled.reason;
		const recovery = await recoverWrite(w.onFailure, undo, () => refreshRun(ALWAYS), () => owner !== resetEpoch);
		if (recovery === 'stale') return { kind: 'stale', settled };
		// 樂觀路徑進場時已翻旗:寫入前未水合 → store 只有本地寫入,排和解補齊(非樂觀失敗沒動旗標;
		// resynced 已整包重抓,不必再補;await recoverWrite 期間擁有者換人 → 不在新擁有者身上排)。
		if (recovery !== 'resynced' && w.optimistic && !wasHydrated && owner === resetEpoch) queueReconcile();
		return { kind: 'failed', error, recovery };
	}

	function pendingSettle(): Promise<void> | undefined {
		if (pendingTails === 0) return undefined; // 靜止：同步回 undefined（硬契約，見介面註解）
		return (async () => {
			// 醒來重查：被喚醒到等待者真正恢復執行之間，可能又有尾流入帳（下一筆
			// mark-before-await），不靜止就繼續等——「等到真的靜止」才是這支 promise 的語意。
			while (pendingTails > 0) await new Promise<void>((wake) => settleWaiters.push(wake));
		})();
	}

	function invalidate(): void {
		flag.set(false);
	}

	/** 重置 = 資料擁有者換人(session-gate 的 identity 重置)或測試清單例。清尾流帳並喚醒全部
	 *  等待者(R11 終審修波):舊擁有者一筆掛死的 PATCH 不得讓新擁有者的 refresh 永遠等待(「尾流
	 *  必然 settle」這個自癒前提只在同一擁有者內成立)。被喚醒的舊 refresh 見 resetEpoch 已變即
	 *  收束,喚醒本身不搬運任何資料。 */
	function reset(): void {
		// 帳本(inflight/resetEpoch/pendingTails)必須先於 opts.reset()/翻旗——這兩支才會同步
		// 通知訂閱者,訂閱者若在通知回呼裡同步重入 hydrate(),不得併到重置前那支還在飛的 GET
		// (終審修波:原順序 opts.reset → 翻旗 → 清帳,重入窗口還沒清帳就先開了)。
		inflight = null; // 重置前的在飛 GET 不借給之後進場者
		resetEpoch += 1; // 先換帳本:在飛舊尾流的出帳回呼、重置前出發的落地就此作廢
		pendingTails = 0;
		reconcileChain = Promise.resolve(); // 舊擁有者卡死的和解不得堵住新擁有者的和解鏈
		opts.reset?.();
		flag.set(false);
		const waiters = settleWaiters;
		settleWaiters = []; // 先清空再喚醒:醒來者若重新排隊(新擁有者的尾流),排的是新一批
		waiters.forEach((wake) => wake());
	}

	function pageEntry(): PageEntry {
		return { source: { guarded, load: loadRun, refresh: refreshRun } };
	}

	return { hydrated: { subscribe: flag.subscribe }, hydrate, refresh, invalidate, reset, write, pageEntry };
}
