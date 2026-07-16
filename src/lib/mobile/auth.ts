/* Dream Fly — 行動版會員 App · Google OAuth 效應接縫（卡 3）。
 *
 * mobile 的登入兩頁（login/+page@、login/google/+page@）一律經這裡取用 member 側
 * 的 google-oauth 模組——startGoogleLogin/consumeGoogleOauthState 讀寫
 * sessionStorage 與 window.location，是效應性模組，不在 ADR 0009 純函式跨 surface
 * 直取的豁免範圍內，故比照 stores.ts/api.ts 的 seam 慣例收編。實作單源仍在
 * $lib/member/google-oauth（callbackPath 已參數化，mobile 呼叫端自行傳
 * '/mobile/login/google'，見登入頁），這裡零複製、只轉手。 */
export { isGoogleLoginEnabled, startGoogleLogin, consumeGoogleOauthState } from '$lib/member/google-oauth';
