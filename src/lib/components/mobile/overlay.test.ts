import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createOverlay } from './overlay';

/* Task 1(1.5)：createOverlay 的直接單元測試單源於這裡(ADR-0010「死值不留死出口」)
 * ——mobile/stores.ts 與 mobile-admin/stores.ts 過去各自把 createOverlay（連同
 * OverlayEntry/OverlayState 兩個型別）純轉出，只是給各自的 stores.test.ts 建立
 * 獨立實例用，overlay singleton 本身不靠這個轉出（見兩邊 stores.ts 直接
 * `import { createOverlay } from '$lib/components/mobile/overlay'` 自建
 * singleton）。兩邊 stores.test.ts 原本各自一份幾乎逐字重複的 createOverlay
 * 案例（push/pop、sheet 開關、closeAll）搬來這裡合併成一份，直接測本體。 */
describe('createOverlay', () => {
	it('pushes and pops the screen stack', () => {
		const o = createOverlay();
		o.push('courseDetail', { course: { id: 'k1' } });
		expect(get(o).stack).toHaveLength(1);
		expect(get(o).stack[0]).toEqual({ id: 'courseDetail', props: { course: { id: 'k1' } } });
		o.pop();
		expect(get(o).stack).toHaveLength(0);
	});

	it('opens and closes a sheet', () => {
		const o = createOverlay();
		o.sheet('cart');
		expect(get(o).sheet).toEqual({ id: 'cart', props: {} });
		o.closeSheet();
		expect(get(o).sheet).toBe(null);
	});

	it('closeAll clears both the stack and the sheet (used on tab change)', () => {
		const o = createOverlay();
		o.push('schedule');
		o.sheet('leave');
		o.closeAll();
		expect(get(o).stack).toHaveLength(0);
		expect(get(o).sheet).toBe(null);
	});

	it('pushes / pops the stack and opens / closes a sheet with props (admin surface shape)', () => {
		const o = createOverlay();
		o.push('coaches');
		o.sheet('member', { m: { id: 'GY1' } });
		expect(get(o).stack[0]).toEqual({ id: 'coaches', props: {} });
		expect(get(o).sheet).toEqual({ id: 'member', props: { m: { id: 'GY1' } } });
		o.closeAll();
		expect(get(o).stack).toHaveLength(0);
		expect(get(o).sheet).toBe(null);
	});
});
