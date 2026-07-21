import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart, toasts } from '$lib/mobile/stores';
import type { Course } from '$lib/mobile/data';
import { getCourses } from '$lib/mobile/api';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/mobile/api', () => ({ getCourses: vi.fn() }));
// C8（Round 2 批次甲）：候補按鈕現在打真實 POST /waitlist（見 $lib/member/waitlist
// 的 joinWaitlist）——只替換 api()，ApiError 用回真實類別（joinWaitlistErrorMessage
// 靠 instanceof 判斷 409，同 routes/member/courses/page.test.ts 的既有慣例）。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* Task 1(C2 死種子退役):mobile/data.ts 的 CATALOG(值)已退役——改為檔內 inline
 * fixture(2 筆,沿用真實種子 id 3(有空位)/id 5(額滿 spots:0)——下方候補守門
 * 測試需要「唯一額滿課程」與「有空位課程」各一筆)。 */
const CATALOG: Course[] = [
	{ id: '3', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', age: '10–16 歲', icon: 'sparkles', days: '週二 / 週四 19:00', price: 4800, hot: true, coach: '林雅婷', desc: '適合已有翻滾基礎、想挑戰特技與團隊編排的學員。小班 12 人內、雙教練保護。', spots: 1 },
	{ id: '5', name: '跑酷入門班', level: '入門', cat: '跑酷', age: '12 歲以上', icon: 'flame', days: '週日 15:00', price: 3400, hot: false, coach: '王思齊', desc: '在安全環境中學習翻越、落地與移動技巧，建立空間判斷與身體控制。', spots: 0 }
];

/** Waitlist defaults for the shared fakeRouter（同 checkout-api.test.ts /
 *  routes/member/courses/page.test.ts 慣例）：預設 POST /waitlist 回一個成功
 *  join，讓不關心候補 API 細節的既有測試不用逐一配置 mock 也能跑完整個 join
 *  流程。 */
const WAITLIST_DEFAULTS: Record<string, unknown> = {
	'POST /waitlist': (init: RequestInit) => {
		const body = JSON.parse((init.body as string) ?? '{}') as { course_id?: string };
		const course = CATALOG.find((c) => c.id === body.course_id);
		return { id: 'wl-' + body.course_id, course_id: body.course_id, course_name: course?.name ?? '課程', status: 'waiting', created_at: '2026-07-04T00:00:00Z' };
	}
};

beforeEach(() => {
	vi.mocked(getCourses).mockReset();
	vi.mocked(getCourses).mockResolvedValue({ catalog: CATALOG });
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({}, WAITLIST_DEFAULTS));
	// toasts 是 auto-dismiss 的 singleton — 前一個測試的 toast 會殘留到下一個測試,
	// 清掉才能對「某 toast 不得出現」做可靠斷言(同 routes/member/notifications/
	// page.test.ts 的既有慣例)。
	get(toasts).forEach((t) => toasts.dismiss(t.id));
});

afterEach(() => {
	cart.clear();
});

describe('課程介紹 — 候補守門（codex P2 regression；C8 改接真 POST /waitlist）', () => {
	it('adding a full course calls POST /waitlist, shows a waitlist toast, and keeps it out of the paid cart', async () => {
		cart.clear();
		// CATALOG 內唯一額滿（spots 0）課程 → 課程卡的加入鈕顯示「候補」。
		const full = CATALOG.find((c) => c.spots === 0);
		expect(full).toBeDefined();

		render(Page);
		await fireEvent.click(await screen.findByText('候補'));

		await vi.waitFor(() => {
			expect(api).toHaveBeenCalledWith('/waitlist', {
				method: 'POST',
				body: JSON.stringify({ course_id: full!.id })
			});
		});
		// 額滿課程不進付費購物車,且彈出「已加入候補」toast。
		expect(get(cart)).toHaveLength(0);
		expect(get(toasts).some((t) => t.title === '已加入候補')).toBe(true);
	});

	it('a course with spots enters the paid cart and never calls POST /waitlist', async () => {
		const open = CATALOG.find((c) => c.spots > 0);
		expect(open).toBeDefined();

		render(Page);
		await fireEvent.click((await screen.findAllByRole('button', { name: '加入' }))[0]);

		expect(get(cart).length).toBeGreaterThan(0);
		expect(get(toasts).some((t) => t.title === '已加入購物車')).toBe(true);
		expect(vi.mocked(api).mock.calls.some(([p, i]) => p === '/waitlist' && (i as RequestInit)?.method === 'POST')).toBe(false);
	});

	it('重複候補（後端 409 "already on waitlist"）→ 顯示「加入候補失敗」與專屬繁中文案，不顯示「已加入候補」', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /waitlist': new ApiError(409, 'already on waitlist') }, WAITLIST_DEFAULTS));

		render(Page);
		await fireEvent.click(await screen.findByText('候補'));

		await vi.waitFor(() => {
			expect(get(toasts).some((t) => t.title === '加入候補失敗' && t.body === '你已經在候補名單中了')).toBe(true);
		});
		expect(get(cart)).toHaveLength(0);
		expect(get(toasts).some((t) => t.title === '已加入候補')).toBe(false);
	});
});

describe('課程介紹 — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記(data-testid="courses-skeleton")', () => {
		vi.mocked(getCourses).mockReturnValue(new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="courses-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getCourses).mockRejectedValue(new Error('boom'));
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('渲染的課程來自 getCourses 接縫回傳值,而非直接 import 的 seed(相異 fixture)', async () => {
		const fixture = {
			catalog: [
				{
					id: 'zz-9001',
					name: '接縫測試專用課程',
					level: '入門',
					cat: '幼兒體操',
					age: '3-5 歲',
					icon: 'baby' as const,
					days: '週一 10:00–11:00',
					price: 999,
					hot: false,
					coach: '測試教練',
					desc: '僅供接縫測試',
					spots: 5
				}
			]
		};
		vi.mocked(getCourses).mockResolvedValue(fixture);

		render(Page);

		expect(await screen.findByText('接縫測試專用課程')).toBeInTheDocument();
		expect(screen.getByText('共 1 門課程')).toBeInTheDocument();
	});
});
