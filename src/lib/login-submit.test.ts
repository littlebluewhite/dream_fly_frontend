import { describe, it, expect, vi } from 'vitest';
import {
  submitLogin,
  EMPTY_FIELDS_ERROR,
  BAD_CREDENTIALS_ERROR,
  NO_ACCESS_ERROR,
  type LoginSubmitIO
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
