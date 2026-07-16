import { describe, it, expect } from 'vitest';
// 卡 3 identity pins：mobile/auth 是 google-oauth 效應模組的零複製轉手 seam
// （同 stores.test.ts 對存量 re-export 塊的釘法）——以 toBe 釘住三個符號都是
// member 側同一個 binding，源路徑漂移或改成本地重包裝時直接紅燈。行為本身
// （URL 組裝/state 產生驗證清除）由 $lib/member/google-oauth.test.ts 覆蓋，
// 登入兩頁的端對端佈線由 routes/mobile/login 兩個 page.test 覆蓋，這裡不重測。
import * as mobileAuth from './auth';
import * as memberGoogleOauth from '$lib/member/google-oauth';

describe('mobile/auth — google-oauth 效應接縫 identity pins', () => {
	it('三個轉手符號與 $lib/member/google-oauth 同參照(toBe,不是複本)', () => {
		expect(mobileAuth.isGoogleLoginEnabled).toBe(memberGoogleOauth.isGoogleLoginEnabled);
		expect(mobileAuth.startGoogleLogin).toBe(memberGoogleOauth.startGoogleLogin);
		expect(mobileAuth.consumeGoogleOauthState).toBe(memberGoogleOauth.consumeGoogleOauthState);
	});
});
