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
 * plain vitest 用 spy 測,不需要 Testing Library / SvelteKit 的 mock 機制。
 *
 * 同檔另收 member register / reset-password / forgot-password 三頁的 submit
 * 骨架(submitRegister/submitPasswordReset/submitForgot):三頁原本各自手寫同
 * 款「busy 守衛 → 清錯/上鎖 → await → 成功副作用 → catch → finally 解鎖」骨
 * 架,比照 submitLogin 收進本模組、各自持窄 IO 介面——刻意不抽私有共用核心、
 * 不做泛化 submitAuthAction,四函式的成功副作用與 catch 策略互異(register
 * 恆有目標、reset 不導航不登入、forgot 靜默吞錯做 anti-enumeration),硬共用
 * 只會把各自的 order[] 時序契約藏進參數化路徑。 */

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

export const REGISTER_FAILED_ERROR = '註冊失敗，請確認資料或稍後再試';
export const RESET_LINK_INVALID_ERROR = '重設連結無效或已過期，請重新申請';

export interface RegisterSubmitIO {
  busy(): boolean;
  setBusy(b: boolean): void;
  setError(msg: string): void;
  /** 頁面接 authStore.register(name, email, pw)。 */
  register(): Promise<void>;
  /** 恆有目標(頁面接 safeRedirect(?redirect)),無 submitLogin 那款 no-access 分支。 */
  resolveTarget(): string;
  /** finally 解鎖「前」呼叫,與 submitLogin 同款時序契約。 */
  navigate(target: string): void;
}

export async function submitRegister(io: RegisterSubmitIO): Promise<void> {
  if (io.busy()) return; // 再入守衛:上一次提交仍在進行中
  io.setError('');
  io.setBusy(true);
  try {
    await io.register();
    io.navigate(io.resolveTarget());
  } catch {
    io.setError(REGISTER_FAILED_ERROR);
  } finally {
    io.setBusy(false);
  }
}

export interface PasswordResetSubmitIO {
  busy(): boolean;
  setBusy(b: boolean): void;
  setError(msg: string): void;
  /** falsy(null 或空字串)→ 未清錯、未上鎖直接短路,對應現行 `busy || !token`。 */
  token: string | null;
  /** 收守衛窄化後的非空 token(守衛與 payload 單源,不重讀一次可能已變動的欄位)。 */
  reset(token: string): Promise<void>;
  /** done = true;不導航、不登入——後端已撤銷該帳號全部 refresh token。 */
  onSuccess(): void;
}

export async function submitPasswordReset(io: PasswordResetSubmitIO): Promise<void> {
  const token = io.token; // 單源讀取:守衛判斷與後續 payload 共用同一次讀值
  if (io.busy() || !token) return;
  io.setError('');
  io.setBusy(true);
  try {
    await io.reset(token);
    io.onSuccess();
  } catch {
    io.setError(RESET_LINK_INVALID_ERROR);
  } finally {
    io.setBusy(false);
  }
}

export interface ForgotSubmitIO {
  busy(): boolean;
  setBusy(b: boolean): void;
  request(): Promise<void>;
  /** finally、解鎖「後」呼叫,成敗皆呼叫。 */
  onSettled(): void;
  // 刻意無 setError —— anti-enumeration 靜默 catch 由型別結構保證,呼叫端無從誤設錯誤文案。
}

export async function submitForgot(io: ForgotSubmitIO): Promise<void> {
  if (io.busy()) return; // 再入守衛
  io.setBusy(true);
  try {
    await io.request();
  } catch {
    // Anti-enumeration:靜默吞錯,不設任何錯誤文案——成功/失敗兩條路徑對外觀察不到差異。
  } finally {
    io.setBusy(false);
    io.onSettled();
  }
}
