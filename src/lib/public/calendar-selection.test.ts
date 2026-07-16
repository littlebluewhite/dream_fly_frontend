import { describe, it, expect } from 'vitest';
import {
	previousMonth,
	nextMonth,
	selectDate,
	selectTimeSlot,
	slotLabel,
	isSlotDisabled,
	type CalendarSelection
} from './calendar-selection';
import type { ApiTimeSlot } from '$lib/public/api';

function makeSlot(overrides: Partial<ApiTimeSlot> = {}): ApiTimeSlot {
	return {
		id: 'slot-1',
		date: '2026-07-15',
		start_time: '10:00:00',
		end_time: '11:30:00',
		venue_id: null,
		course_id: null,
		capacity: 10,
		booked: 3,
		status: 'available',
		...overrides
	};
}

/** 預設日/時段皆已選：雙選取清空的 case 可直接證偽。 */
function makeSel(overrides: Partial<CalendarSelection> = {}): CalendarSelection {
	return {
		currentDate: new Date(2026, 6, 15),
		selectedDate: new Date(2026, 6, 20),
		selectedTimeSlot: '10:00-11:30',
		...overrides
	};
}

describe('previousMonth / nextMonth（±1 月錨定 1 日）', () => {
	it('上一月：2026-07-15 → 2026-06-01', () => {
		const next = previousMonth(makeSel());
		expect([
			next.currentDate.getFullYear(),
			next.currentDate.getMonth(),
			next.currentDate.getDate()
		]).toEqual([2026, 5, 1]);
	});

	it('下一月：2026-07-15 → 2026-08-01', () => {
		const next = nextMonth(makeSel());
		expect([
			next.currentDate.getFullYear(),
			next.currentDate.getMonth(),
			next.currentDate.getDate()
		]).toEqual([2026, 7, 1]);
	});

	it('跨年邊界：1 月往前借位到前一年 12 月、12 月往後進位到次年 1 月', () => {
		const prev = previousMonth(makeSel({ currentDate: new Date(2026, 0, 15) }));
		expect([
			prev.currentDate.getFullYear(),
			prev.currentDate.getMonth(),
			prev.currentDate.getDate()
		]).toEqual([2025, 11, 1]);

		const next = nextMonth(makeSel({ currentDate: new Date(2026, 11, 15) }));
		expect([
			next.currentDate.getFullYear(),
			next.currentDate.getMonth(),
			next.currentDate.getDate()
		]).toEqual([2027, 0, 1]);
	});

	it('日/時段雙選取一併清空', () => {
		const sel = makeSel();
		expect(previousMonth(sel).selectedDate).toBeNull();
		expect(previousMonth(sel).selectedTimeSlot).toBeNull();
		expect(nextMonth(sel).selectedDate).toBeNull();
		expect(nextMonth(sel).selectedTimeSlot).toBeNull();
	});
});

describe('selectDate', () => {
	it('以當月年/月 + day 組出選取日，清空已選時段，currentDate 不動', () => {
		const sel = makeSel();
		const next = selectDate(sel, 8);
		expect(next.selectedDate?.getTime()).toBe(new Date(2026, 6, 8).getTime());
		expect(next.selectedTimeSlot).toBeNull();
		expect(next.currentDate).toBe(sel.currentDate);
	});

	it('不變異輸入：回傳新物件，原三欄位原封不動', () => {
		const sel = makeSel();
		const before = { ...sel };
		const beforeTime = sel.currentDate.getTime();
		const next = selectDate(sel, 8);
		expect(next).not.toBe(sel);
		expect(sel.currentDate).toBe(before.currentDate);
		expect(sel.currentDate.getTime()).toBe(beforeTime);
		expect(sel.selectedDate).toBe(before.selectedDate);
		expect(sel.selectedTimeSlot).toBe(before.selectedTimeSlot);
	});
});

describe('selectTimeSlot', () => {
	it('可選時段：寫入 slotLabel 字串，當月/選取日不動', () => {
		const sel = makeSel({ selectedTimeSlot: null });
		const next = selectTimeSlot(sel, makeSlot());
		expect(next.selectedTimeSlot).toBe('10:00-11:30');
		expect(next.currentDate).toBe(sel.currentDate);
		expect(next.selectedDate).toBe(sel.selectedDate);
	});

	it('停用時段（full/closed）為 no-op：回傳同一參照', () => {
		const sel = makeSel({ selectedTimeSlot: null });
		expect(selectTimeSlot(sel, makeSlot({ status: 'full' }))).toBe(sel);
		expect(selectTimeSlot(sel, makeSlot({ status: 'closed' }))).toBe(sel);
	});
});

describe('slotLabel', () => {
	it('「HH:MM-HH:MM」：start/end_time 各截前 5 碼、去秒', () => {
		expect(slotLabel(makeSlot({ start_time: '06:00:00', end_time: '08:30:00' }))).toBe(
			'06:00-08:30'
		);
	});
});

describe('isSlotDisabled', () => {
	it('full/closed 停用；available/limited 可選', () => {
		expect(isSlotDisabled(makeSlot({ status: 'full' }))).toBe(true);
		expect(isSlotDisabled(makeSlot({ status: 'closed' }))).toBe(true);
		expect(isSlotDisabled(makeSlot({ status: 'available' }))).toBe(false);
		expect(isSlotDisabled(makeSlot({ status: 'limited' }))).toBe(false);
	});
});
