/* Dream Fly — login submit 骨架(四 surface 共用純編排)。
 *
 * member/mobile/mobile-admin/staff 四份 login 頁的 submit() 曾是同構骨架四生:
 * busy 再入守衛 → (staff 系兩頁多一道空欄守衛)→ 清 error/上鎖 → login →
 * 解析導航目標(mobile-admin/staff 依角色路由,無權限先登出再標錯;member/
 * mobile 恆有目標)→ navigate → catch 轉錯誤文案 → finally 解鎖。本模組把這套
 * 編排收成單一 factory,四頁只留 IO callback 接線。
 *
 * IO-callback 形,不是 store 形:頁面保留原生 `let busy/error`,markup 零改;
 * 換成 store 形會逼四頁多出 `$busy`/`$error` 訂閱 churn,不值得。
 *
 * navigate 收進骨架、於 finally 解鎖「前」呼叫(P2 級時序契約):保留現行
 * 「goto 發生於 busy=true 時」的可觀測順序——若改為呼叫端在 await 之後自行
 * goto,這裡的 finally 會搶先解鎖,按鈕態(disabled={busy})與測試的 mock
 * 讀序都會位移。navigate 本身不 await(沿用現行 `goto(...)` 不等待的呼法)。
 *
 * fields 守衛選配:未提供時(member/mobile)完全不檢查,零行為變更;提供時
 * (mobile-admin/staff 對傳 [account, pw])用 `.trim()` 語意判空,和現行
 * `!account.trim() || !pw.trim()` 逐字等價。
 *
 * 零 $app import——沿用 checkout-gate/load-gate/hydration-gate 的純編排慣例,
 * plain vitest 用 spy 測,不需要 Testing Library / SvelteKit 的 mock 機制。 */

export const EMPTY_FIELDS_ERROR = '請輸入帳號與密碼';
export const BAD_CREDENTIALS_ERROR = 'Email 或密碼錯誤';
export const NO_ACCESS_ERROR = '此帳號無後台權限';

export interface LoginSubmitIO {
  busy(): boolean;
  setBusy(b: boolean): void;
  setError(msg: string): void;
  /** 選配:提供即啟用空欄守衛(僅 staff/mobile-admin 對傳 [account, pw])。 */
  fields?: string[];
  login(): Promise<void>;
  /** null = 無後台權限。 */
  resolveTarget(): string | null;
  /** resolveTarget() 回傳 null 時,先 await(登出)再標錯——順序為 invariant。 */
  onNoAccess?(): Promise<void>;
  /** resolveTarget() 成功後、finally 解鎖「前」呼叫。 */
  navigate(target: string): void;
}

export async function submitLogin(io: LoginSubmitIO): Promise<void> {
  if (io.busy()) return; // 再入守衛:上一次提交仍在進行中
  if (io.fields && io.fields.some((f) => !f.trim())) {
    io.setError(EMPTY_FIELDS_ERROR);
    return; // 未上鎖就返回,沿用現行「空欄不觸發 busy」語意
  }
  io.setError('');
  io.setBusy(true);
  try {
    await io.login();
    const target = io.resolveTarget();
    if (target === null) {
      await io.onNoAccess?.();
      io.setError(NO_ACCESS_ERROR);
    } else {
      io.navigate(target);
    }
  } catch {
    io.setError(BAD_CREDENTIALS_ERROR);
  } finally {
    io.setBusy(false);
  }
}
