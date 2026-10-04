import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { toAnnouncement } from './notificationsStore';
import type { PostListResponse, PostResponse } from '$lib/api/generated';
import { fakeRouter } from '$lib/testing/fake-router';

// 只假造 HTTP 層：真的 listPosts 會跑（resetModules 後 api 須動態重新 import）
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

describe('notificationsStore — GET /posts 過濾 category===announcement', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('populates the store with only announcement posts, mapped via toAnnouncement', async () => {
		const { api } = await import('$lib/api/client');
		const posts = [
			makePost({ id: 'a1', category: 'announcement' }),
			makePost({ id: 'a2', category: 'article', title: '不是公告' }) // filtered out
		];
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /posts?per_page=100': { posts, total: posts.length, page: 1, per_page: 100 } satisfies PostListResponse
			})
		);

		const { notificationsStore } = await import('./notificationsStore');
		await vi.waitFor(() => {
			expect(get(notificationsStore)).toHaveLength(1);
		});
		expect(get(notificationsStore)[0]).toMatchObject({ id: 'a1', type: 'announcement' });
	});

	it('degrades to an empty list (not the old hardcoded fallback) when the fetch fails', async () => {
		const { api } = await import('$lib/api/client');
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /posts?per_page=100': new Error('network') }));

		const { notificationsStore } = await import('./notificationsStore');
		// give the rejected promise's .catch a tick to settle
		await new Promise((r) => setTimeout(r, 0));
		expect(get(notificationsStore)).toEqual([]);
	});
});
