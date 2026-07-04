import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { listCoaches } from '$lib/public/api';
import type { ApiCoach } from '$lib/public/api';

vi.mock('$lib/public/api', () => ({ listCoaches: vi.fn() }));

const COACH: ApiCoach = {
	id: 'coach-uuid-1',
	user_id: 'user-uuid-1',
	title: '資深體操教練',
	bio: null,
	experience: '15年教學經驗',
	specialties: ['競技體操', '跑酷指導'],
	certifications: ['體操A級教練證'],
	is_active: true,
	display_order: 1,
	slug: 'wang',
	photo_url: null,
	created_at: '2026-01-01T00:00:00Z'
};

beforeEach(() => {
	vi.mocked(listCoaches).mockReset();
	vi.mocked(listCoaches).mockResolvedValue([COACH]);
});

describe('教練介紹 (marketing) — 接真 API', () => {
	it('renders the adapted coach (title used as name fallback — CoachResponse has no name field)', async () => {
		const { findAllByText } = render(Page);

		const matches = await findAllByText('資深體操教練');
		// name + title both render the same fallback text — at least 2 occurrences.
		expect(matches.length).toBeGreaterThanOrEqual(2);
	});

	it('renders specialties and certifications from the API', async () => {
		const { findAllByText, findByText } = render(Page);
		await findAllByText('資深體操教練');
		await findByText('競技體操');
		await findByText('體操A級教練證');
	});

	it('error 態:顯示「載入失敗」', async () => {
		vi.mocked(listCoaches).mockReset();
		vi.mocked(listCoaches).mockRejectedValue(new Error('network'));

		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading 態:顯示教練骨架', async () => {
		vi.mocked(listCoaches).mockReset();
		vi.mocked(listCoaches).mockReturnValue(new Promise(() => {})); // never resolves

		const { getByTestId } = render(Page);
		expect(getByTestId('coaches-skeleton')).toBeTruthy();
	});
});
