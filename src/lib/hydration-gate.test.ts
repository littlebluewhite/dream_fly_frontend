import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { createHydrationGate } from './hydration-gate';

/** 手動控時序的 deferred promise——測 in-flight 競態不用 fake timers（抄
 *  load-gate.test.ts 開頭寫法）。 */
function createDeferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('createHydrationGate', () => {
	it('競態(本 factory 存在的理由):hydrate() in-flight 期間 markMutated() → fetch resolve 後 apply 不被呼叫、promise 正常 resolve', async () => {
		const d = createDeferred<{ v: number }>();
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch: () => d.promise, apply });

		const hydratePromise = gate.hydrate();
		expect(get(gate.hydrated)).toBe(false); // in-flight,尚未水合

		gate.markMutated(); // mutation 發生於 in-flight 期間 — 宣告本地資料即水合真相
		expect(get(gate.hydrated)).toBe(true);

		d.resolve({ v: 1 });
		await hydratePromise; // re-check 應放棄套用,promise 正常 resolve(不 reject)

		expect(apply).not.toHaveBeenCalled();
		expect(get(gate.hydrated)).toBe(true); // mutation 的旗子保留,沒被覆寫或重置
	});

	it('guard:hydrated 已 true 時 hydrate() 不呼叫 fetch', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		gate.hydrated.set(true);

		await gate.hydrate();

		expect(fetch).not.toHaveBeenCalled();
		expect(apply).not.toHaveBeenCalled();
	});

	it('guard:hydrated 為 false 時正常走 fetch → apply → hydrated=true', async () => {
		const data = { v: 1 };
		const fetch = vi.fn(async () => data);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		await gate.hydrate();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith(data);
		expect(get(gate.hydrated)).toBe(true);
	});

	it('refresh() 無條件:hydrated 已 true 仍真的呼叫 fetch 並 apply', async () => {
		const data = { v: 2 };
		const fetch = vi.fn(async () => data);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		gate.hydrated.set(true);

		await gate.refresh();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith(data);
		expect(get(gate.hydrated)).toBe(true);
	});

	it('refresh() 的 fetch rejection 原樣拋出,apply 不被呼叫', async () => {
		const err = new Error('boom');
		const fetch = vi.fn(async () => {
			throw err;
		});
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		await expect(gate.refresh()).rejects.toThrow('boom');

		expect(apply).not.toHaveBeenCalled();
	});

	it('hydrate() 的 fetch rejection 原樣拋出,apply 不被呼叫、hydrated 維持 false', async () => {
		const err = new Error('boom');
		const fetch = vi.fn(async () => {
			throw err;
		});
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		await expect(gate.hydrate()).rejects.toThrow('boom');

		expect(apply).not.toHaveBeenCalled();
		expect(get(gate.hydrated)).toBe(false);
	});

	it('markMutated() 把 hydrated 翻 true;hydrated.set(false) 後可再次水合(測試重置縫)', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		gate.markMutated();
		expect(get(gate.hydrated)).toBe(true);

		gate.hydrated.set(false);
		await gate.hydrate();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 1 });
		expect(get(gate.hydrated)).toBe(true);
	});
});
