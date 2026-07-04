import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '$lib/api/client';
import {
	listCourses,
	listCoaches,
	listVenues,
	getSchedule,
	sendContactInquiry,
	listPosts
} from './api';

vi.mock('$lib/api/client', () => ({ api: vi.fn() }));

beforeEach(() => {
	vi.mocked(api).mockReset();
});

describe('public/api.ts — 公開端點一律 auth:false', () => {
	it('listCourses unwraps the {courses,...} pagination envelope and requests per_page=100', async () => {
		vi.mocked(api).mockResolvedValue({ courses: [{ id: 'c1' }], total: 1, page: 1, per_page: 100 });

		const result = await listCourses();

		expect(api).toHaveBeenCalledWith('/courses?per_page=100', { auth: false });
		expect(result).toEqual([{ id: 'c1' }]);
	});

	it('listCoaches returns the plain array as-is (no pagination envelope)', async () => {
		vi.mocked(api).mockResolvedValue([{ id: 'co1' }]);

		const result = await listCoaches();

		expect(api).toHaveBeenCalledWith('/coaches', { auth: false });
		expect(result).toEqual([{ id: 'co1' }]);
	});

	it('listVenues returns the plain array as-is', async () => {
		vi.mocked(api).mockResolvedValue([{ id: 'v1' }]);

		const result = await listVenues();

		expect(api).toHaveBeenCalledWith('/venues', { auth: false });
		expect(result).toEqual([{ id: 'v1' }]);
	});

	it('getSchedule passes year/month as query params', async () => {
		vi.mocked(api).mockResolvedValue([{ date: '2026-07-01', slots: [] }]);

		const result = await getSchedule(2026, 7);

		expect(api).toHaveBeenCalledWith('/schedule?year=2026&month=7', { auth: false });
		expect(result).toEqual([{ date: '2026-07-01', slots: [] }]);
	});

	it('sendContactInquiry POSTs the payload as JSON', async () => {
		const payload = { name: '王小明', email: 'a@b.com', subject: '一般諮詢', message: '你好' };
		vi.mocked(api).mockResolvedValue({ id: 'inq1', ...payload, phone: null, status: 'new', assigned_to: null, created_at: '', updated_at: '' });

		await sendContactInquiry(payload);

		expect(api).toHaveBeenCalledWith('/contact', {
			method: 'POST',
			body: JSON.stringify(payload),
			auth: false
		});
	});

	it('listPosts unwraps the {posts,...} pagination envelope and requests per_page=100', async () => {
		vi.mocked(api).mockResolvedValue({ posts: [{ id: 'p1' }], total: 1, page: 1, per_page: 100 });

		const result = await listPosts();

		expect(api).toHaveBeenCalledWith('/posts?per_page=100', { auth: false });
		expect(result).toEqual([{ id: 'p1' }]);
	});
});
