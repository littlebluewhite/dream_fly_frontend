/* Dream Fly — 擁有者換人掃描(owner-switch sweep)。
 *
 * 守的規則見 $lib/hydration-gate 檔頭「擁有者判定同一拍」。同一個寫入情境跑 k = 0…K 共 K+1 輪,
 * 每輪在落地之後讓出 k 個 microtask 再換擁有者(閘門 reset() 或真登入換帳號):每個 await 點之後
 * 都有一輪換人落在它和下一步之間,所以之後新增的 await 點也掃得到,不必知道它在哪。
 *
 * K 要比目前最深的鏈(session 閘門寫前水合失敗 + resync,落地後約 14 拍才收束)再留餘裕。
 * 每輪回報「換人那一刻寫入是否已收束」,最後一輪必須已收束——鏈長到比 K 深就紅,不會假綠。 */
import { expect } from 'vitest';

const K = 20;

/** 讓出 n 個 microtask。 */
export async function microtasks(n: number): Promise<void> {
	for (let i = 0; i < n; i++) await Promise.resolve();
}

/** run(k):跑一輪情境(落地 → `await microtasks(k)` → 換擁有者 → 斷言),回傳換人那一刻寫入是否已收束。 */
export async function sweepOwnerSwitch(run: (k: number) => Promise<boolean>): Promise<void> {
	let settledAtSwitch = false;
	for (let k = 0; k <= K; k++) settledAtSwitch = await run(k);
	expect(settledAtSwitch, `K=${K} 不夠深:最後一輪換人時寫入還沒收束,把 K 調大`).toBe(true);
}
