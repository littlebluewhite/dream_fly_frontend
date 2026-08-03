/* Dream Fly — RevenueTrend.svelte 元件測試(R10 架構深化 E 案)。charts.test.ts 涵蓋
 * 的 13 個還原面板裡本來就沒有 RevenueTrend(它是 Task 15 復刻,非 P4-F2 那批),而
 * 本案又是它唯一被動到公式的一支——桌面原本內嵌的 (d.h/max)*160 高度算式收進
 * revenueTrendVM() 的 heights[](R10 架構深化 E 案),故補上專屬元件測試，同
 * charts.test.ts 其餘面板「真資料一態 + 全零一態」的驗證方式。 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RevenueTrend from './RevenueTrend.svelte';
import type { TrendBar } from '$lib/admin/data';

const ROWS: TrendBar[] = [
	{ m: '2025-08', h: 300000 },
	{ m: '2025-09', h: 320000 },
	{ m: '2025-10', h: 458200 }
];

describe('RevenueTrend (12-month bar chart)', () => {
	it('renders the peak month at 160px (REPORT_SCALES.revenueTrend.desktop) and the summed 總計', () => {
		const { container } = render(RevenueTrend, { rows: ROWS });
		const heights = Array.from(container.querySelectorAll('.bar')).map(
			(b) => (b as HTMLElement).style.height
		);
		expect(heights[2]).toBe('160px'); // 458200 為最大月,滿高
		expect(container.textContent).toContain('總計 NT$1,078,200');
	});

	it('全 0 renders zero-height bars, no NaN', () => {
		const zeroRows: TrendBar[] = ROWS.map((r) => ({ ...r, h: 0 }));
		const { container } = render(RevenueTrend, { rows: zeroRows });
		const heights = Array.from(container.querySelectorAll('.bar')).map(
			(b) => (b as HTMLElement).style.height
		);
		expect(heights).toEqual(['0px', '0px', '0px']);
		expect(container.innerHTML).not.toContain('NaN');
	});
});
