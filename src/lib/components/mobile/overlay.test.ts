import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createOverlay } from './overlay';
import type { MobilePushRegistry, MobileSheetRegistry } from '$lib/mobile/overlay-registry';
import type { MobileAdminPushRegistry, MobileAdminSheetRegistry } from '$lib/mobile-admin/overlay-registry';

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

/* Task 4(Phase 4)：push/sheet 的 props 由註冊表元件推出。下列 `@ts-expect-error` 由
 * `npm run check`(svelte-check 涵蓋 src 下的 *.test.ts)強制——若定型失效(例如退回
 * Record<string, unknown>),該行不再報錯,指令本身變成「未使用」錯誤,check 轉紅。
 * 執行期行為不變(型別錯的呼叫照樣入堆疊),故每案仍斷言 runtime 狀態。
 * 註冊表以 `import type` 引入:本檔不在執行期載入任何 overlay 元件。 */
describe('createOverlay — typed registries (compile-time)', () => {
	it('mobile: props follow the registered component; props-free ids may omit props', () => {
		const o = createOverlay<MobilePushRegistry, MobileSheetRegistry>();
		o.sheet('cart');
		o.push('schedule');
		o.push('courseDetail', { course: null });
		// @ts-expect-error 'cart' 只屬於 sheet 命名空間,不是合法的 push id
		o.push('cart');
		// @ts-expect-error 'course' sheet 的 props 是 course,不收 leaveRequest(那是 makeup 的)
		o.sheet('course', { leaveRequest: null });
		// @ts-expect-error course 型別不符
		o.sheet('leave', { course: 42 });
		// @ts-expect-error onClose 由 host 注入,呼叫端不可傳
		o.sheet('contact', { onClose: () => {} });
		expect(get(o).stack.map((e) => e.id)).toEqual(['schedule', 'courseDetail', 'cart']);
		expect(get(o).sheet).toEqual({ id: 'contact', props: { onClose: expect.any(Function) } });
	});

	it('mobile-admin: required props must be passed', () => {
		const o = createOverlay<MobileAdminPushRegistry, MobileAdminSheetRegistry>();
		o.sheet('role', { role: 'admin', setRole: () => {} });
		// @ts-expect-error role sheet 的 role / setRole 必填,不可省略 props
		o.sheet('role');
		// @ts-expect-error 缺必填 setRole
		o.sheet('role', { role: 'admin' });
		// @ts-expect-error member sheet 的 onEdit 必填(無 fallback)
		o.sheet('member', { m: null });
		// @ts-expect-error onBack 由 host 注入,呼叫端不可傳
		o.push('coaches', { onBack: () => {} });
		expect(get(o).sheet).toEqual({ id: 'member', props: { m: null } });
		expect(get(o).stack).toEqual([{ id: 'coaches', props: { onBack: expect.any(Function) } }]);
	});
});
