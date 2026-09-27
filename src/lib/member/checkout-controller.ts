/* Dream Fly — 結帳付款狀態機（自 member/components/CheckoutDialog.svelte 抽出）。
 * 收的是「付款生命週期」——有跨事件不變量的四個變數：step（open-reset 歸 0、成功轉 2）、
 * idempotencyKey（重試沿用、fresh 換發——防重複扣款安全機的核心）、paid（成交快照，
 * 購物車清空後成功步仍要顯示）、paying（in-flight 守衛本身）。Task 5(R14·F4) 起結算輸入
 * （form = code/usePoints/paymentMethod，coupon/codeErr）與預覽（preview/hasChargeable）
 * 也住這裡、跟著機器活：freshCheckout 一併重置，resumedInFlight 全部保留（付款飛行中重開
 * 看到的輸入與預覽，就是正在送出的那一單）。confirmPay 不收引數，讀自己那份。
 *
 * open-reset 邊沿語意（與原元件 wasOpen 佈線逐字等價）：setOpen 內建閉→開邊沿偵測，
 * prevOpen **每次呼叫都更新——含付款飛行中**；飛行中的閉→開邊沿不重置（resumedInFlight），
 * 延續同一個 in-flight 結帳流程（paying 鎖住、key 不變）——否則重開換發新 key，使用者
 * 再按一次付款就會開出第二張真訂單，同一筆意圖被收兩次錢（integration-contract.md §1.7）。
 * promise 落定後的下一次閉→開才重置（freshCheckout）。
 *
 * idempotencyKey 生命週期歸 controller：建構時產生、freshCheckout 換發、失敗重試沿用
 * 同一把（後端辨識重放，回原訂單而不重複扣款/建立報名訂閱）；key 不進視圖快照，唯一
 * 消費者是 deps.placeOrder。backToCart 刻意不加 paying 守衛——今日防護只靠頁面
 * disabled={paying}，加了是行為變更。
 *
 * deps：兩支效應（placeOrder、applyCouponCode）＋兩個唯讀來源（lines = 可計費項目、
 * points = 可用點數；前例是 attendance-controller 的 `now`）——注入的是資料來源，不是
 * 行為旗標（ADR 0012 判準②）。codeErr 的文字由注入的 applyCouponCode 給，本檔零 toast／
 * 錯誤文案 import（判準④）。開啟即水合的 refreshSubscriptions/refreshPoints 屬 open-reset
 * 時刻的元件佈線，不入 deps。
 *
 * 雙 surface 共用（C2/R11：mobile CartSheet 原本手焊一台同構的機器，已退役改吃本檔，
 * 經 $lib/mobile/stores 的 seam 取用）。C3/R13 起兩個消費者的生命週期同層，機器本身
 * 仍不分岔：桌面 CheckoutDialog 整個結帳期間都不卸載；行動版改為 $lib/mobile/stores.ts
 * 的模組級單例（`export const checkout`，與 `cart` 同生命週期，比 CartSheet 這顆 mount
 * 級元件活得久，OverlayHost `{#if}` 每次開闔都拿同一顆）。兩側都用 setOpen 的閉→開邊沿
 * 換發 key／偵測飛行中 resumed——CartSheet 隨掛載/卸載呼叫 setOpen(true/false)，若 sheet
 * 在付款飛行中被關閉（如導航觸發的 closeAll）又重開，走 resumedInFlight，同一把 key
 * 續用、paying 繼續鎖住，不會開出第二張真訂單。
 *
 * 無 svelte 元件相依、建構零 dep 呼叫（SSR 安全）。本抽取取代 ADR 0008 §「有意識保留：
 * CheckoutDialog 的防重複扣款不抽成純模組」的當時裁決（Round 5；render 測試原封全綠 =
 * 搬動零 churn 的證明）。 */
import { derived, get, writable, type Readable, type Writable } from 'svelte/store';
import type { PaymentMethod } from '$lib/checkout-order';
import type { ChargeableLine } from '$lib/cart-item';
import { checkoutMath } from '$lib/checkout-math';

/** 成交快照 = placeOrder 確認物件的六欄投影（金額/點數以 API 回應為準，非本地試算）。
 *  deps 回傳型別也用這個窄形：真 placeOrder（Promise<OrderConfirmation>，多 raw 欄）
 *  協變可直接指派，單元 mock 則不必湊 raw 的 wire 物件。 */
export interface PaidSummary {
	total: number; // NT$ 整數
	earned: number; // 回饋點數
	ptRedeem: number; // 點數折抵
	hasCourse: boolean; // 訂單內含課程項
	hasPass: boolean; // 訂單內含方案項
	orderNumber: string;
}

export interface AppliedCoupon {
	code: string;
	off: number; // NT$ 整數
}

/** 元件 `bind:` 的結算表單（checkout.form）。 */
export interface CheckoutForm {
	code: string; // 優惠碼輸入框
	usePoints: boolean;
	paymentMethod: PaymentMethod;
}

export interface CheckoutViewState {
	step: 0 | 1 | 2; // 0 購物車 / 1 結帳付款 / 2 完成
	paying: boolean;
	paid: PaidSummary;
	coupon: AppliedCoupon | null; // 已套用的優惠碼（只由 applyCode/removeCoupon 寫入）
	codeErr: string;
	preview: ReturnType<typeof checkoutMath>; // 本地預覽；成交金額以 paid 為準
	hasChargeable: boolean; // lines 非空——空車/全數已持有時不可送單
}

export interface CheckoutControllerDeps {
	placeOrder: (
		coupon: string,
		usePoints: boolean,
		idempotencyKey: string,
		paymentMethod: PaymentMethod
	) => Promise<PaidSummary>;
	/** 「套用」按鈕的結果機（member/checkout 的 applyCouponCode）：空輸入回 null（不動
	 *  狀態），否則回要寫入的 coupon 與錯誤文案。 */
	applyCouponCode: (code: string) => Promise<{ coupon: AppliedCoupon | null; codeErr: string } | null>;
	lines: Readable<ChargeableLine[]>; // 可計費項目（chargeableLines 的輸出）
	points: Readable<number>; // 可用點數餘額
}

/** freshCheckout = 閉→開邊沿且無付款飛行（重置 + 換發 key；元件據此重置表單並水合）；
 *  resumedInFlight = 閉→開邊沿但付款飛行中（不重置，延續同一結帳流程）；其餘 noop。 */
export type CheckoutOpenOutcome = { kind: 'freshCheckout' } | { kind: 'resumedInFlight' } | { kind: 'noop' };
/** orderPlaced 攜帶成交快照（元件的成功 toast 不必回讀 store）；orderFailed 透傳原始
 *  拋出物（文案分類 orderErrorMessage 留元件）；alreadyPaying/nothingChargeable 是
 *  按鈕 disabled 之外的第二道防線，呼叫端靜默返回。 */
export type ConfirmPayOutcome =
	| { kind: 'orderPlaced'; paid: PaidSummary }
	| { kind: 'orderFailed'; error: unknown }
	| { kind: 'alreadyPaying' }
	| { kind: 'nothingChargeable' };

export interface CheckoutController extends Readable<CheckoutViewState> {
	form: Writable<CheckoutForm>;
	setOpen(open: boolean): CheckoutOpenOutcome;
	toPayment(): void;
	backToCart(): void;
	applyCode(): Promise<void>;
	clearCodeErr(): void;
	removeCoupon(): void;
	confirmPay(): Promise<ConfirmPayOutcome>;
}

const emptyPaid = (): PaidSummary => ({
	total: 0,
	earned: 0,
	ptRedeem: 0,
	hasCourse: false,
	hasPass: false,
	orderNumber: ''
});

const emptyForm = (): CheckoutForm => ({ code: '', usePoints: false, paymentMethod: 'credit_card' });

export function createCheckoutController(deps: CheckoutControllerDeps): CheckoutController {
	let step: 0 | 1 | 2 = 0;
	let paying = false;
	let paid = emptyPaid();
	// 每次結帳流程（freshCheckout）產生一次、失敗重試沿用同一把，讓後端能辨識重放
	// 而不重複扣款/建立報名訂閱（integration-contract.md §1.7）。
	let idempotencyKey = crypto.randomUUID();
	let prevOpen = false;
	let coupon: AppliedCoupon | null = null;
	let codeErr = '';
	// 結帳流程序號：freshCheckout 遞增；applyCode 落地時序號已變 = 回應屬於上一次結帳，丟棄。
	let epoch = 0;

	const form = writable<CheckoutForm>(emptyForm());
	const machine = writable<Omit<CheckoutViewState, 'preview' | 'hasChargeable'>>({ step, paying, paid, coupon, codeErr });
	const publish = (): void => machine.set({ step, paying, paid, coupon, codeErr });
	const store = derived([machine, form, deps.lines, deps.points], ([$m, $form, $lines, $points]): CheckoutViewState => ({
		...$m,
		preview: checkoutMath($lines, $m.coupon, $points, $form.usePoints),
		hasChargeable: $lines.length > 0
	}));

	function setOpen(open: boolean): CheckoutOpenOutcome {
		const edge = open && !prevOpen;
		prevOpen = open; // 含付款飛行中都更新（見檔頭）——promise 落定後的下一次閉→開才重置
		if (!edge) return { kind: 'noop' };
		if (paying) return { kind: 'resumedInFlight' };
		step = 0;
		idempotencyKey = crypto.randomUUID();
		paid = emptyPaid();
		coupon = null;
		codeErr = '';
		epoch += 1;
		form.set(emptyForm());
		publish();
		return { kind: 'freshCheckout' };
	}

	function toPayment(): void {
		step = 1;
		publish();
	}

	function backToCart(): void {
		step = 0;
		publish();
	}

	async function applyCode(): Promise<void> {
		const at = epoch;
		const result = await deps.applyCouponCode(get(form).code);
		if (!result || at !== epoch) return; // 空輸入不顯示錯誤；freshCheckout 之後才落地的回應丟棄
		coupon = result.coupon;
		codeErr = result.codeErr;
		publish();
	}

	function clearCodeErr(): void {
		if (!codeErr) return;
		codeErr = '';
		publish();
	}

	function removeCoupon(): void {
		coupon = null;
		form.update((f) => ({ ...f, code: '' }));
		publish();
	}

	async function confirmPay(): Promise<ConfirmPayOutcome> {
		// alreadyPaying：避免連點造成 syncCartToServer 競態；nothingChargeable（全數
		// 已持有/空車）：沒有可計費項目就不該送單（後端會回 400 cart is empty）——
		// 按鈕已 disabled，這裡是第二道防線。
		if (paying) return { kind: 'alreadyPaying' };
		if (get(deps.lines).length === 0) return { kind: 'nothingChargeable' };
		const { usePoints, paymentMethod } = get(form);
		paying = true;
		publish();
		try {
			const confirmation = await deps.placeOrder(coupon?.code ?? '', usePoints, idempotencyKey, paymentMethod);
			paid = {
				total: confirmation.total,
				earned: confirmation.earned,
				ptRedeem: confirmation.ptRedeem,
				hasCourse: confirmation.hasCourse,
				hasPass: confirmation.hasPass,
				orderNumber: confirmation.orderNumber
			};
			step = 2;
			return { kind: 'orderPlaced', paid };
		} catch (error) {
			return { kind: 'orderFailed', error }; // key 不換發——重試沿用同一把
		} finally {
			paying = false;
			publish();
		}
	}

	return { subscribe: store.subscribe, form, setOpen, toPayment, backToCart, applyCode, clearCodeErr, removeCoupon, confirmPay };
}
