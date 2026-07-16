/* Dream Fly — member 請假/補課表單機（卡 2，自 LeaveDialog/MakeupDialog 與 mobile 的
 * LeaveSheet/MakeupSheet 四個元件的逐字複製編排抽出）。單檔雙工廠，attendance-controller
 * 形（deps 注入、Readable 快照、outcome 用領域 kind）：createLeaveRequestForm（請假，
 * 有 reason 欄）與 createMakeupBookingForm（補課，無 reason、submit 帶 leaveRequestId）。
 *
 * 進模組的是 machine 機制：場次三態（loading→ready/error；retry = 重呼 load）、
 * valid/in-flight 守衛（submit 擋下時回 null）、reason trim→undefined、submitting 旗標
 * 生命週期；錯誤 outcome 攜帶「原始拋出物」不做翻譯。留元件的是：leaveRequestErrorMessage
 * 映射與 toast 文案（makeup 成功 toast body 桌面/mobile 本有分歧，自然存活）、done 完成
 * 畫面切換、重置時機（dialog 用 lastOpen 守衛呼叫 reset()+load()；sheet 每次 overlay.sheet()
 * 重掛 → 新工廠實例 + onMount load）。
 *
 * deps（getCourseSessions / createLeaveRequest / bookMakeup）皆為注入依賴，無 svelte 元件
 * 相依、建構零副作用（SSR 安全）；sessionId/reason 以 Writable 暴露，供元件頂層解構 const
 * 後 `bind:value={$sessionId}`（Svelte legacy store binding）。 */
import { derived, get, writable, type Readable, type Writable } from 'svelte/store';
import type { CourseSession, LeaveRequest } from './leave';

/** 兩種表單共用的視圖快照：場次三態 + 送出旗標 + valid（= 已選場次）衍生。 */
export interface LeaveFormState {
	sessionsPhase: 'loading' | 'error' | 'ready';
	sessions: CourseSession[];
	submitting: boolean;
	valid: boolean;
}

/** submit() 的結果——領域 kind（非通用 ok/error，ADR 0012 判準③）；failed 攜帶原始
 *  拋出物，繁中文案由呼叫端用 leaveRequestErrorMessage() 自行映射（ADR 0011）。 */
export type LeaveFormOutcome = { kind: 'leaveRequested'; request: LeaveRequest } | { kind: 'failed'; error: unknown };
export type MakeupFormOutcome = { kind: 'makeupBooked'; updated: LeaveRequest } | { kind: 'failed'; error: unknown };

export interface LeaveRequestFormDeps {
	/** 簽名對齊 member/leave.ts 的 getCourseSessions（GET /courses/{id}/sessions）。 */
	getCourseSessions(courseId: string): Promise<CourseSession[]>;
	/** 簽名對齊 member/leave.ts 的 createLeaveRequest（POST /leave-requests）。 */
	createLeaveRequest(sessionId: string, reason?: string): Promise<LeaveRequest>;
}

export interface LeaveRequestForm extends Readable<LeaveFormState> {
	sessionId: Writable<string>;
	reason: Writable<string>;
	/** 三態機：進 loading 後打 deps.getCourseSessions；retry = 再呼叫一次。 */
	load(courseId: string): void;
	reset(): void;
	/** null = 守衛擋下（未選場次或送出中）；reason trim 後空字串 → undefined（省略欄位）。 */
	submit(): Promise<LeaveFormOutcome | null>;
}

export interface MakeupFormDeps {
	getCourseSessions(courseId: string): Promise<CourseSession[]>;
	/** 簽名對齊 member/leave.ts 的 bookMakeup（POST /leave-requests/{id}/makeup）。 */
	bookMakeup(leaveRequestId: string, sessionId: string): Promise<LeaveRequest>;
}

export interface MakeupBookingForm extends Readable<LeaveFormState> {
	sessionId: Writable<string>;
	load(courseId: string): void;
	reset(): void;
	submit(leaveRequestId: string): Promise<MakeupFormOutcome | null>;
}

/* ── 內部共用核心：兩工廠的機制逐字相同（鏡像由建構保證），只差 submit 的 deps 呼叫
 *    與 outcome 詞彙。 ── */

interface SessionsCore {
	sessionsPhase: 'loading' | 'error' | 'ready';
	sessions: CourseSession[];
	submitting: boolean;
}

const initialCore = (): SessionsCore => ({ sessionsPhase: 'loading', sessions: [], submitting: false });

function createFormCore(fetchSessions: (courseId: string) => Promise<CourseSession[]>) {
	const sessionId: Writable<string> = writable('');
	const core = writable<SessionsCore>(initialCore());
	// valid 由 sessionId 衍生（元件原 `$: valid = !!sessionId` 的等價物）；derived 惰性
	// 訂閱，建構仍零副作用。
	const view: Readable<LeaveFormState> = derived([core, sessionId], ([$core, $sessionId]) => ({
		...$core,
		valid: $sessionId !== ''
	}));

	// 逐字複刻元件現行 loadSessions 語意（一如原版，無過期回應守衛：連續 load 時
	// 後到的回應為準——重置時機由呼叫端控制，同現行行為）。
	function load(courseId: string): void {
		core.update((s) => ({ ...s, sessionsPhase: 'loading' }));
		fetchSessions(courseId)
			.then((list) => core.update((s) => ({ ...s, sessions: list, sessionsPhase: 'ready' })))
			.catch(() => core.update((s) => ({ ...s, sessionsPhase: 'error' })));
	}

	function reset(): void {
		sessionId.set('');
		core.set(initialCore());
	}

	/** submit 共用生命週期：守衛（未選場次 | in-flight）→ null；通過後包 submitting 旗標，
	 *  deps 拋錯原樣捕捉為 { kind: 'failed', error }。 */
	async function guardedSubmit<T>(run: (sessionId: string) => Promise<T>): Promise<T | { kind: 'failed'; error: unknown } | null> {
		const sid = get(sessionId);
		if (!sid || get(core).submitting) return null;
		core.update((s) => ({ ...s, submitting: true }));
		try {
			return await run(sid);
		} catch (error) {
			return { kind: 'failed', error };
		} finally {
			core.update((s) => ({ ...s, submitting: false }));
		}
	}

	return { sessionId, view, load, reset, guardedSubmit };
}

export function createLeaveRequestForm(deps: LeaveRequestFormDeps): LeaveRequestForm {
	const reason = writable('');
	const core = createFormCore((courseId) => deps.getCourseSessions(courseId));
	return {
		subscribe: core.view.subscribe,
		sessionId: core.sessionId,
		reason,
		load: core.load,
		reset(): void {
			core.reset();
			reason.set('');
		},
		submit(): Promise<LeaveFormOutcome | null> {
			return core.guardedSubmit(async (sessionId): Promise<LeaveFormOutcome> => {
				const request = await deps.createLeaveRequest(sessionId, get(reason).trim() || undefined);
				return { kind: 'leaveRequested', request };
			});
		}
	};
}

export function createMakeupBookingForm(deps: MakeupFormDeps): MakeupBookingForm {
	const core = createFormCore((courseId) => deps.getCourseSessions(courseId));
	return {
		subscribe: core.view.subscribe,
		sessionId: core.sessionId,
		load: core.load,
		reset: core.reset,
		submit(leaveRequestId: string): Promise<MakeupFormOutcome | null> {
			return core.guardedSubmit(async (sessionId): Promise<MakeupFormOutcome> => {
				const updated = await deps.bookMakeup(leaveRequestId, sessionId);
				return { kind: 'makeupBooked', updated };
			});
		}
	};
}
