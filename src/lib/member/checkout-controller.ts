/* Dream Fly — member 結帳付款狀態機（自 member/components/CheckoutDialog.svelte 抽出）。
 * 收的是「付款生命週期」——有跨事件不變量的四個變數：step（open-reset 歸 0、成功轉 2）、
 * idempotencyKey（重試沿用、fresh 換發——防重複扣款安全機的核心）、paid（成交快照，
 * 購物車清空後成功步仍要顯示）、paying（in-flight 守衛本身）。表單/預覽輸入
 * （code/coupon/usePoints/paymentMethod）是預覽關注，留元件，confirmPay 呼叫瞬間以
 * 引數讀取一次；applyCode（優惠碼預覽 + 404 文案）整段留元件。
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
 * deps 注入只有 placeOrder 一支（confirmPay 的唯一效應）；開啟即水合的
 * refreshSubscriptions/refreshPoints 屬 open-reset 時刻的元件佈線，不入 deps。member
 * 專屬、非 twin：mobile 的 placeOrder（mobile/stores.ts）每次呼叫預設換發新 key，
 * CartSheet 無「重試沿用同一把」的對話框狀態機。無 svelte 元件相依、建構零 dep 呼叫
 * （SSR 安全）。本抽取取代 ADR 0008 §「有意識保留：CheckoutDialog 的防重複扣款不抽成
 * 純模組」的當時裁決（Round 5；render 測試原封全綠 = 搬動零 churn 的證明）。 */
import { writable, type Readable } from 'svelte/store';
import type { PaymentMethod } from '$lib/checkout-order';

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

export interface CheckoutViewState {
	step: 0 | 1 | 2; // 0 購物車 / 1 結帳付款 / 2 完成
	paying: boolean;
	paid: PaidSummary;
}

export interface CheckoutControllerDeps {
	placeOrder: (
		coupon: string,
		usePoints: boolean,
		idempotencyKey: string,
		paymentMethod: PaymentMethod
	) => Promise<PaidSummary>;
}

/** confirmPay 的表單/預覽輸入——呼叫瞬間讀取一次（controller 不訂閱元件表單狀態）。 */
export interface ConfirmPayInput {
	coupon: string; // 已套用優惠碼的 code，無則空字串
	usePoints: boolean;
	paymentMethod: PaymentMethod;
	hasChargeable: boolean; // 呼叫瞬間 chargeable.length > 0——空車/全數已持有的第二道防線
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
	setOpen(open: boolean): CheckoutOpenOutcome;
	toPayment(): void;
	backToCart(): void;
	confirmPay(input: ConfirmPayInput): Promise<ConfirmPayOutcome>;
}

const emptyPaid = (): PaidSummary => ({
	total: 0,
	earned: 0,
	ptRedeem: 0,
	hasCourse: false,
	hasPass: false,
	orderNumber: ''
});

export function createCheckoutController(deps: CheckoutControllerDeps): CheckoutController {
	let step: 0 | 1 | 2 = 0;
	let paying = false;
	let paid = emptyPaid();
	// 每次結帳流程（freshCheckout）產生一次、失敗重試沿用同一把，讓後端能辨識重放
	// 而不重複扣款/建立報名訂閱（integration-contract.md §1.7）。
	let idempotencyKey = crypto.randomUUID();
	let prevOpen = false;

	const store = writable<CheckoutViewState>({ step, paying, paid });
	const publish = (): void => store.set({ step, paying, paid });

	function setOpen(open: boolean): CheckoutOpenOutcome {
		const edge = open && !prevOpen;
		prevOpen = open; // 含付款飛行中都更新（見檔頭）——promise 落定後的下一次閉→開才重置
		if (!edge) return { kind: 'noop' };
		if (paying) return { kind: 'resumedInFlight' };
		step = 0;
		idempotencyKey = crypto.randomUUID();
		paid = emptyPaid();
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

	async function confirmPay(input: ConfirmPayInput): Promise<ConfirmPayOutcome> {
		// alreadyPaying：避免連點造成 syncCartToServer 競態；nothingChargeable（全數
		// 已持有/空車）：沒有可計費項目就不該送單（後端會回 400 cart is empty）——
		// 按鈕已 disabled，這裡是第二道防線。
		if (paying) return { kind: 'alreadyPaying' };
		if (!input.hasChargeable) return { kind: 'nothingChargeable' };
		paying = true;
		publish();
		try {
			const confirmation = await deps.placeOrder(input.coupon, input.usePoints, idempotencyKey, input.paymentMethod);
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

	return { subscribe: store.subscribe, setOpen, toPayment, backToCart, confirmPay };
}
