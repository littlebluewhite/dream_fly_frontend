/* Dream Fly — 訂單詳情顯示查表（純函式，R13 Task 5 / C4，照 class-detail.ts 的
 * 前例）。
 *
 * admin 桌面 OrderDialog 與 mobile-admin OrderSheet 的訂單詳情欄位列原是各自
 * inline 一份、byte-identical 雙生（零測）——本檔收斂為單一 domain 顯示查表，
 * 消費端直接 import、無需 facade（同 class-detail.ts 的先例、ADR 0009 對純函式
 * 的直取精神）。 */

import { fmtNT } from '$lib/format';

/** OrderDialog/OrderSheet 詳情列所需的欄位——Order（admin/data.ts）與
 *  OrderRow（mobile-admin/data.ts）共通的子集（兩份形狀相同，structural typing
 *  直接相容）。 */
export interface OrderDetailSource {
	id: string;
	member: string;
	item: string;
	campus: string;
	discount: string;
	method: string;
	paidAt: string;
	net: number;
	tax: number;
	invoice: string;
	taxId: string;
	handler: string;
	date: string;
	reason?: string;
}

/** [label, value, mono] 詳情欄位列——逐字搬 OrderDialog/OrderSheet 原 rows（含
 *  fmtNT 格式化的未稅金額/營業稅），供 OrderDialog/OrderSheet 共用；mono 標記
 *  該欄位是否用等寬字體（訂單編號/收款時間/金額/發票/統編/建立時間），退款原因
 *  只在 order.reason 存在時附加在最後（非 mono）。 */
export function orderDetailRows(o: OrderDetailSource): [string, string, boolean][] {
	const rows: [string, string, boolean][] = [
		['訂單編號', o.id, true],
		['學員', o.member, false],
		['項目', o.item, false],
		['所屬分校', o.campus, false],
		['優惠', o.discount, false],
		['付款方式', o.method, false],
		['收款時間', o.paidAt, true],
		['未稅金額', fmtNT(o.net), true],
		['營業稅 5%', fmtNT(o.tax), true],
		['發票號碼', o.invoice, true],
		['統一編號', o.taxId, true],
		['經手人', o.handler, false],
		['建立時間', o.date, true]
	];
	if (o.reason) rows.push(['退款原因', o.reason, false]);
	return rows;
}
