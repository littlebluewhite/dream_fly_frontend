import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BrandedPlaceholder from './BrandedPlaceholder.svelte';

/* BrandedPlaceholder swaps the 20 detail pages' placehold.co stand-ins for an
 * on-brand block, while passing real image URLs straight through to <img>. The
 * placeholder branch must NOT emit an <img> (so a broken external host never
 * shows a broken-image glyph); the real branch MUST. */
describe('BrandedPlaceholder', () => {
  const PLACEHOLDER = 'https://placehold.co/800x600?text=幼兒體操';
  const REAL = 'https://example.com/a.jpg';

  it('renders the on-brand block (role=img, no <img>) for a placehold.co src', () => {
    const { container } = render(BrandedPlaceholder, { src: PLACEHOLDER, alt: '幼兒體操' });
    expect(container.querySelector('[role="img"]')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the decoded ?text caption inside the branded block', () => {
    const { getByText } = render(BrandedPlaceholder, { src: PLACEHOLDER, alt: 'alt fallback' });
    expect(getByText('幼兒體操')).toBeTruthy();
  });

  it('labels the branded block with the caption for assistive tech', () => {
    const { container } = render(BrandedPlaceholder, { src: PLACEHOLDER, alt: 'alt fallback' });
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('幼兒體操');
  });

  it('shows the gold 示意圖 sub-label in the branded block', () => {
    const { getByText } = render(BrandedPlaceholder, { src: PLACEHOLDER, alt: '幼兒體操' });
    expect(getByText('示意圖 · 實拍照片整備中')).toBeTruthy();
  });

  it('renders a real <img> with the given src for a non-placeholder URL', () => {
    const { container } = render(BrandedPlaceholder, { src: REAL, alt: '真實圖片' });
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe(REAL);
    expect(img?.getAttribute('alt')).toBe('真實圖片');
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it('eager-loads a real hero image but lazy-loads a real gallery image', () => {
    const hero = render(BrandedPlaceholder, { src: REAL, alt: 'h', variant: 'hero' });
    expect(hero.container.querySelector('img')?.getAttribute('loading')).toBe('eager');

    const gallery = render(BrandedPlaceholder, { src: REAL, alt: 'g', variant: 'gallery' });
    expect(gallery.container.querySelector('img')?.getAttribute('loading')).toBe('lazy');
  });

  it('falls back to alt when ?text is absent', () => {
    const { getByText } = render(BrandedPlaceholder, {
      src: 'https://placehold.co/800x600',
      alt: '備用說明'
    });
    expect(getByText('備用說明')).toBeTruthy();
  });

  it('falls back to alt when ?text is a malformed %-sequence (decode throws, no crash)', () => {
    // %E0%A4%A is an incomplete UTF-8 escape → decodeURIComponent throws; the
    // try/catch must swallow it and use alt instead of letting the render die.
    const { getByText } = render(BrandedPlaceholder, {
      src: 'https://placehold.co/800x600?text=%E0%A4%A',
      alt: '安全備用'
    });
    expect(getByText('安全備用')).toBeTruthy();
  });

  it('treats an empty src as a placeholder (branded block, no <img>)', () => {
    const { container } = render(BrandedPlaceholder, { src: '', alt: '空白' });
    expect(container.querySelector('[role="img"]')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('hides the caption when showCaption is false (but keeps aria-label)', () => {
    const { container, queryByText } = render(BrandedPlaceholder, {
      src: PLACEHOLDER,
      alt: '幼兒體操',
      showCaption: false
    });
    expect(queryByText('幼兒體操')).toBeNull();
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('幼兒體操');
  });
});
