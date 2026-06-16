import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { goto } from '$app/navigation';
import DetailPageTemplate from './DetailPageTemplate.svelte';

vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

beforeEach(() => {
  vi.mocked(goto).mockClear();
});

/* DetailPageTemplate is the single funnel every placehold.co image flows
 * through (hero + gallery on the 20 detail pages). It must route those URLs
 * into BrandedPlaceholder — i.e. render the on-brand [role=img] block and emit
 * NO <img> that points at placehold.co. */
describe('DetailPageTemplate placeholder routing', () => {
  const base = {
    title: '兒童體操班',
    description: '<p>課程說明</p>',
    heroImage: 'https://placehold.co/1200x400?text=兒童體操',
    gallery: [
      'https://placehold.co/800x600?text=上課實況',
      'https://placehold.co/800x600?text=設備介紹'
    ]
  };

  it('renders branded blocks (role=img) instead of raw placehold.co <img> for hero + gallery', () => {
    const { container } = render(DetailPageTemplate, base);
    // No <img> may point at placehold.co — all of them are branded blocks now.
    const placeholdImgs = Array.from(container.querySelectorAll('img')).filter((img) =>
      (img.getAttribute('src') ?? '').includes('placehold.co')
    );
    expect(placeholdImgs).toHaveLength(0);
    // hero (1) + gallery (2) = 3 branded blocks.
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(3);
  });

  it('shows gallery captions but suppresses the hero caption (overlay already shows the title)', () => {
    const { getByText, queryAllByText } = render(DetailPageTemplate, base);
    expect(getByText('上課實況')).toBeTruthy();
    expect(getByText('設備介紹')).toBeTruthy();
    // hero passes showCaption=false, so the title only appears in the .hero-title overlay (h1), not as a placeholder caption.
    expect(queryAllByText('兒童體操班')).toHaveLength(1);
  });
});

/* The CTA keeps its overridable ctaAction prop, but the DEFAULT now navigates
 * to /contact (was a dead alert() stub). */
describe('DetailPageTemplate default CTA', () => {
  it('navigates to /contact when the CTA is clicked with no ctaAction override', async () => {
    const { getByRole } = render(DetailPageTemplate, {
      title: 'X',
      description: '<p>x</p>',
      heroImage: 'https://placehold.co/1200x400'
    });
    await fireEvent.click(getByRole('button', { name: '立即預約' }));
    expect(goto).toHaveBeenCalledWith('/contact');
  });

  it('still honours a ctaAction override (does not force navigation)', async () => {
    const ctaAction = vi.fn();
    const { getByRole } = render(DetailPageTemplate, {
      title: 'X',
      description: '<p>x</p>',
      heroImage: 'https://placehold.co/1200x400',
      ctaAction
    });
    await fireEvent.click(getByRole('button', { name: '立即預約' }));
    expect(ctaAction).toHaveBeenCalledOnce();
    expect(goto).not.toHaveBeenCalled();
  });
});
