/* src/lib/domain/leave-requests.test.ts — 請假列 view-model 單一來源(Task 10)單元測試
 *
 * 前身(Task 6)只收斂了 leaveAction 這條動作規則；member 桌面
 * routes/member/mine/+page.svelte 與 mobile MyCourseDetail.svelte 兩處「我的請假」
 * 列表其實還各自手抄同一份 tone/label 查表(原 LEAVE_STATUS，經 domain/member-app.ts
 * 轉出)與同一段 when/makeupWhen 格式化呼叫——本輪把整列 view-model 單源收斂到
 * `leaveRow()`，leaveAction 改成本檔私有實作細節，不再對外匯出。
 *
 * 新 bug 鎖定：已核准且已補課(`makeup_session_id` 有值)、但補課日期/時間缺漏時，
 * 呼叫端原本用 `?? ''` 後援餵給 formatSessionDateTime，會在畫面上顯示「已預約
 * 補課： (undefined)」——leaveRow() 改成日期/時間任一缺漏就回傳 `makeupWhen: null`，
 * 呼叫端據此判斷是否要渲染，而不是硬塞空字串。 */
import { describe, it, expect } from 'vitest';
import { leaveRow, type LeaveRowSource } from './leave-requests';

const BASE: LeaveRowSource = {
	status: 'pending',
	session_date: '2026-07-10',
	start_time: '19:00:00',
	makeup_session_id: null,
	makeup_session_date: null,
	makeup_start_time: null
};

describe('leaveRow — 請假列 view-model 單一來源(Task 10)', () => {
	it.each([
		['pending', null, 'warning', '待審核', 'cancel'],
		['approved', null, 'success', '已核准', 'bookMakeup'],
		['approved', 'sess-1', 'success', '已核准', 'makeupBooked'],
		['rejected', null, 'error', '已婉拒', null],
		['cancelled', null, 'neutral', '已取消', null]
	] as const)(
		'status=%s、makeup_session_id=%s → tone=%s、label=%s、action=%s',
		(status, makeupId, tone, label, action) => {
			const row = leaveRow({ ...BASE, status, makeup_session_id: makeupId });
			expect(row.tone).toBe(tone);
			expect(row.label).toBe(label);
			expect(row.action).toBe(action);
		}
	);

	it('when 是本次請假場次的日期 + 星期 + 起始時間文字', () => {
		const row = leaveRow(BASE);
		expect(row.when).toBe('2026-07-10 (五) 19:00');
	});

	it('已核准且已補課、補課日期時間齊全時，makeupWhen 是補課場次的日期時間文字', () => {
		const row = leaveRow({
			...BASE,
			status: 'approved',
			makeup_session_id: 'sess-1',
			makeup_session_date: '2026-07-15',
			makeup_start_time: '10:00:00'
		});
		expect(row.makeupWhen).toBe('2026-07-15 (三) 10:00');
	});

	it('已核准且已補課、但補課日期缺漏時，makeupWhen 是 null(不出現 "(undefined)")', () => {
		const row = leaveRow({
			...BASE,
			status: 'approved',
			makeup_session_id: 'sess-1',
			makeup_session_date: null,
			makeup_start_time: null
		});
		expect(row.makeupWhen).toBeNull();
	});

	it('未補課(approved 且無 makeup_session_id)時，makeupWhen 是 null', () => {
		const row = leaveRow({ ...BASE, status: 'approved', makeup_session_id: null });
		expect(row.makeupWhen).toBeNull();
	});
});
