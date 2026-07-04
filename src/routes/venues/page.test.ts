import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { listVenues } from '$lib/public/api';
import type { ApiVenue } from '$lib/public/api';

vi.mock('$lib/public/api', () => ({ listVenues: vi.fn() }));

const VENUE: ApiVenue = {
	id: 'venue-uuid-1',
	category_id: 'cat-uuid-1',
	name: '大跳床',
	slug: 'trampoline-large',
	description: '專業彈跳訓練，提升空中控制能力',
	features: ['防護網環繞', '專人指導'],
	image_url: null,
	is_active: true,
	created_at: '2026-01-01T00:00:00Z'
};

beforeEach(() => {
	vi.mocked(listVenues).mockReset();
	vi.mocked(listVenues).mockResolvedValue([VENUE]);
});

describe('場館介紹 (marketing) — 僅列表接真 API', () => {
	it('renders the fetched venue name/description/features', async () => {
		const { findByText } = render(Page);
		await findByText('大跳床');
		await findByText('專業彈跳訓練，提升空中控制能力');
		await findByText('防護網環繞');
	});

	it('error 態:顯示「載入失敗」', async () => {
		vi.mocked(listVenues).mockReset();
		vi.mocked(listVenues).mockRejectedValue(new Error('network'));

		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading 態:顯示場館骨架', async () => {
		vi.mocked(listVenues).mockReset();
		vi.mocked(listVenues).mockReturnValue(new Promise(() => {})); // never resolves

		const { getByTestId } = render(Page);
		expect(getByTestId('venues-skeleton')).toBeTruthy();
	});
});
