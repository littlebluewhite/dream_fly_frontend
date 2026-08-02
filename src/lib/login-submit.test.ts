import { describe, it, expect, vi } from 'vitest';
import {
  submitLogin,
  EMPTY_FIELDS_ERROR,
  BAD_CREDENTIALS_ERROR,
  NO_ACCESS_ERROR,
  type LoginSubmitIO,
  submitRegister,
  REGISTER_FAILED_ERROR,
  type RegisterSubmitIO,
  submitPasswordReset,
  RESET_LINK_INVALID_ERROR,
  type PasswordResetSubmitIO,
  submitForgot,
  type ForgotSubmitIO
} from './login-submit';

describe('submitLogin', () => {
  it('busy 再入守衛:busy() 為 true 時直接返回,不呼叫任何其餘 IO', async () => {
    const io: LoginSubmitIO = {
      busy: () => true,
      setBusy: vi.fn(),
      setError: vi.fn(),
      login: vi.fn(async () => {}),
      resolveTarget: vi.fn(() => '/target'),
      navigate: vi.fn()
    };

    await submitLogin(io);

    expect(io.setBusy).not.toHaveBeenCalled();
    expect(io.setError).not.toHaveBeenCalled();
    expect(io.login).not.toHaveBeenCalled();
    expect(io.resolveTarget).not.toHaveBeenCalled();
    expect(io.navigate).not.toHaveBeenCalled();
  });

  it('空欄守衛(含全空白):.trim() 後為空即擋下,不上鎖、不呼叫 login', async () => {
    const setBusy = vi.fn();
    const setError = vi.fn();
    const login = vi.fn(async () => {});
    const io: LoginSubmitIO = {
      busy: () => false,
      setBusy,
      setError,
      fields: ['   ', 'validpw'], // 第一欄全空白——釘 .trim() 語意,非單純 falsy 檢查
      login,
      resolveTarget: () => '/target',
      navigate: vi.fn()
    };

    await submitLogin(io);

    expect(setError).toHaveBeenCalledWith(EMPTY_FIELDS_ERROR);
    expect(login).not.toHaveBeenCalled();
    expect(setBusy).not.toHaveBeenCalled(); // 空欄不觸發 busy(沿用現行語意)
  });

  it('成功流程:清 error → 上鎖 → login → resolveTarget → navigate,navigate 於 finally 解鎖前發生', async () => {
    const order: string[] = [];
    const io: LoginSubmitIO = {
      busy: () => false,
      setBusy: (b) => order.push(`setBusy:${b}`),
      setError: (msg) => order.push(`setError:${JSON.stringify(msg)}`),
      login: async () => {
        order.push('login');
      },
      resolveTarget: () => {
        order.push('resolveTarget');
        return '/member';
      },
      navigate: (target) => order.push(`navigate:${target}`)
    };

    await submitLogin(io);

    expect(order).toEqual([
      'setError:""',
      'setBusy:true',
      'login',
      'resolveTarget',
      'navigate:/member',
      'setBusy:false'
    ]);
  });

  it('login 拒絕:標「Email 或密碼錯誤」,不解析目標、不 navigate,finally 仍解鎖', async () => {
    const setBusy = vi.fn();
    const setError = vi.fn();
    const resolveTarget = vi.fn(() => '/member');
    const navigate = vi.fn();
    const io: LoginSubmitIO = {
      busy: () => false,
      setBusy,
      setError,
      login: async () => {
        throw new Error('bad credentials');
      },
      resolveTarget,
      navigate
    };

    await submitLogin(io);

    expect(setError).toHaveBeenCalledWith(BAD_CREDENTIALS_ERROR);
    expect(resolveTarget).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(setBusy).toHaveBeenNthCalledWith(1, true);
    expect(setBusy).toHaveBeenNthCalledWith(2, false);
  });

  it('無後台權限:先 await onNoAccess(登出)再標錯,不 navigate,finally 仍解鎖', async () => {
    const order: string[] = [];
    const setBusy = vi.fn();
    const navigate = vi.fn();
    const io: LoginSubmitIO = {
      busy: () => false,
      setBusy,
      setError: (msg) => order.push(`setError:${msg}`),
      login: async () => {},
      resolveTarget: () => null,
      onNoAccess: async () => {
        order.push('onNoAccess');
      },
      navigate
    };

    await submitLogin(io);

    // 'setError:' 是流程一開始的清空(在 login 之前),之後才是無權限分支的
    // 登出→標錯順序——這裡要釘的是 onNoAccess 先於 NO_ACCESS_ERROR。
    expect(order).toEqual(['setError:', 'onNoAccess', `setError:${NO_ACCESS_ERROR}`]);
    expect(navigate).not.toHaveBeenCalled();
    expect(setBusy).toHaveBeenLastCalledWith(false);
  });

  it('未提供 fields:即使欄位本應為空,也不啟用空欄守衛——login 照常呼叫(守衛不偷加)', async () => {
    const login = vi.fn(async () => {});
    const setError = vi.fn();
    const io: LoginSubmitIO = {
      busy: () => false,
      setBusy: vi.fn(),
      setError,
      // 刻意不傳 fields(member/mobile 的接線方式,兩頁本無空欄守衛)
      login,
      resolveTarget: () => '/mobile',
      navigate: vi.fn()
    };

    await submitLogin(io);

    expect(login).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalledWith(EMPTY_FIELDS_ERROR);
  });
});

describe('submitRegister', () => {
  it('busy 再入守衛:busy() 為 true 時直接返回,不呼叫任何其餘 IO', async () => {
    const io: RegisterSubmitIO = {
      busy: () => true,
      setBusy: vi.fn(),
      setError: vi.fn(),
      register: vi.fn(async () => {}),
      resolveTarget: vi.fn(() => '/member'),
      navigate: vi.fn()
    };

    await submitRegister(io);

    expect(io.setBusy).not.toHaveBeenCalled();
    expect(io.setError).not.toHaveBeenCalled();
    expect(io.register).not.toHaveBeenCalled();
    expect(io.resolveTarget).not.toHaveBeenCalled();
    expect(io.navigate).not.toHaveBeenCalled();
  });

  it('成功流程:清 error → 上鎖 → register → resolveTarget → navigate,navigate 於 finally 解鎖前發生', async () => {
    const order: string[] = [];
    const io: RegisterSubmitIO = {
      busy: () => false,
      setBusy: (b) => order.push(`setBusy:${b}`),
      setError: (msg) => order.push(`setError:${JSON.stringify(msg)}`),
      register: async () => {
        order.push('register');
      },
      resolveTarget: () => {
        order.push('resolveTarget');
        return '/member';
      },
      navigate: (target) => order.push(`navigate:${target}`)
    };

    await submitRegister(io);

    expect(order).toEqual([
      'setError:""',
      'setBusy:true',
      'register',
      'resolveTarget',
      'navigate:/member',
      'setBusy:false'
    ]);
  });

  it('register 拒絕:標「註冊失敗，請確認資料或稍後再試」,不解析目標、不 navigate,finally 仍解鎖', async () => {
    const setBusy = vi.fn();
    const setError = vi.fn();
    const resolveTarget = vi.fn(() => '/member');
    const navigate = vi.fn();
    const io: RegisterSubmitIO = {
      busy: () => false,
      setBusy,
      setError,
      register: async () => {
        throw new Error('email already registered');
      },
      resolveTarget,
      navigate
    };

    await submitRegister(io);

    expect(setError).toHaveBeenCalledWith(REGISTER_FAILED_ERROR);
    expect(resolveTarget).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(setBusy).toHaveBeenNthCalledWith(1, true);
    expect(setBusy).toHaveBeenNthCalledWith(2, false);
  });
});

describe('submitPasswordReset', () => {
  it('token 為 null:未清錯、未上鎖直接短路,不呼叫 reset/onSuccess', async () => {
    const order: string[] = [];
    const reset = vi.fn(async () => {});
    const onSuccess = vi.fn();
    const io: PasswordResetSubmitIO = {
      busy: () => false,
      setBusy: (b) => order.push(`setBusy:${b}`),
      setError: (msg) => order.push(`setError:${msg}`),
      token: null,
      reset,
      onSuccess
    };

    await submitPasswordReset(io);

    expect(order).toEqual([]);
    expect(reset).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('token 為空字串:一樣視為 falsy,未清錯、未上鎖直接短路', async () => {
    const order: string[] = [];
    const reset = vi.fn(async () => {});
    const io: PasswordResetSubmitIO = {
      busy: () => false,
      setBusy: (b) => order.push(`setBusy:${b}`),
      setError: (msg) => order.push(`setError:${msg}`),
      token: '',
      reset,
      onSuccess: vi.fn()
    };

    await submitPasswordReset(io);

    expect(order).toEqual([]);
    expect(reset).not.toHaveBeenCalled();
  });

  it('成功流程:清 error → 上鎖 → reset(窄化後的非空 token) → onSuccess,onSuccess 於 finally 解鎖前發生', async () => {
    const order: string[] = [];
    const io: PasswordResetSubmitIO = {
      busy: () => false,
      setBusy: (b) => order.push(`setBusy:${b}`),
      setError: (msg) => order.push(`setError:${JSON.stringify(msg)}`),
      token: 'reset-tok-1',
      reset: async (token) => {
        order.push(`reset:${token}`);
      },
      onSuccess: () => order.push('onSuccess')
    };

    await submitPasswordReset(io);

    expect(order).toEqual([
      'setError:""',
      'setBusy:true',
      'reset:reset-tok-1',
      'onSuccess',
      'setBusy:false'
    ]);
  });

  it('reset 拒絕:標「重設連結無效或已過期，請重新申請」,不呼叫 onSuccess,finally 仍解鎖', async () => {
    const setBusy = vi.fn();
    const setError = vi.fn();
    const onSuccess = vi.fn();
    const io: PasswordResetSubmitIO = {
      busy: () => false,
      setBusy,
      setError,
      token: 'bad-tok',
      reset: async () => {
        throw new Error('invalid or expired token');
      },
      onSuccess
    };

    await submitPasswordReset(io);

    expect(setError).toHaveBeenCalledWith(RESET_LINK_INVALID_ERROR);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(setBusy).toHaveBeenNthCalledWith(1, true);
    expect(setBusy).toHaveBeenNthCalledWith(2, false);
  });
});

describe('submitForgot', () => {
  it('busy 再入守衛:busy() 為 true 時直接返回,不呼叫任何其餘 IO', async () => {
    const io: ForgotSubmitIO = {
      busy: () => true,
      setBusy: vi.fn(),
      request: vi.fn(async () => {}),
      onSettled: vi.fn()
    };

    await submitForgot(io);

    expect(io.setBusy).not.toHaveBeenCalled();
    expect(io.request).not.toHaveBeenCalled();
    expect(io.onSettled).not.toHaveBeenCalled();
  });

  it('成功時序:上鎖 → request → 解鎖 → onSettled(解鎖「後」呼叫,對應現行 finally 內 busy 先於 submitted)', async () => {
    const order: string[] = [];
    const io: ForgotSubmitIO = {
      busy: () => false,
      setBusy: (b) => order.push(`setBusy:${b}`),
      request: async () => {
        order.push('request');
      },
      onSettled: () => order.push('onSettled')
    };

    await submitForgot(io);

    expect(order).toEqual(['setBusy:true', 'request', 'setBusy:false', 'onSettled']);
  });

  it('request 拒絕時與成功同型結局(anti-enumeration:外界不可分辨),await 不外拋', async () => {
    const order: string[] = [];
    const io: ForgotSubmitIO = {
      busy: () => false,
      setBusy: (b) => order.push(`setBusy:${b}`),
      request: async () => {
        order.push('request');
        throw new Error('network down');
      },
      onSettled: () => order.push('onSettled')
    };

    await expect(submitForgot(io)).resolves.toBeUndefined();

    expect(order).toEqual(['setBusy:true', 'request', 'setBusy:false', 'onSettled']);
  });
});
