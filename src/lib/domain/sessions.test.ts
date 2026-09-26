/* src/lib/domain/sessions.test.ts — 今日課表場次狀態單源(C4)單元測試
 *
 * deriveSessionStatus 的牆鐘語意 5 例自 coach/api.test.ts 的 §3.18 描述整段搬入(斷言
 * 逐字不變，函式本身語意零改)；coach/api.test.ts 改留一條 toBe 參照 pin，確認
 * re-export 沒有變成重新實作(見該檔)。SESSION_STATUS 查表直測四鍵、tone、label 正字
 * ——「上課中」是 canonical 標籤，不是 admin 舊值「進行中」(status-lookups.test.ts
 * 另補一組較簡短的守衛，重點放在跨檔案 canonical 不回歸)。 */
import { describe, it, expect } from 'vitest';
import { deriveSessionStatus, SESSION_STATUS, toTodaySession, type TodayStatus } from './sessions';

describe('deriveSessionStatus — §3.18 裁決 2(場次時間為牆鐘語意，本地直接比較，不做時區換算)', () => {
	it('now < start_time → wait', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 8, 59, 59))).toBe('wait');
	});

	it('now === start_time(邊界)→ live', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 9, 0, 0))).toBe('live');
	});

	it('start_time < now < end_time → live', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 9, 30, 0))).toBe('live');
	});

	it('now === end_time(邊界，已結束)→ done', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 10, 0, 0))).toBe('done');
	});

	it('now > end_time → done', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 10, 0, 1))).toBe('done');
	});
});

describe('SESSION_STATUS — 查表(四鍵、tone、label 正字)', () => {
	it('恰有 4 鍵(wait/live/done/soon)，不多不少', () => {
		expect(Object.keys(SESSION_STATUS)).toHaveLength(4);
		const keys: TodayStatus[] = ['wait', 'live', 'done', 'soon'];
		for (const k of keys) expect(SESSION_STATUS[k]).toBeDefined();
	});

	it('字面不變量：完整比對四鍵的 [tone, label]', () => {
		expect(SESSION_STATUS).toEqual({
			wait: ['neutral', '尚未開始'],
			live: ['success', '上課中'],
			done: ['neutral', '已結束'],
			soon: ['warning', '即將開始']
		});
	});

	it('canonical 守衛：live 標籤是「上課中」，不是 admin 舊值「進行中」', () => {
		expect(SESSION_STATUS.live[1]).toBe('上課中');
	});
});

describe('toTodaySession — ApiTodaySession → TodaySession 投影(C5：今日場次 wire 單源)', () => {
	const BASE = {
		id: 's1', course_id: 'c1', course_name: '兒童體操 初階班', coach_name: '黃詩涵',
		start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 6, venue: 'C 軟墊區'
	};

	it('hhmm 裁切 start/end；coach_name/venue 皆有值時直接映射；state 依目前時間推導', () => {
		const t = toTodaySession(BASE, new Date(2026, 6, 4, 9, 30, 0));
		expect(t).toEqual({
			id: 's1', start: '09:00', end: '10:00', name: '兒童體操 初階班',
			coach: '黃詩涵', room: 'C 軟墊區', count: 6, state: 'live'
		});
	});

	it('coach_name 為 null(尚未指定教練)時映射為「—」', () => {
		const t = toTodaySession({ ...BASE, coach_name: null }, new Date(2026, 6, 4, 9, 30, 0));
		expect(t.coach).toBe('—');
	});

	it('venue 為 null(反推不到對應 slot)時映射為「—」', () => {
		const t = toTodaySession({ ...BASE, venue: null }, new Date(2026, 6, 4, 9, 30, 0));
		expect(t.room).toBe('—');
	});

	it('now < start_time → state=wait', () => {
		const t = toTodaySession(BASE, new Date(2026, 6, 4, 8, 0, 0));
		expect(t.state).toBe('wait');
	});

	it('now >= end_time → state=done', () => {
		const t = toTodaySession(BASE, new Date(2026, 6, 4, 11, 0, 0));
		expect(t.state).toBe('done');
	});
});
