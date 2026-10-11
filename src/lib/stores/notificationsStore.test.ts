import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	toAnnouncement,
	notificationsStore,
	unreadAnnouncements,
	hydrateAnnouncements,
	resetAnnouncementsForTests
} from './notificationsStore';
import type { PostListResponse, PostResponse } from '$lib/api/generated';
import { fakeRouter } from '$lib/testing/fake-router';
import { api } from '$lib/api/client';

// 只假造 HTTP 層：真的 listPosts 會跑
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

function makePost(overrides: Partial<PostResponse> = {}): PostResponse {
	return {
		id: 'post-1',
		author_id: 'author-1',
		title: '暑假課程開放報名',
		slug: 'summer-course',
		excerpt: '即日起開放暑假課程線上報名',
		category: 'announcement',
		status: 'published',
		cover_image: null,
		published_at: '2026-07-01T00:00:00Z',
		created_at: '2026-06-30T00:00:00Z',
		...overrides
	};
}

describe('toAnnouncement — PostResponse → Notification（公開端點無已讀狀態，一律預設未讀）', () => {
	it('maps id/title/excerpt/published_at and defaults read to false', () => {
		expect(toAnnouncement(makePost())).toEqual({
			id: 'post-1',
			type: 'announcement',
			title: '暑假課程開放報名',
			message: '即日起開放暑假課程線上報名',
			timestamp: '2026-07-01T00:00:00Z',
			read: false
		});
	});

	it('falls back to created_at when published_at is null', () => {
		expect(toAnnouncement(makePost({ published_at: null })).timestamp).toBe(
			'2026-06-30T00:00:00Z'
		);
	});

	it('falls back to "" for a null excerpt', () => {
		expect(toAnnouncement(makePost({ excerpt: null })).message).toBe('');
	});
});

describe('notificationsStore — import 時不打 GET /posts（水合由根 layout 暖機觸發）', () => {
	it('模組載入後 api 零呼叫、store 為空', () => {
		// 本檔頂端已 import 該模組；api 為全新 vi.fn，載入期間若有抓取會留下呼叫紀錄。
		expect(vi.mocked(api)).not.toHaveBeenCalled();
		expect(get(notificationsStore)).toEqual([]);
	});
});

describe('hydrateAnnouncements — 經水合閘門抓 GET /posts 並過濾 category===announcement', () => {
	const ROUTE = 'GET /posts?per_page=100';
	const page = (posts: PostResponse[]): PostListResponse => ({ posts, total: posts.length, page: 1, per_page: 100 });
	const postGets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/posts?per_page=100').length;

	beforeEach(() => {
		resetAnnouncementsForTests();
		vi.mocked(api).mockReset();
	});

	it('populates the store with only announcement posts, mapped via toAnnouncement', async () => {
		const posts = [
			makePost({ id: 'a1', category: 'announcement' }),
			makePost({ id: 'a2', category: 'article', title: '不是公告' }) // filtered out
		];
		vi.mocked(api).mockImplementation(fakeRouter({ [ROUTE]: page(posts) }));

		await hydrateAnnouncements();

		expect(get(notificationsStore)).toHaveLength(1);
		expect(get(notificationsStore)[0]).toMatchObject({ id: 'a1', type: 'announcement' });
		expect(get(unreadAnnouncements)).toBe(1);
	});

	it('抓取失敗會 throw、store 維持空；閘門未水合，下次可重試', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ [ROUTE]: new Error('network') }));
		await expect(hydrateAnnouncements()).rejects.toThrow('network');
		expect(get(notificationsStore)).toEqual([]);

		vi.mocked(api).mockImplementation(fakeRouter({ [ROUTE]: page([makePost({ id: 'a1' })]) }));
		await hydrateAnnouncements();
		expect(get(notificationsStore).map((n) => n.id)).toEqual(['a1']);
		expect(postGets()).toBe(2);
	});

	it('已水合不重抓', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ [ROUTE]: page([makePost()]) }));
		await hydrateAnnouncements();
		await hydrateAnnouncements();
		expect(postGets()).toBe(1);
	});
});
