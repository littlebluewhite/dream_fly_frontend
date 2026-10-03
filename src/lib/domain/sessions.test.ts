/* src/lib/domain/sessions.test.ts — 今日課表場次狀態單源(C4)單元測試
 *
 * SESSION_STATUS 查表直測三鍵、tone、label 正字——「上課中」是 canonical 標籤，不是
 * admin 舊值「進行中」(status-lookups.test.ts 另補一組較簡短的守衛，重點放在跨檔案
 * canonical 不回歸)。toTodaySession 的 state 直接對應後端 status(W-5：時間比較已移到
 * 後端，前端不再推導)。 */
import { describe, it, expect } from 'vitest';
import type { TodaySessionResponse } from '$lib/api/wire';
import { SESSION_STATUS, toTodaySession, type TodayStatus } from './sessions';

describe('SESSION_STATUS — 查表(三鍵、tone、label 正字)', () => {
	it('恰有 3 鍵(wait/live/done)，不多不少', () => {
		expect(Object.keys(SESSION_STATUS)).toHaveLength(3);
		const keys: TodayStatus[] = ['wait', 'live', 'done'];
		for (const k of keys) expect(SESSION_STATUS[k]).toBeDefined();
	});

	it('字面不變量：完整比對三鍵的 [tone, label]', () => {
		expect(SESSION_STATUS).toEqual({
			wait: ['neutral', '尚未開始'],
			live: ['success', '上課中'],
			done: ['neutral', '已結束']
		});
	});

	it('canonical 守衛：live 標籤是「上課中」，不是 admin 舊值「進行中」', () => {
		expect(SESSION_STATUS.live[1]).toBe('上課中');
	});
});

describe('toTodaySession — TodaySessionResponse → TodaySession 投影(C5：今日場次 wire 單源)', () => {
	const BASE = {
		id: 's1', course_id: 'c1', course_name: '兒童體操 初階班', coach_name: '黃詩涵',
		start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 6, venue: 'C 軟墊區', status: 'ongoing'
	} satisfies TodaySessionResponse;

	it('hhmm 裁切 start/end；coach_name/venue 皆有值時直接映射；status=ongoing → state=live', () => {
		const t = toTodaySession(BASE);
		expect(t).toEqual({
			id: 's1', start: '09:00', end: '10:00', name: '兒童體操 初階班',
			coach: '黃詩涵', room: 'C 軟墊區', count: 6, state: 'live'
		});
	});

	it('coach_name 為 null(尚未指定教練)時映射為「—」', () => {
		const t = toTodaySession({ ...BASE, coach_name: null });
		expect(t.coach).toBe('—');
	});

	it('venue 為 null(反推不到對應 slot)時映射為「—」', () => {
		const t = toTodaySession({ ...BASE, venue: null });
		expect(t.room).toBe('—');
	});

	it('status=upcoming → state=wait', () => {
		const t = toTodaySession({ ...BASE, status: 'upcoming' });
		expect(t.state).toBe('wait');
	});

	it('status=done → state=done', () => {
		const t = toTodaySession({ ...BASE, status: 'done' });
		expect(t.state).toBe('done');
	});
});
