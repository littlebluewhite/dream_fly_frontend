import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { listCoaches } from '$lib/public/api';
import type { ApiCoach } from '$lib/public/api';

vi.mock('$lib/public/api', () => ({ listCoaches: vi.fn() }));

const COACH: ApiCoach = {
	id: 'coach-uuid-1',
	user_id: 'user-uuid-1',
	name: '王雅婷',
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
	it('renders the adapted coach with name and title as distinct fields (CoachResponse §3.4 now carries both)', async () => {
		const { findByText } = render(Page);

		await findByText('王雅婷'); // <h3>{coach.name}</h3>
		await findByText('資深體操教練'); // <p class="coach-title">{coach.title}</p>
	});

	it('renders specialties and certifications from the API', async () => {
		const { findByText } = render(Page);
		await findByText('王雅婷');
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
