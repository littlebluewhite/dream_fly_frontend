import { vi } from 'vitest';

/** 極小 fake router：依 "METHOD path" key 回應覆寫值；overrides 優先於 defaults，
 *  兩者都未覆寫時一律丟錯──呼叫到沒被交代的端點應該讓測試失敗，而不是悄悄回傳
 *  undefined 蓋掉斷言。覆寫值可以是函式（呼叫時傳入該次呼叫的 RequestInit；舊式
 *  零參數 thunk 一樣相容）——F2 race 釘的兩段式 GET、讀 body 決定回應的 preset
 *  （如 POST /waitlist）都靠這個表達。
 *  升格自 member/checkout-api.test.ts:58-62 的「極小 fake router」。 */
export function fakeRouter(overrides: Record<string, unknown>, defaults: Record<string, unknown> = {}) {
	return vi.fn(async (path: string, init: RequestInit = {}) => {
		const method = (init.method ?? 'GET').toString().toUpperCase();
		const key = `${method} ${path}`;
		const table = key in overrides ? overrides : key in defaults ? defaults : undefined;
		if (!table) throw new Error(`unexpected api call: ${key}`);
		const raw = table[key];
		const value = typeof raw === 'function' ? raw(init) : raw;
		if (value instanceof Error) throw value;
		return value;
	});
}
