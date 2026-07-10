import { describe, it, expect } from 'vitest';
import {
	isoDate,
	getDaysInMonth,
	getFirstDayOfMonth,
	sundayGridDays,
	isToday,
	isPastDate,
	formatDate,
	slotsForDay
} from './calendar-grid';
import type { ApiDaySchedule } from '$lib/public/api';

describe('isoDate', () => {
	it('個位月/日補零', () => {
		expect(isoDate(2026, 0, 5)).toBe('2026-01-05');
	});
});

describe('getDaysInMonth', () => {
	it('閏年 2024-02 = 29 天', () => {
		expect(getDaysInMonth(2024, 1)).toBe(29);
	});
});

describe('sundayGridDays', () => {
	it('2026-07（週三開始）：前 3 格 null、接 1..31、總長 34、無尾 null', () => {
		expect(getFirstDayOfMonth(2026, 6)).toBe(3); // 前提：確為週三開始
		const grid = sundayGridDays(2026, 6);
		expect(grid.slice(0, 3)).toEqual([null, null, null]);
		expect(grid.slice(3)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1)); // 1..31 連續、無 null 混入
		expect(grid).toHaveLength(34);
		expect(grid[grid.length - 1]).toBe(31); // 尾端不補 null
	});

	it('2026-02（週日開始、非閏年 28 天）：零前置 null', () => {
		expect(getFirstDayOfMonth(2026, 1)).toBe(0); // 前提：確為週日開始
		const grid = sundayGridDays(2026, 1);
		expect(grid[0]).toBe(1);
		expect(grid).toHaveLength(28);
	});

	it('2026-12（年末邊界、週二開始）：31 天、2 前置 null、接 1..31、總長 33、無尾 null', () => {
		expect(getDaysInMonth(2026, 11)).toBe(31);
		expect(getFirstDayOfMonth(2026, 11)).toBe(2); // 前提：確為週二開始
		const grid = sundayGridDays(2026, 11);
		expect(grid.slice(0, 2)).toEqual([null, null]);
		expect(grid.slice(2)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
		expect(grid).toHaveLength(33);
		expect(grid[grid.length - 1]).toBe(31);
	});
});

describe('isToday / isPastDate（todayRef 注入，不吃真實時鐘）', () => {
	// 刻意帶非零時分秒：驗證實作有 clone 再歸零，而非直接沿用呼叫者的 Date。
	const makeTodayRef = () => new Date(2026, 6, 15, 13, 45, 0);
	const julyAnchor = new Date(2026, 6, 1);

	it('同日：isToday true、isPastDate false', () => {
		const todayRef = makeTodayRef();
		expect(isToday(15, julyAnchor, todayRef)).toBe(true);
		expect(isPastDate(15, julyAnchor, todayRef)).toBe(false);
	});

	it('前一日：isPastDate true', () => {
		const todayRef = makeTodayRef();
		expect(isPastDate(14, julyAnchor, todayRef)).toBe(true);
	});

	it('異月同日號不誤判 isToday（8 月 15 號 ≠ 7 月 15 號今天）', () => {
		const todayRef = makeTodayRef();
		const augustAnchor = new Date(2026, 7, 1);
		expect(isToday(15, augustAnchor, todayRef)).toBe(false);
	});

	it('呼叫後傳入的 todayRef 物件未被改動', () => {
		const todayRef = makeTodayRef();
		const before = todayRef.getTime();
		isToday(15, julyAnchor, todayRef);
		isPastDate(15, julyAnchor, todayRef);
		expect(todayRef.getTime()).toBe(before);
	});
});

describe('formatDate', () => {
	it('zh-TW long 格式（年/月/日/星期），照現行元件行為', () => {
		expect(formatDate(new Date(2026, 6, 15))).toBe('2026年7月15日 星期三');
	});
});

describe('slotsForDay', () => {
	const days: ApiDaySchedule[] = [
		{
			date: '2026-07-15',
			slots: [
				{
					id: 'slot-1',
					date: '2026-07-15',
					start_time: '10:00:00',
					end_time: '11:00:00',
					venue_id: 'venue-1',
					course_id: 'course-1',
					capacity: 10,
					booked: 3,
					status: 'available'
				}
			]
		}
	];

	it('命中：回傳該天 slots', () => {
		expect(slotsForDay(days, '2026-07-15')).toBe(days[0].slots);
	});

	it('落空：回傳空陣列', () => {
		expect(slotsForDay(days, '2026-08-01')).toEqual([]);
	});
});
