/* Dream Fly — member/mine 內層編排層（R10 架構深化 D 案，自 +page.svelte 的雙閘門
 * 協調抽出）。仿 coach/messages-controller.ts 的「單一快照 store + 效應注入」分層、
 * member/cancel-leave.ts 的 busy 守衛先例。
 *
 * 收斂範圍：出席明細載入（selectCourse/retryAttendance，內部化 getEnrolmentAttendance
 * 的選課→fetch 協調）、取消候補（cancelWaitlistEntry，busy 守衛 + outcome，逐字複刻
 * cancel-leave.ts 的 createCancelLeave 形）。
 *
 * 不收：外層課程清單載入（getMine gate 留頁面——ADR 0008 LoadGate 呼叫點不動）、我的
 * 請假清單與取消請假（既有 cancel-leave.ts 雙生模組，mobile MyCourseDetail 共用，本輪
 * 不建第二個雙生模組——mobile 無取消候補 UI，候補域無跨 surface 共用需求已實證）、
 * toast 文案（頁面據 outcome 翻譯，同 messages-controller/cancel-leave 判準）。
 *
 * selectCourse(id) 的「先寫 active 再 load」不變式從註解升格為結構保證：寫入 active
 * 與觸發 fetch 在同一個同步呼叫序列內完成，且 fetchAttendance 直接吃參數 id（不回頭
 * 讀 active 閉包），不會有「忘記先寫」或「順序顛倒」的邊界寫法。fetchAttendance 內建
 * 的 stale-guard 仿 attendance-controller.ts 的 save-token guard 先例（機制同構，僅
 * 操作換成 fetch）：每次觸發 ++seq 並捕捉 token，resolve 與 reject 皆驗 token===seq，
 * 不符即丟棄過期回應——快速連續切課時，較舊課程遲到回應的出席明細不會覆蓋目前選取
 * 課程的資料（與 load-gate.ts 的 generation 世代語意一致）。
 *
 * 無 svelte 元件相依、建構零副作用（SSR 安全）。 */
import { writable, type Readable } from 'svelte/store';
import type { AttRecord } from '$lib/domain/member-app';
import type { WaitlistEntry } from './waitlist';

export interface MineViewState {
	/** 目前選取的報名 id；null = 尚未選取（建構時，或 init(null) 收到無課程）。 */
	active: string | null;
	/** 出席明細的三態載入閘門——機制內建在本 controller（不透過 $lib/load-gate：出席
	 *  明細的載入時機綁在 selectCourse，不是獨立的 onMount 一次性載入，不套用共用
	 *  factory）。 */
	attState: 'loading' | 'error' | 'ready';
	/** 僅 attState==='ready' 時語意成立；loading/error 時維持上一輪（或初始空陣列）的
	 *  值，頁面三分支只在 ready 分支讀它。 */
	attendance: AttRecord[];
	/** busy 守衛旗標；非 null = 該候補 entry 正在取消中（比照 cancel-leave.ts 的
	 *  cancellingLeaveId）。 */
	cancellingId: string | null;
}

/** cancelWaitlistEntry() 的結果——領域 kind（非通用 ok/error，同 cancel-leave.ts 判準）；
 *  failed 攜帶原始拋出物，繁中文案由呼叫端自行決定（本域沿用頁面既有的通用「取消候補
 *  失敗，請稍後再試」文案，不像 leave 域有 leaveRequestErrorMessage 映射）。 */
export type CancelWaitlistOutcome =
	| { kind: 'waitlistCancelled'; courseName: string }
	| { kind: 'failed'; error: unknown };

export interface MineControllerDeps {
	/** 簽名對齊 member/api.ts 的 getEnrolmentAttendance（GET /enrolments/{id}/attendance，
	 *  §3.12）。 */
	getEnrolmentAttendance(id: string): Promise<AttRecord[]>;
	/** 簽名對齊 member/waitlist.ts 的 cancelWaitlist（DELETE /waitlist/{id}，經
	 *  waitlist.ts 的 gate.write；水合/和解重抓機制留在該模組，本 controller 只是
	 *  呼叫端）。 */
	cancelWaitlist(id: string): Promise<void>;
}

export interface MineController extends Readable<MineViewState> {
	/** getMine() 成功後由頁面呼叫一次：firstCourseId 為 `data.courses[0]?.id ?? null`。
	 *  null（無課程）→ attState 直接收斂 ready + attendance 空陣列，不觸發 fetch；
	 *  非 null → 等價 selectCourse(firstCourseId)。 */
	init(firstCourseId: string | null): void;
	/** 切換選取課程；同課 id 重複呼叫為去重 no-op（不 refetch）。 */
	selectCourse(id: string): void;
	/** 出席明細載入失敗後的重試；針對目前 active 課程重新 fetch（結構上 active 必為
	 *  非 null——重試按鈕只在 attState==='error' 分支渲染，而該分支的前提是先前已經
	 *  selectCourse 過；active 仍為 null 時靜默不做事，型別層防護，同
	 *  messages-controller.ts 的 send() 先例）。 */
	retryAttendance(): void;
	/** DELETE /waitlist/{id}。busy 守衛：in-flight 期間再呼叫回 null，不重複打
	 *  deps.cancelWaitlist（比照 cancel-leave.ts 的 createCancelLeave）。 */
	cancelWaitlistEntry(w: WaitlistEntry): Promise<CancelWaitlistOutcome | null>;
}

export function createMineController(deps: MineControllerDeps): MineController {
	let active: string | null = null;
	let attState: 'loading' | 'error' | 'ready' = 'loading';
	let attendance: AttRecord[] = [];
	let cancellingId: string | null = null;
	// fetchAttendance 的 stale-guard（仿 attendance-controller.ts 的 save-token guard
	// 先例）：遞增序號，resolve/reject 皆驗 token===seq，不符即丟棄過期回應。
	let seq = 0;

	function viewState(): MineViewState {
		return { active, attState, attendance, cancellingId };
	}
	const store = writable<MineViewState>(viewState());
	const publish = (): void => store.set(viewState());

	/** 觸發出席明細 fetch；呼叫端（selectCourse/retryAttendance）已負責 active 的
	 *  寫入時機，本函式只吃參數 id、不回讀 active 閉包（結構保證「先寫後抓」，見
	 *  檔頭附註）。 */
	function fetchAttendance(id: string): void {
		attState = 'loading';
		publish();
		const token = ++seq;
		deps.getEnrolmentAttendance(id).then(
			(data) => {
				if (token !== seq) return; // 過期回應，丟棄（較新的選取/重試已接手）
				attendance = data;
				attState = 'ready';
				publish();
			},
			() => {
				if (token !== seq) return;
				attState = 'error';
				publish();
			}
		);
	}

	function selectCourse(id: string): void {
		if (id === active) return; // 去重：同課 id 再選不 refetch
		active = id; // 先寫 selection……
		fetchAttendance(id); // ……再觸發 fetch（結構保證，見檔頭附註）
	}

	function init(firstCourseId: string | null): void {
		if (firstCourseId === null) {
			active = null;
			attState = 'ready';
			attendance = [];
			publish();
			return;
		}
		selectCourse(firstCourseId);
	}

	function retryAttendance(): void {
		if (active === null) return; // 結構上不可達，型別層防護（見介面註解）
		fetchAttendance(active);
	}

	/** busy 守衛 + outcome 生命週期逐字複刻 cancel-leave.ts 的 createCancelLeave。 */
	async function cancelWaitlistEntry(w: WaitlistEntry): Promise<CancelWaitlistOutcome | null> {
		if (cancellingId) return null;
		cancellingId = w.id;
		publish();
		try {
			await deps.cancelWaitlist(w.id);
			return { kind: 'waitlistCancelled', courseName: w.course_name };
		} catch (error) {
			return { kind: 'failed', error };
		} finally {
			cancellingId = null;
			publish();
		}
	}

	return { subscribe: store.subscribe, init, selectCourse, retryAttendance, cancelWaitlistEntry };
}
