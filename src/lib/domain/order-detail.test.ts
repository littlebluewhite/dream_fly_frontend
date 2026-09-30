import { describe, it, expect } from 'vitest';
import { orderDetailRows, type OrderDetailSource } from './order-detail';
import { fmtNT } from '$lib/format';

/* fixture 欄位值互不相同，證明每個欄位確實各自渲染（不是巧合對到同一個字串），
 * 同 OrderDialog.test.ts / class-detail.test.ts 的 fixture 慣例。 */
const order: OrderDetailSource = {
	id: 'DF-9001',
	member: '王承恩',
	item: '競技啦啦隊 進階班 · 春季',
	discount: '續報 -300',
	method: '信用卡',
	paidAt: '06/08 14:22',
	net: 4571,
	tax: 229,
	date: '06/08 10:00'
};

describe('orderDetailRows', () => {
	it('回傳逐欄 [label, value, mono] 一次精確 toEqual（無退款原因；R16 Task 2b 拿掉後端沒有的所屬分校/發票號碼/統一編號/經手人，13 → 9 列）', () => {
		expect(orderDetailRows(order)).toEqual([
			['訂單編號', 'DF-9001', true],
			['學員', '王承恩', false],
			['項目', '競技啦啦隊 進階班 · 春季', false],
			['優惠', '續報 -300', false],
			['付款方式', '信用卡', false],
			['收款時間', '06/08 14:22', true],
			['未稅金額', fmtNT(4571), true],
			['營業稅 5%', fmtNT(229), true],
			['建立時間', '06/08 10:00', true]
		]);
	});

	it('order.reason 存在時，最後多附加一列 [退款原因, reason, false]', () => {
		const refunded: OrderDetailSource = { ...order, reason: '家長申請改期，全額退款' };
		const rows = orderDetailRows(refunded);
		expect(rows).toHaveLength(10);
		expect(rows.at(-1)).toEqual(['退款原因', '家長申請改期，全額退款', false]);
	});
});
