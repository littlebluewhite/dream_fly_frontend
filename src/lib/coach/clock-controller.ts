/* Dream Fly — coach 儀表板打卡編排層（自 coach/+page.svelte 的打卡編排抽出）。
 * 進頁面時以 isClockedIn()（最新一筆 clock-record）做開機狀態查詢（hydrate），之後為
 * 本地樂觀狀態；clockIn 409（已在上班中）/clockOut 404（尚未上班）時，用回應校正回
 * 正確的本地狀態，不只是回報錯誤——ApiError 409/404 的分類在此層，toast 文案逐字
 * 留頁面（outcome → toast switch）。
 *
 * hydrate 的 mutation-wins 守衛：手動打卡後（clockTouched，留內部不進視圖），開機
 * 查詢的過期結果一律丟棄（回 stale）——同 mobile-admin hydrate guard 的「mutation
 * 永遠贏過 in-flight fetch」原則（docs/architecture.md）。isClockedIn 為最佳努力
 * （失敗一律回 false，見 coach/clock.ts），hydrate 不另設 catch。
 *
 * 刻意不加 busy 早退守衛——今日防雙擊只靠頁面 disabled={clocking}，加了是行為變更。
 * deps 注入（clockIn/clockOut/isClockedIn），無 svelte 元件相依、建構零副作用（SSR 安全）。 */
import { writable, type Readable } from 'svelte/store';
import { ApiError } from '$lib/api/client';

export interface ClockViewState {
	clockedIn: boolean;
	clocking: boolean;
}

/** deps 回傳型別用 Promise<unknown>：controller 不讀回傳值，coach/clock.ts 的真函式
 *  （Promise<ClockRecord>）協變可直接指派。 */
export interface ClockControllerDeps {
	clockIn: (coachId: string) => Promise<unknown>;
	clockOut: (coachId: string) => Promise<unknown>;
	isClockedIn: (coachId: string) => Promise<boolean>;
}

/** 409（已在上班中）已在 controller 內校正 clockedIn=true，頁面只負責 toast。 */
export type ClockInOutcome = { kind: 'clockedIn' } | { kind: 'alreadyClockedIn' } | { kind: 'failed'; error: unknown };
/** 404（尚未上班）已在 controller 內校正 clockedIn=false，頁面只負責 toast。 */
export type ClockOutOutcome = { kind: 'clockedOut' } | { kind: 'notClockedIn' } | { kind: 'failed'; error: unknown };
/** stale = 查詢往返期間使用者已手動打卡，結果丟棄（mutation wins）。 */
export type ClockHydrateOutcome = { kind: 'hydrated'; clockedIn: boolean } | { kind: 'stale' };

export interface ClockController extends Readable<ClockViewState> {
	hydrate(coachId: string): Promise<ClockHydrateOutcome>;
	clockIn(coachId: string): Promise<ClockInOutcome>;
	clockOut(coachId: string): Promise<ClockOutOutcome>;
}

export function createClockController(deps: ClockControllerDeps): ClockController {
	let clockedIn = false;
	let clocking = false;
	let clockTouched = false; // 手動打卡後，開機查詢的過期結果不得覆寫（mutation wins）——
	// 旗標刻意不復位：任何 mutation 之後起飛的 hydrate 也一律 stale。hydrate 只服務
	// 首次開機，與頁面時代語意逐字一致（現行 ErrorState retry 不會重進 hydrate）。

	const store = writable<ClockViewState>({ clockedIn, clocking });
	const publish = (): void => store.set({ clockedIn, clocking });

	async function hydrate(coachId: string): Promise<ClockHydrateOutcome> {
		const active = await deps.isClockedIn(coachId);
		if (clockTouched) return { kind: 'stale' };
		clockedIn = active;
		publish();
		return { kind: 'hydrated', clockedIn: active };
	}

	async function clockIn(coachId: string): Promise<ClockInOutcome> {
		clockTouched = true;
		clocking = true;
		publish();
		try {
			await deps.clockIn(coachId);
			clockedIn = true;
			return { kind: 'clockedIn' };
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				clockedIn = true; // 已在上班中——用回應校正本地狀態，不只是回報錯誤
				return { kind: 'alreadyClockedIn' };
			}
			return { kind: 'failed', error };
		} finally {
			clocking = false;
			publish();
		}
	}

	async function clockOut(coachId: string): Promise<ClockOutOutcome> {
		clockTouched = true;
		clocking = true;
		publish();
		try {
			await deps.clockOut(coachId);
			clockedIn = false;
			return { kind: 'clockedOut' };
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) {
				clockedIn = false; // 尚未上班——用回應校正本地狀態，不只是回報錯誤
				return { kind: 'notClockedIn' };
			}
			return { kind: 'failed', error };
		} finally {
			clocking = false;
			publish();
		}
	}

	return { subscribe: store.subscribe, hydrate, clockIn, clockOut };
}
