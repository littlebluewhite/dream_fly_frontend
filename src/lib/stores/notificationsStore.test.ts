import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { toAnnouncement } from './notificationsStore';
import type { ApiPost } from '$lib/public/api';

vi.mock('$lib/public/api', () => ({ listPosts: vi.fn() }));

function makePost(overrides: Partial<ApiPost> = {}): ApiPost {
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

describe('toAnnouncement — ApiPost → Notification（公開端點無已讀狀態，一律預設未讀）', () => {
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
		const { listPosts } = await import('$lib/public/api');
		vi.mocked(listPosts).mockResolvedValue([
			makePost({ id: 'a1', category: 'announcement' }),
			makePost({ id: 'a2', category: 'article', title: '不是公告' }) // filtered out
		]);

		const { notificationsStore } = await import('./notificationsStore');
		await vi.waitFor(() => {
			expect(get(notificationsStore)).toHaveLength(1);
		});
		expect(get(notificationsStore)[0]).toMatchObject({ id: 'a1', type: 'announcement' });
	});

	it('degrades to an empty list (not the old hardcoded fallback) when the fetch fails', async () => {
		const { listPosts } = await import('$lib/public/api');
		vi.mocked(listPosts).mockRejectedValue(new Error('network'));

		const { notificationsStore } = await import('./notificationsStore');
		// give the rejected promise's .catch a tick to settle
		await new Promise((r) => setTimeout(r, 0));
		expect(get(notificationsStore)).toEqual([]);
	});
});
