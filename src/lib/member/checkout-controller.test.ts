/* checkout-controller.ts — 結帳付款狀態機的單元測試。deps（placeOrder/applyCouponCode）
 * 注入 mock、唯讀來源（lines/points）注入 writable 驅動，可控 promise resolve 時序驗
 * paying 生命週期與「付款飛行中外力關閉再重開」（resumedInFlight）的機器面；
 * idempotencyKey 生命週期（失敗重試沿用同一把／freshCheckout 換發）經 placeOrder mock
 * 的引數捕捉斷言（不注入 keygen dep）。Task 5(R14·F4) 起結算輸入（form/coupon/codeErr）
 * 與預覽也在 controller，重置/保留規則與預覽重算在此釘住；outcome → toast 文案／水合
 * 佈線由 CheckoutDialog.test.ts 與 CartSheet.test.ts 的 render its 覆蓋。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get, writable } from 'svelte/store';
import {
	createCheckoutController,
	type AppliedCoupon,
	type CheckoutController,
	type PaidSummary
} from './checkout-controller';
import type { PaymentMethod } from '$lib/checkout-order';
import type { ChargeableLine } from '$lib/cart-item';
import { chargeableLines } from './checkout';

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

/** 一行可計費項目（NT$4,800 課程）——經唯一 brand 產地 chargeableLines 產出。 */
const LINES: ChargeableLine[] = chargeableLines(
	[{ id: 'course-1', type: 'course', name: '競技啦啦隊 進階班', price: 4800, qty: 1, icon: 'sparkles' }],
	[]
);
const COUPON: AppliedCoupon = { code: 'DREAMFLY100', off: 100 };

function makeDeps() {
	return {
		placeOrder: vi.fn<(coupon: string, usePoints: boolean, idempotencyKey: string, paymentMethod: PaymentMethod) => Promise<PaidSummary>>(),
		applyCouponCode: vi.fn<(code: string) => Promise<{ coupon: AppliedCoupon | null; codeErr: string } | null>>(),
		lines: writable<ChargeableLine[]>(LINES),
		points: writable(0)
	};
}

/** 付款生命週期三欄（快照的其餘欄位是結算輸入/預覽，另有專屬 describe）。 */
function machine(c: CheckoutController) {
	const { step, paying, paid } = get(c);
	return { step, paying, paid };
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
	it('建構零副作用：初始視圖在購物車步、非付款中、成交快照為空、表單為預設，不觸發任何 dep（SSR 安全）', () => {
		expect(get(ctrl)).toEqual({
			step: 0,
			paying: false,
			paid: EMPTY_PAID,
			coupon: null,
			codeErr: '',
			preview: { subtotal: 4800, couponOff: 0, ptRedeem: 0, total: 4800, earned: 240 },
			hasChargeable: true
		});
		expect(get(ctrl.form)).toEqual({ code: '', usePoints: false, paymentMethod: 'credit_card' });
		expect(deps.placeOrder).not.toHaveBeenCalled();
		expect(deps.applyCouponCode).not.toHaveBeenCalled();
	});

	it('閉→開邊沿（無飛行）：freshCheckout——成功結帳後重開，step 歸 0、成交快照歸零', async () => {
		deps.placeOrder.mockResolvedValue(CONFIRMED);
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		ctrl.toPayment();
		await ctrl.confirmPay();
		expect(machine(ctrl)).toEqual({ step: 2, paying: false, paid: CONFIRMED }); // 上一單的殘留狀態
		expect(ctrl.setOpen(false)).toEqual({ kind: 'noop' });
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		expect(machine(ctrl)).toEqual({ step: 0, paying: false, paid: EMPTY_PAID });
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
		const p = ctrl.confirmPay();
		expect(machine(ctrl)).toEqual({ step: 1, paying: true, paid: EMPTY_PAID });
		// prevOpen 含飛行中都更新：關閉（noop）後重開才偵測得到閉→開邊沿。
		expect(ctrl.setOpen(false)).toEqual({ kind: 'noop' });
		expect(ctrl.setOpen(true)).toEqual({ kind: 'resumedInFlight' });
		expect(machine(ctrl)).toEqual({ step: 1, paying: true, paid: EMPTY_PAID }); // 延續同一結帳流程
		d.resolve(CONFIRMED);
		await expect(p).resolves.toEqual({ kind: 'orderPlaced', paid: CONFIRMED });
		expect(machine(ctrl)).toEqual({ step: 2, paying: false, paid: CONFIRMED });
		// promise 落定後，下一次閉→開才允許重置。
		ctrl.setOpen(false);
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		expect(machine(ctrl)).toEqual({ step: 0, paying: false, paid: EMPTY_PAID });
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
		const p = ctrl.confirmPay();
		ctrl.backToCart();
		expect(machine(ctrl)).toEqual({ step: 0, paying: true, paid: EMPTY_PAID });
		d.resolve(CONFIRMED);
		await p;
		expect(machine(ctrl)).toEqual({ step: 2, paying: false, paid: CONFIRMED });
	});
});

describe('confirmPay — 生命週期與守衛', () => {
	it('成功：自己那份表單與已套用優惠碼透傳 placeOrder，outcome orderPlaced 攜帶成交快照，視圖轉完成步', async () => {
		deps.placeOrder.mockResolvedValue(CONFIRMED);
		deps.applyCouponCode.mockResolvedValue({ coupon: COUPON, codeErr: '' });
		ctrl.form.set({ code: 'dreamfly100', usePoints: true, paymentMethod: 'line_pay' });
		await ctrl.applyCode();
		const outcome = await ctrl.confirmPay();
		expect(deps.placeOrder).toHaveBeenCalledWith('DREAMFLY100', true, expect.any(String), 'line_pay');
		expect(outcome).toEqual({ kind: 'orderPlaced', paid: CONFIRMED });
		expect(machine(ctrl)).toEqual({ step: 2, paying: false, paid: CONFIRMED });
	});

	it('paying 生命週期：起飛同步發佈 paying true（不等 resolve），落地復位', async () => {
		const d = deferred<PaidSummary>();
		deps.placeOrder.mockReturnValue(d.promise);
		const p = ctrl.confirmPay();
		expect(get(ctrl).paying).toBe(true); // 同步進行中
		d.resolve(CONFIRMED);
		await p;
		expect(get(ctrl).paying).toBe(false);
	});

	it('alreadyPaying：飛行中重入立即返回，不發第二次 placeOrder', async () => {
		const d = deferred<PaidSummary>();
		deps.placeOrder.mockReturnValue(d.promise);
		const p = ctrl.confirmPay();
		const reentry = await ctrl.confirmPay();
		expect(reentry).toEqual({ kind: 'alreadyPaying' });
		expect(deps.placeOrder).toHaveBeenCalledTimes(1);
		d.resolve(CONFIRMED);
		await p;
	});

	it('nothingChargeable：lines 為空（hasChargeable=false）不送單——placeOrder 零呼叫、狀態不動', async () => {
		deps.lines.set([]);
		expect(get(ctrl).hasChargeable).toBe(false);
		const outcome = await ctrl.confirmPay();
		expect(outcome).toEqual({ kind: 'nothingChargeable' });
		expect(deps.placeOrder).not.toHaveBeenCalled();
		expect(machine(ctrl)).toEqual({ step: 0, paying: false, paid: EMPTY_PAID });
	});

	it('失敗：orderFailed 透傳原始拋出物（同一物件識別），step 停在原地、paying 復位、成交快照不寫', async () => {
		const err = new Error('network down');
		deps.placeOrder.mockRejectedValue(err);
		ctrl.toPayment();
		const outcome = await ctrl.confirmPay();
		expect(outcome).toEqual({ kind: 'orderFailed', error: err });
		// 同一物件識別（非僅結構等價）——元件的 orderErrorMessage 靠 instanceof 分類。
		expect(outcome.kind === 'orderFailed' ? outcome.error : null).toBe(err);
		expect(machine(ctrl)).toEqual({ step: 1, paying: false, paid: EMPTY_PAID });
	});
});

describe('idempotencyKey 生命週期（機器面——render 測試從未斷言）', () => {
	it('失敗重試沿用同一把 key（後端辨識重放、不重複扣款的前提）', async () => {
		deps.placeOrder.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(CONFIRMED);
		ctrl.setOpen(true);
		expect((await ctrl.confirmPay()).kind).toBe('orderFailed');
		expect((await ctrl.confirmPay()).kind).toBe('orderPlaced');
		expect(keyOfCall(0)).not.toBe('');
		expect(keyOfCall(1)).toBe(keyOfCall(0)); // 重試沿用同一把
	});

	it('freshCheckout 換發：成功結帳關閉重開後，下一單用不同的 key', async () => {
		deps.placeOrder.mockResolvedValue(CONFIRMED);
		ctrl.setOpen(true);
		await ctrl.confirmPay();
		ctrl.setOpen(false);
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		await ctrl.confirmPay();
		expect(keyOfCall(0)).not.toBe('');
		expect(keyOfCall(1)).not.toBe('');
		expect(keyOfCall(1)).not.toBe(keyOfCall(0)); // 新結帳流程 = 新 key
	});
});

/* 建構期即備妥可用 key、每個實例各持一把——這是 controller 本身的通用保證，不繫在
 * 特定消費者身上。C3/R13 起 mobile CartSheet 已改用 setOpen 佈線的模組級單例（見
 * $lib/mobile/stores.ts），不再是這裡描述的「不呼叫 setOpen」消費者；但保證本身仍
 * 值得保存測試釘住——桌面 CheckoutDialog 的 setOpen 佈線遮住了這兩條（它的 key 永遠
 * 在 freshCheckout 換發過），只有這裡的無渲染單測看得到。 */
describe('建構期即備妥可用 key（不呼叫 setOpen 的消費者）', () => {
	it('不呼叫 setOpen 也能送單：建構期產生的 key 直接可用，失敗重試沿用同一把', async () => {
		deps.placeOrder.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(CONFIRMED);
		expect((await ctrl.confirmPay()).kind).toBe('orderFailed');
		expect((await ctrl.confirmPay()).kind).toBe('orderPlaced');
		expect(keyOfCall(0)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
		expect(keyOfCall(1)).toBe(keyOfCall(0)); // 重試沿用同一把（後端辨識重放）
	});

	it('每個實例各持一把 key：不同建構彼此獨立，互不影響', async () => {
		const otherDeps = makeDeps();
		const other = createCheckoutController(otherDeps);
		deps.placeOrder.mockResolvedValue(CONFIRMED);
		otherDeps.placeOrder.mockResolvedValue(CONFIRMED);
		await ctrl.confirmPay();
		await other.confirmPay();
		const otherKey = otherDeps.placeOrder.mock.calls[0]?.[2];
		expect(otherKey).not.toBe('');
		expect(otherKey).not.toBe(keyOfCall(0));
	});
});

/* Task 5(R14·F4)：結算輸入（form/coupon/codeErr）與預覽住 controller——跟著付款生命週期
 * 重置或保留，預覽隨輸入與唯讀來源重算。 */
describe('結算輸入與預覽', () => {
	/** 填一組完整輸入：套用優惠碼、開點數折抵、選 LINE Pay。 */
	async function fillInputs() {
		deps.applyCouponCode.mockResolvedValue({ coupon: COUPON, codeErr: '' });
		ctrl.form.set({ code: 'DREAMFLY100', usePoints: true, paymentMethod: 'line_pay' });
		await ctrl.applyCode();
	}

	it('preview 隨 lines／points／usePoints／coupon 重算（checkoutMath）', async () => {
		deps.points.set(300);
		expect(get(ctrl).preview.total).toBe(4800); // usePoints 關閉
		ctrl.form.update((f) => ({ ...f, usePoints: true }));
		expect(get(ctrl).preview).toMatchObject({ ptRedeem: 300, total: 4500 });
		deps.applyCouponCode.mockResolvedValue({ coupon: COUPON, codeErr: '' });
		ctrl.form.update((f) => ({ ...f, code: 'DREAMFLY100' }));
		await ctrl.applyCode();
		expect(deps.applyCouponCode).toHaveBeenCalledWith('DREAMFLY100');
		expect(get(ctrl).preview).toMatchObject({ couponOff: 100, ptRedeem: 300, total: 4400 });
		deps.points.set(50);
		expect(get(ctrl).preview).toMatchObject({ ptRedeem: 50, total: 4650 });
		deps.lines.set([]);
		expect(get(ctrl).preview).toMatchObject({ subtotal: 0, couponOff: 0, ptRedeem: 0, total: 0 });
		expect(get(ctrl).hasChargeable).toBe(false);
	});

	it('applyCode：空輸入（dep 回 null）不動狀態；無效碼寫 codeErr（文字來自 dep）；clearCodeErr 清掉', async () => {
		deps.applyCouponCode.mockResolvedValueOnce(null);
		await ctrl.applyCode();
		expect(get(ctrl)).toMatchObject({ coupon: null, codeErr: '' });
		deps.applyCouponCode.mockResolvedValueOnce({ coupon: null, codeErr: '注入的文案' });
		ctrl.form.update((f) => ({ ...f, code: 'NOPE' }));
		await ctrl.applyCode();
		expect(get(ctrl)).toMatchObject({ coupon: null, codeErr: '注入的文案' });
		ctrl.clearCodeErr();
		expect(get(ctrl).codeErr).toBe('');
	});

	it('removeCoupon：清掉已套用的優惠碼與輸入框', async () => {
		await fillInputs();
		ctrl.removeCoupon();
		expect(get(ctrl).coupon).toBeNull();
		expect(get(ctrl.form)).toEqual({ code: '', usePoints: true, paymentMethod: 'line_pay' });
	});

	it('freshCheckout 重置表單與 coupon/codeErr', async () => {
		ctrl.setOpen(true);
		await fillInputs();
		ctrl.setOpen(false);
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		expect(get(ctrl.form)).toEqual({ code: '', usePoints: false, paymentMethod: 'credit_card' });
		expect(get(ctrl)).toMatchObject({ coupon: null, codeErr: '' });
	});

	it('resumedInFlight 全部保留：表單、優惠碼、預覽與關閉前相同', async () => {
		deps.points.set(300);
		ctrl.setOpen(true);
		await fillInputs();
		const before = get(ctrl);
		const d = deferred<PaidSummary>();
		deps.placeOrder.mockReturnValue(d.promise);
		const p = ctrl.confirmPay();
		ctrl.setOpen(false);
		expect(ctrl.setOpen(true)).toEqual({ kind: 'resumedInFlight' });
		expect(get(ctrl.form)).toEqual({ code: 'DREAMFLY100', usePoints: true, paymentMethod: 'line_pay' });
		expect(get(ctrl)).toMatchObject({ coupon: COUPON, codeErr: '', preview: before.preview });
		expect(get(ctrl).preview.total).toBe(4400);
		d.resolve(CONFIRMED);
		await p;
		expect(deps.placeOrder).toHaveBeenCalledWith('DREAMFLY100', true, expect.any(String), 'line_pay');
	});

	it('序號守衛：freshCheckout 之後才落地的 applyCode 回應被丟棄', async () => {
		ctrl.setOpen(true);
		const d = deferred<{ coupon: AppliedCoupon | null; codeErr: string } | null>();
		deps.applyCouponCode.mockReturnValue(d.promise);
		ctrl.form.update((f) => ({ ...f, code: 'DREAMFLY100' }));
		const pending = ctrl.applyCode();
		ctrl.setOpen(false);
		expect(ctrl.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		d.resolve({ coupon: COUPON, codeErr: '' });
		await pending;
		expect(get(ctrl)).toMatchObject({ coupon: null, codeErr: '' });
		expect(get(ctrl).preview.couponOff).toBe(0);
	});
});
