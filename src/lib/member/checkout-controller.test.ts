/* checkout-controller.ts — member 結帳付款狀態機的單元測試。deps（placeOrder）注入
 * mock，可控 promise resolve 時序驗 paying 生命週期與「付款飛行中外力關閉再重開」
 * （resumedInFlight）的機器面；idempotencyKey 生命週期（失敗重試沿用同一把／
 * freshCheckout 換發）經 placeOrder mock 的引數捕捉斷言（不注入 keygen dep）。
 * outcome → toast 文案／表單重置／水合佈線由 CheckoutDialog.test.ts 的既有 render
 * its 覆蓋。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	createCheckoutController,
	type CheckoutController,
	type ConfirmPayInput,
	type PaidSummary
} from './checkout-controller';
import type { PaymentMethod } from '$lib/checkout-order';

/** 手動控制 resolve/reject 時序的 promise，用於驗 await 前/後的狀態語意。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const EMPTY_PAID: PaidSummary = { total: 0, earned: 0, ptRedeem: 0, hasCourse: false, hasPass: false, orderNumber: '' };
const CONFIRMED: PaidSummary = { total: 4800, earned: 240, ptRedeem: 100, hasCourse: true, hasPass: false, orderNumber: 'DF-0001' };

/** confirmPay 的表單輸入預設值——單測只在乎透傳與守衛，內容按情境覆寫。 */
function input(overrides: Partial<ConfirmPayInput> = {}): ConfirmPayInput {
	return { coupon: '', usePoints: false, paymentMethod: 'credit_card', hasChargeable: true, ...overrides };
}

function makeDeps() {
	return {
		placeOrder: vi.fn<(coupon: string, usePoints: boolean, idempotencyKey: string, paymentMethod: PaymentMethod) => Promise<PaidSummary>>()
	};
}

let deps: ReturnType<typeof makeDeps>;
let ctrl: CheckoutController;

beforeEach(() => {
	deps = makeDeps();
	ctrl = createCheckoutController(deps);
});

/** 第 n 次 placeOrder 呼叫收到的 Idempotency-Key（引數第 3 位）。 */
function keyOfCall(n: number): string {
	const call = deps.placeOrder.mock.calls[n];
	if (!call) throw new Error(`placeOrder 第 ${n} 次呼叫不存在`);
	return call[2];
}

describe('createCheckoutController — 建構 / setOpen 邊沿', () => {
	it('建構零副作用：初始視圖在購物車步、非付款中、成交快照為空，不觸發 placeOrder（SSR 安全）', () => {
		expect(get(ctrl)).toEqual({ step: 0, paying: false, paid: EMPTY_PAID });
		expect(deps.placeOrder).not.toHaveBeenCalled();
	});

	it('閉→開邊沿（無飛行）：freshCheckout——成功結帳後重開，step 歸 0、成交快照歸零', async () => {
		deps.placeOrder.mockResolvedValue(CONFIRMED);
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		ctrl.toPayment();
		await ctrl.confirmPay(input());
		expect(get(ctrl)).toEqual({ step: 2, paying: false, paid: CONFIRMED }); // 上一單的殘留狀態
		expect(ctrl.setOpen(false)).toEqual({ kind: 'noop' });
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		expect(get(ctrl)).toEqual({ step: 0, paying: false, paid: EMPTY_PAID });
	});

	it('非閉→開邊沿一律 noop：開→開不重複重置、開→閉不重置', () => {
		ctrl.setOpen(true);
		ctrl.toPayment();
		expect(ctrl.setOpen(true)).toEqual({ kind: 'noop' }); // 開→開（無邊沿）
		expect(get(ctrl).step).toBe(1);
		expect(ctrl.setOpen(false)).toEqual({ kind: 'noop' }); // 開→閉
		expect(get(ctrl).step).toBe(1);
	});

	it('付款飛行中外力關閉再重開：resumedInFlight——不重置、paying 鎖住；落定後的下一次閉→開才 fresh', async () => {
		const d = deferred<PaidSummary>();
		deps.placeOrder.mockReturnValue(d.promise);
		ctrl.setOpen(true);
		ctrl.toPayment();
		const p = ctrl.confirmPay(input());
		expect(get(ctrl)).toEqual({ step: 1, paying: true, paid: EMPTY_PAID });
		// prevOpen 含飛行中都更新：關閉（noop）後重開才偵測得到閉→開邊沿。
		expect(ctrl.setOpen(false)).toEqual({ kind: 'noop' });
		expect(ctrl.setOpen(true)).toEqual({ kind: 'resumedInFlight' });
		expect(get(ctrl)).toEqual({ step: 1, paying: true, paid: EMPTY_PAID }); // 延續同一結帳流程
		d.resolve(CONFIRMED);
		await expect(p).resolves.toEqual({ kind: 'orderPlaced', paid: CONFIRMED });
		expect(get(ctrl)).toEqual({ step: 2, paying: false, paid: CONFIRMED });
		// promise 落定後，下一次閉→開才允許重置。
		ctrl.setOpen(false);
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		expect(get(ctrl)).toEqual({ step: 0, paying: false, paid: EMPTY_PAID });
	});
});

describe('步驟流轉 — toPayment / backToCart', () => {
	it('toPayment 進付款步、backToCart 回購物車步；backToCart 無 paying 守衛（現況僅按鈕 disabled）', async () => {
		ctrl.toPayment();
		expect(get(ctrl).step).toBe(1);
		ctrl.backToCart();
		expect(get(ctrl).step).toBe(0);
		// 飛行中呼叫 backToCart 也把 step 拉回（加守衛是行為變更）；成功落地仍照現況收束到完成步。
		const d = deferred<PaidSummary>();
		deps.placeOrder.mockReturnValue(d.promise);
		ctrl.toPayment();
		const p = ctrl.confirmPay(input());
		ctrl.backToCart();
		expect(get(ctrl)).toEqual({ step: 0, paying: true, paid: EMPTY_PAID });
		d.resolve(CONFIRMED);
		await p;
		expect(get(ctrl)).toEqual({ step: 2, paying: false, paid: CONFIRMED });
	});
});

describe('confirmPay — 生命週期與守衛', () => {
	it('成功：表單輸入呼叫瞬間透傳 placeOrder，outcome orderPlaced 攜帶成交快照，視圖轉完成步', async () => {
		deps.placeOrder.mockResolvedValue(CONFIRMED);
		const outcome = await ctrl.confirmPay(input({ coupon: 'DREAMFLY100', usePoints: true, paymentMethod: 'line_pay' }));
		expect(deps.placeOrder).toHaveBeenCalledWith('DREAMFLY100', true, expect.any(String), 'line_pay');
		expect(outcome).toEqual({ kind: 'orderPlaced', paid: CONFIRMED });
		expect(get(ctrl)).toEqual({ step: 2, paying: false, paid: CONFIRMED });
	});

	it('paying 生命週期：起飛同步發佈 paying true（不等 resolve），落地復位', async () => {
		const d = deferred<PaidSummary>();
		deps.placeOrder.mockReturnValue(d.promise);
		const p = ctrl.confirmPay(input());
		expect(get(ctrl).paying).toBe(true); // 同步進行中
		d.resolve(CONFIRMED);
		await p;
		expect(get(ctrl).paying).toBe(false);
	});

	it('alreadyPaying：飛行中重入立即返回，不發第二次 placeOrder', async () => {
		const d = deferred<PaidSummary>();
		deps.placeOrder.mockReturnValue(d.promise);
		const p = ctrl.confirmPay(input());
		const reentry = await ctrl.confirmPay(input());
		expect(reentry).toEqual({ kind: 'alreadyPaying' });
		expect(deps.placeOrder).toHaveBeenCalledTimes(1);
		d.resolve(CONFIRMED);
		await p;
	});

	it('nothingChargeable：無可計費項目不送單——placeOrder 零呼叫、狀態不動', async () => {
		const outcome = await ctrl.confirmPay(input({ hasChargeable: false }));
		expect(outcome).toEqual({ kind: 'nothingChargeable' });
		expect(deps.placeOrder).not.toHaveBeenCalled();
		expect(get(ctrl)).toEqual({ step: 0, paying: false, paid: EMPTY_PAID });
	});

	it('失敗：orderFailed 透傳原始拋出物（同一物件識別），step 停在原地、paying 復位、成交快照不寫', async () => {
		const err = new Error('network down');
		deps.placeOrder.mockRejectedValue(err);
		ctrl.toPayment();
		const outcome = await ctrl.confirmPay(input());
		expect(outcome).toEqual({ kind: 'orderFailed', error: err });
		// 同一物件識別（非僅結構等價）——元件的 orderErrorMessage 靠 instanceof 分類。
		expect(outcome.kind === 'orderFailed' ? outcome.error : null).toBe(err);
		expect(get(ctrl)).toEqual({ step: 1, paying: false, paid: EMPTY_PAID });
	});
});

describe('idempotencyKey 生命週期（機器面——render 測試從未斷言）', () => {
	it('失敗重試沿用同一把 key（後端辨識重放、不重複扣款的前提）', async () => {
		deps.placeOrder.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(CONFIRMED);
		ctrl.setOpen(true);
		expect((await ctrl.confirmPay(input())).kind).toBe('orderFailed');
		expect((await ctrl.confirmPay(input())).kind).toBe('orderPlaced');
		expect(keyOfCall(0)).not.toBe('');
		expect(keyOfCall(1)).toBe(keyOfCall(0)); // 重試沿用同一把
	});

	it('freshCheckout 換發：成功結帳關閉重開後，下一單用不同的 key', async () => {
		deps.placeOrder.mockResolvedValue(CONFIRMED);
		ctrl.setOpen(true);
		await ctrl.confirmPay(input());
		ctrl.setOpen(false);
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		await ctrl.confirmPay(input());
		expect(keyOfCall(0)).not.toBe('');
		expect(keyOfCall(1)).not.toBe('');
		expect(keyOfCall(1)).not.toBe(keyOfCall(0)); // 新結帳流程 = 新 key
	});
});
