import { describe, it, expect } from 'vitest';
import { getRelativeTime } from './timeUtils';

/* getRelativeTime — now 為 seam(預設參數 `new Date()`),測試一律注入固定 now 取代真實
 * 時鐘,7 個分支各自邊界值 + 預設路徑(不傳 now)各一。past/now 皆用本地時間構造子
 * (`new Date(y, m, d, h, mi, s)`)組出,再取 `.toISOString()` 當 timestamp 傳入——
 * 避免 ISO 字串在不同時區換算成不同日曆日造成的假性 flaky。 */
describe('getRelativeTime', () => {
	it('未滿 60 秒 → 剛剛', () => {
		const now = new Date(2026, 0, 1, 0, 1, 0);
		const past = new Date(2026, 0, 1, 0, 0, 30); // 30 秒前
		expect(getRelativeTime(past.toISOString(), now)).toBe('剛剛');
	});

	it('未滿 60 分鐘(且 ≥60 秒)→ N 分鐘前', () => {
		const now = new Date(2026, 0, 1, 0, 10, 0);
		const past = new Date(2026, 0, 1, 0, 5, 0); // 5 分鐘前
		expect(getRelativeTime(past.toISOString(), now)).toBe('5分鐘前');
	});

	it('未滿 24 小時(且 ≥60 分鐘)→ N 小時前', () => {
		const now = new Date(2026, 0, 1, 3, 0, 0);
		const past = new Date(2026, 0, 1, 0, 0, 0); // 3 小時前
		expect(getRelativeTime(past.toISOString(), now)).toBe('3小時前');
	});

	it('恰為 1 天(24–47 小時)→ 昨天', () => {
		const now = new Date(2026, 0, 2, 6, 0, 0);
		const past = new Date(2026, 0, 1, 0, 0, 0); // 30 小時前
		expect(getRelativeTime(past.toISOString(), now)).toBe('昨天');
	});

	it('未滿 30 天(且非 1 天)→ N 天前', () => {
		const now = new Date(2026, 0, 6, 0, 0, 0);
		const past = new Date(2026, 0, 1, 0, 0, 0); // 5 天前
		expect(getRelativeTime(past.toISOString(), now)).toBe('5天前');
	});

	it('超過 30 天 → 日期 fallback,月/日不補零', () => {
		const now = new Date(2026, 2, 1, 12, 0, 0); // 2026/03/01
		const past = new Date(2026, 0, 3, 12, 0, 0); // 2026/01/03 — 月=1、日=3 皆個位數
		expect(getRelativeTime(past.toISOString(), now)).toBe('2026/1/3');
	});

	it('預設路徑:不傳 now 時以呼叫當下的 new Date() 為基準', () => {
		const past = new Date(Date.now() - 30 * 1000); // 30 秒前(相對真實時鐘)
		expect(getRelativeTime(past.toISOString())).toBe('剛剛');
	});
});
