import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createToasts, search } from './stores';

describe('admin toasts', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

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
});

describe('admin search store', () => {
	it('is a writable string store starting empty', () => {
		expect(get(search)).toBe('');
		search.set('王');
		expect(get(search)).toBe('王');
		search.set('');
	});
});
