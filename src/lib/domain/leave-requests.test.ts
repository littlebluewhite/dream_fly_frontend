/* src/lib/domain/leave-requests.test.ts — 請假動作規則單一來源(Task 6)單元測試
 *
 * leaveAction 自 routes/member/mine/+page.svelte、mobile/overlays/MyCourseDetail.svelte
 * 兩處原本各自手抄的 if/else 分支(pending 可取消、approved 且未補課可預約補課、
 * approved 且已補課/rejected/cancelled 無動作)單源收斂到這裡，兩處呼叫端確認為
 * 同一條規則，語意零改。 */
import { describe, it, expect } from 'vitest';
import { leaveAction } from './leave-requests';

describe('leaveAction — 請假動作規則', () => {
	it('pending → cancel', () => {
		expect(leaveAction({ status: 'pending', makeup_session_id: null })).toBe('cancel');
	});

	it('approved 無補課 → bookMakeup', () => {
		expect(leaveAction({ status: 'approved', makeup_session_id: null })).toBe('bookMakeup');
	});

	it('approved 有補課 → makeupBooked', () => {
		expect(leaveAction({ status: 'approved', makeup_session_id: 'sess-1' })).toBe('makeupBooked');
	});

	it('rejected / cancelled → null(無動作)', () => {
		expect(leaveAction({ status: 'rejected', makeup_session_id: null })).toBeNull();
		expect(leaveAction({ status: 'cancelled', makeup_session_id: null })).toBeNull();
	});
});
