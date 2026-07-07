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

	it('有報名課程但 next 是空字串(真後端 getMine() 的既有 P2 預設值)時,「下一堂課」卡也不出現,不留殘缺日期卡', async () => {
		// member/api.ts 的 getMine() 對 next(下一堂相對時間)誠實給空字串預設值
		// (無法安全推導,見該檔案註解)——空字串 split(' ') 只會產生 1 個元素,
		// 若沒有守衛,nextTime 會解構成 undefined,卡片會顯示一個內容殘缺的日期。
		vi.mocked(getHome).mockResolvedValue({
			catalog: CATALOG,
			announce: ANNOUNCE,
			myCourses: [
				{
					id: 'zz9', name: '接縫測試專用課程', cat: '競技體操', level: '進階', coach: '測試教練',
					icon: 'medal', color: '#123456', schedule: '週三 09:00–10:00', room: 'Z 教室',
					att: 50, attended: 5, total: 10, next: '', term: '2026 測試季', remain: 1
				}
			]
		});
		render(Page);
		expect(await screen.findByText('熱門課程')).toBeInTheDocument();
		expect(screen.queryByText('下一堂課')).toBeNull();
		expect(screen.queryByText('接縫測試專用課程')).toBeNull(); // 卡片整塊不出現,不是只藏日期
	});
});
