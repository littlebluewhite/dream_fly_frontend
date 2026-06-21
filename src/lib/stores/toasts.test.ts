import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createToasts } from './toasts';

describe('canonical toast store', () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	// --- ported from src/lib/admin/stores.test.ts ---

	it('notify appends a toast carrying tone/title/body', () => {
		const toasts = createToasts();
		toasts.notify('success', '已儲存', '課程已更新');
		const list = get(toasts);
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id: 1, tone: 'success', title: '已儲存', body: '課程已更新' });
	});

	it('defaults body to an empty string', () => {
		const toasts = createToasts();
		toasts.notify('info', '通知');
		expect(get(toasts)[0].body).toBe('');
	});

	it('auto-dismisses after exactly 4000ms', () => {
		const toasts = createToasts();
		toasts.notify('warning', '逾時');
		expect(get(toasts)).toHaveLength(1);
		vi.advanceTimersByTime(3999);
		expect(get(toasts)).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(get(toasts)).toHaveLength(0);
	});

	it('dismiss removes one toast immediately by id, leaving the rest', () => {
		const toasts = createToasts();
		const id = toasts.notify('error', '錯誤');
		toasts.notify('info', '另一則');
		toasts.dismiss(id);
		const list = get(toasts);
		expect(list).toHaveLength(1);
		expect(list[0].title).toBe('另一則');
	});

	// --- new behaviours (dedup / cap / unbound alias) ---

	it('dedup: identical (tone,title,body) returns same id and keeps only 1 entry', () => {
		const toasts = createToasts();
		const id1 = toasts.notify('info', 'hello', 'world');
		const id2 = toasts.notify('info', 'hello', 'world');
		expect(id2).toBe(id1);
		expect(get(toasts)).toHaveLength(1);
	});

	it('dedup: resets the expiry timer on a duplicate (old deadline is abandoned)', () => {
		const toasts = createToasts();
		toasts.notify('info', 'hello');
		vi.advanceTimersByTime(3500); // close to original 4000ms deadline
		// duplicate — resets to a fresh 4000ms from NOW
		toasts.notify('info', 'hello');
		vi.advanceTimersByTime(3999); // should still be alive
		expect(get(toasts)).toHaveLength(1);
		vi.advanceTimersByTime(1); // now it expires
		expect(get(toasts)).toHaveLength(0);
	});

	it('cap: pushing 5 distinct toasts keeps only the newest 4 (FIFO evict)', () => {
		const toasts = createToasts();
		toasts.notify('info', 'a');
		toasts.notify('info', 'b');
		toasts.notify('info', 'c');
		toasts.notify('info', 'd');
		toasts.notify('info', 'e'); // should evict 'a'
		const list = get(toasts);
		expect(list).toHaveLength(4);
		expect(list.map((t) => t.title)).toEqual(['b', 'c', 'd', 'e']);
	});

	it('unbound alias: const notify = toasts.notify; notify(...) still works', () => {
		const toasts = createToasts();
		const notify = toasts.notify;
		const id = notify('success', '無 this');
		const list = get(toasts);
		expect(list).toHaveLength(1);
		expect(list[0].id).toBe(id);
	});
});
