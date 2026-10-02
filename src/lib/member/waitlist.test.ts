/* Dream Fly — member/waitlist.ts 接線單測(原 checkout-api.test.ts 的候補段):
 * HTTP 路徑與 body、成功後 store 內容、錯誤文案。閘門協定(guard 短路、換身分重置、
 * 在飛作廢、和解重抓)的釘子住 hydration-gate.test.ts / session-gate.test.ts。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { waitlist, hydrateWaitlist, joinWaitlist, cancelWaitlist, joinWaitlistErrorMessage } from './stores';
import { resetSessionStores } from '$lib/testing/session-reset';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

beforeEach(async () => {
  vi.mocked(api).mockReset();
  waitlist.set([]);
  await resetSessionStores(); // 模組單例閘門:登入→登出走一圈,不重置會跨 it 洩漏
});

describe('hydrateWaitlist', () => {
  it('GET /waitlist/me → 只留 status=waiting，映射成 WaitlistEntry（id/course_id/course_name）', async () => {
    vi.mocked(api).mockResolvedValue([
      { id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-01T00:00:00Z' },
      { id: 'wl-2', course_id: 'course-uuid-8', course_name: '課程B', status: 'cancelled', created_at: '2026-06-01T00:00:00Z' }
    ]);

    await hydrateWaitlist();

    expect(api).toHaveBeenCalledWith('/waitlist/me');
    // cancelled 的歷史紀錄不算「候補中」— 同 refreshSubscriptions 對 expired/cancelled 的處理慣例。
    expect(get(waitlist)).toEqual([{ id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A' }]);
  });

  it('全部都是 cancelled → waitlist 清空', async () => {
    vi.mocked(api).mockResolvedValue([
      { id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A', status: 'cancelled', created_at: '2026-06-01T00:00:00Z' }
    ]);

    await hydrateWaitlist();

    expect(get(waitlist)).toEqual([]);
  });
});

describe('joinWaitlist', () => {
  it('POST /waitlist 帶 course_id；成功後把回應塞進 store 最前面（新到舊，同 GET /waitlist/me 的排序）', async () => {
    waitlist.set([{ id: 'wl-old', course_id: 'course-uuid-1', course_name: '舊候補課程' }]);
    vi.mocked(api).mockResolvedValue({
      id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-04T00:00:00Z'
    });

    const entry = await joinWaitlist('course-uuid-9');

    expect(api).toHaveBeenCalledWith('/waitlist', {
      method: 'POST',
      body: JSON.stringify({ course_id: 'course-uuid-9' })
    });
    expect(entry).toEqual({ id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A' });
    expect(get(waitlist)).toEqual([
      { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A' },
      { id: 'wl-old', course_id: 'course-uuid-1', course_name: '舊候補課程' }
    ]);
  });

  it('後端 409（重複候補）原樣拋出，不寫入 store', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(409, 'already on waitlist'));

    await expect(joinWaitlist('course-uuid-9')).rejects.toBeInstanceOf(ApiError);
    expect(get(waitlist)).toEqual([]);
  });
});

describe('cancelWaitlist', () => {
  it('DELETE /waitlist/{id}；成功後從 store 移除該筆（204 No Content，同 syncCartToServer 的 DELETE /cart 慣例）', async () => {
    waitlist.set([
      { id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A' },
      { id: 'wl-2', course_id: 'course-uuid-8', course_name: '課程B' }
    ]);
    vi.mocked(api).mockResolvedValue(undefined);

    await cancelWaitlist('wl-1');

    expect(api).toHaveBeenCalledWith('/waitlist/wl-1', { method: 'DELETE' });
    expect(get(waitlist)).toEqual([{ id: 'wl-2', course_id: 'course-uuid-8', course_name: '課程B' }]);
  });

  it('失敗時原樣拋出，store 不變', async () => {
    waitlist.set([{ id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A' }]);
    vi.mocked(api).mockRejectedValue(new ApiError(404, 'waitlist entry not found'));

    await expect(cancelWaitlist('wl-1')).rejects.toBeInstanceOf(ApiError);
    expect(get(waitlist)).toEqual([{ id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A' }]);
  });
});

describe('joinWaitlistErrorMessage', () => {
  // 後端錯誤字串逐字對照 waitlist service 原始碼（dream_fly_backend/src/modules/waitlist/service.rs）。
  it('後端 409 "already on waitlist"（重複候補）→ 專屬繁中文案', () => {
    expect(joinWaitlistErrorMessage(new ApiError(409, 'already on waitlist'))).toBe('你已經在候補名單中了');
  });

  it('其餘錯誤（如課程未滿班的 409、網路失敗、非 ApiError）→ 通用 fallback', () => {
    expect(joinWaitlistErrorMessage(new ApiError(409, 'course is not full'))).toBe('加入候補失敗，請稍後再試');
    expect(joinWaitlistErrorMessage(new ApiError(500, 'internal error'))).toBe('加入候補失敗，請稍後再試');
    expect(joinWaitlistErrorMessage(new Error('network'))).toBe('加入候補失敗，請稍後再試');
  });
});
