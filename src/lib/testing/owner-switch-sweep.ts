/* Dream Fly — 擁有者換人掃描(owner-switch sweep)。
 *
 * 守的規則見 $lib/hydration-gate 檔頭「擁有者判定同一拍」。同一個寫入情境跑 k = 0…K 共 K+1 輪,
 * 每輪在落地之後讓出 k 個 microtask 再換擁有者(閘門 reset() 或真登入換帳號),收束後看得到的狀態必須
 * 是新擁有者的開機值:每個 await 點之後都有一輪換人落在它和下一步之間,所以之後新增的 await 點也掃得到,
 * 不必知道它在哪。
 *
 * K 要比目前最深的鏈(session 閘門寫前水合失敗 + resync、重抓也失敗,落地後約 10 拍才不再變)再留餘裕。最後再跑一輪
 * 不換人的對照:第 K 拍之後看得到的狀態不能再變,也就是整條鏈(含排隊的和解)在 K 拍內收束。鏈長到比
 * K 深就紅,不會假綠。 */
import { expect } from 'vitest';

export const K = 20;

/** 讓出 n 個 microtask。 */
export async function microtasks(n: number): Promise<void> {
	for (let i = 0; i < n; i++) await Promise.resolve();
}

/** 一輪情境。setup 建好全新的閘門與 store、寫入已出發;land 讓 send 落地(同步,k=0 才是同一拍);
 *  switchOwner 換擁有者;observe 回看得到的狀態(換人後的 fetch 次數、store、旗標)。 */
export type OwnerSwitchRound = {
	land: () => void;
	switchOwner: () => unknown;
	observe: () => unknown;
};

/** 每輪換人、收束後 observe() 要等於 fresh(新擁有者的開機值);最後一輪不換人的對照證明鏈在 K 拍內收束。 */
export async function sweepOwnerSwitch(fresh: unknown, setup: () => Promise<OwnerSwitchRound>): Promise<void> {
	for (let k = 0; k <= K; k++) {
		const round = await setup();
		round.land();
		await microtasks(k);
		await round.switchOwner();
		await settle();
		expect(round.observe(), `k=${k}:舊寫入改了新擁有者看得到的狀態`).toEqual(fresh);
	}
	const control = await setup();
	control.land();
	await microtasks(K);
	const atK = control.observe();
	await settle();
	expect(control.observe(), `K=${K} 不夠深:不換人時第 K 拍之後狀態還在變,把 K 調大`).toEqual(atK);
}

/** 跳一個 macrotask,期間的 microtask 全數收束。 */
function settle(): Promise<void> {
	return new Promise<void>((r) => setTimeout(r, 0));
}
