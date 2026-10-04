import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { venueResponse } from '$lib/testing/wire-fixtures';

// 只假造 HTTP 層：真的 listVenues + mapper 會跑
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const VENUE = venueResponse({
	id: 'venue-uuid-1',
	category_id: 'cat-uuid-1',
	name: '大跳床',
	slug: 'trampoline-large',
	description: '專業彈跳訓練，提升空中控制能力',
	features: ['防護網環繞', '專人指導'],
	created_at: '2026-01-01T00:00:00Z'
});

const route = (value: unknown) => vi.mocked(api).mockImplementation(fakeRouter({ 'GET /venues': value }));

beforeEach(() => {
	vi.mocked(api).mockReset();
	route([VENUE]);
});

describe('場館介紹 (marketing) — 僅列表接真 API', () => {
	it('renders the fetched venue name/description/features', async () => {
		const { findByText } = render(Page);
		await findByText('大跳床');
		await findByText('專業彈跳訓練，提升空中控制能力');
		await findByText('防護網環繞');
	});

	it('error 態:顯示「載入失敗」', async () => {
		route(new Error('network'));

		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading 態:顯示場館骨架', async () => {
		route(new Promise(() => {})); // never resolves

		const { getByTestId } = render(Page);
		expect(getByTestId('venues-skeleton')).toBeTruthy();
	});
});
