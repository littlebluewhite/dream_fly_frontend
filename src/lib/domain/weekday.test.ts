import { describe, it, expect } from 'vitest';
import { DAY_KEYS, WEEKDAY_ZH, toWeekColumn } from './weekday';

/* 星期換算單一模組——後端 day_of_week 0=Sunday（= Date.getDay()），週課表欄位 0=Monday。 */
describe('weekday — DAY_KEYS / WEEKDAY_ZH 依 day_of_week 排列', () => {
	it('DAY_KEYS 以 Sun 起頭，index = Date.getDay()', () => {
		expect(DAY_KEYS).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
	});

	it('WEEKDAY_ZH 以「日」起頭，index = Date.getDay()', () => {
		expect(WEEKDAY_ZH).toEqual(['日', '一', '二', '三', '四', '五', '六']);
	});

	it('index 對 Date.getDay()：2026-05-30 是週六', () => {
		const sat = new Date(2026, 4, 30);
		expect(DAY_KEYS[sat.getDay()]).toBe('Sat');
		expect(WEEKDAY_ZH[sat.getDay()]).toBe('六');
	});
});

describe('toWeekColumn — day_of_week（0=日）→ 週課表欄位（0=一）', () => {
	it.each([
		[0, 6], // 日 → 欄 6
		[1, 0], // 一 → 欄 0
		[2, 1],
		[3, 2],
		[4, 3],
		[5, 4],
		[6, 5] // 六 → 欄 5
	])('day_of_week %i → 欄位 %i', (dow, col) => {
		expect(toWeekColumn(dow)).toBe(col);
	});
});
