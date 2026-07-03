import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';
import { getHome } from '$lib/mobile/api';
import { CATALOG, ANNOUNCE, MY_COURSES } from '$lib/mobile/data';

vi.mock('$lib/mobile/api', () => ({ getHome: vi.fn() }));

beforeEach(() => {
	vi.mocked(getHome).mockReset();
	vi.mocked(getHome).mockResolvedValue({ catalog: CATALOG, announce: ANNOUNCE, myCourses: MY_COURSES });
});

describe('首頁 tab — 三態', () => {
	it('loading 分支有可辨識骨架標記(data-testid="mobile-home-skeleton")', () => {
		vi.mocked(getHome).mockReturnValue(new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="mobile-home-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getHome).mockRejectedValue(new Error('boom'));
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('async 載入後顯示下一堂課(相異 fixture,證明資料來自接縫而非直接 import seed)', async () => {
		const fixture = {
			catalog: CATALOG,
			announce: ANNOUNCE,
			myCourses: [
				{
					id: 'zz9',
					name: '接縫測試專用課程',
					cat: '競技體操',
					level: '進階',
					coach: '測試教練',
					icon: 'medal',
					color: '#123456',
					schedule: '週三 09:00–10:00',
					room: 'Z 教室',
					att: 50,
					attended: 5,
					total: 10,
					next: '週三 09:00',
					term: '2026 測試季',
					remain: 1
				}
			]
		};
		vi.mocked(getHome).mockResolvedValue(fixture);

		render(Page);

		expect(await screen.findByText('接縫測試專用課程')).toBeInTheDocument();
		// 「明日」/「19:00」不再是頁面硬編字面,而是拆解 myCourses[0].next(與 mine 卡同一欄位同源)。
		expect(screen.getByText('週三')).toBeInTheDocument();
		expect(screen.getByText('09:00')).toBeInTheDocument();
	});

	it('報名課程為空時 ready 不拋錯,「下一堂課」卡整塊不出現(空集合守衛)', async () => {
		// getHome() 換真 fetch 後,零報名會員會回傳 myCourses: [] — next 為
		// undefined 時不得對 next.name/room/coach deref 拋 TypeError。
		vi.mocked(getHome).mockResolvedValue({ catalog: CATALOG, announce: ANNOUNCE, myCourses: [] });
		render(Page);
		// ready 證據:其餘區塊(熱門課程)照常渲染,不依賴下一堂課卡。
		expect(await screen.findByText('熱門課程')).toBeInTheDocument();
		// 空集合 → 卡整塊消失(首頁不重複 mine 頁的 MEmpty 訊息)。
		expect(screen.queryByText('下一堂課')).toBeNull();
	});
});
