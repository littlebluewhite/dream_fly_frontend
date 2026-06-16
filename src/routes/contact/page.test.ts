import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ContactPage from './+page.svelte';

/* The 場館位置 card replaced its dead "Google Maps 位置" placeholder with a real
 * keyless Google Maps embed (iframe) plus an "open in Google Maps" link. Both
 * must carry the URL-encoded venue address. */
describe('contact page map', () => {
  const ADDRESS = '台北市信義區信義路五段 168 號 3 樓';
  const ENCODED = encodeURIComponent(ADDRESS);

  it('embeds a Google Maps iframe whose src carries the URL-encoded address', () => {
    const { container } = render(ContactPage);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    const src = iframe?.getAttribute('src') ?? '';
    expect(src).toContain('google.com/maps');
    expect(src).toContain(ENCODED);
    expect(src).toContain('output=embed');
  });

  it('gives the iframe a descriptive title including the address', () => {
    const { container } = render(ContactPage);
    expect(container.querySelector('iframe')?.getAttribute('title')).toContain(ADDRESS);
  });

  it('lazy-loads the map iframe', () => {
    const { container } = render(ContactPage);
    expect(container.querySelector('iframe')?.getAttribute('loading')).toBe('lazy');
  });

  it('offers a safe external "open in Google Maps" link with the encoded address', () => {
    const { getByText } = render(ContactPage);
    const link = getByText('在 Google 地圖開啟').closest('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toContain(ENCODED);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('still shows the address in the contact-info card', () => {
    const { getAllByText } = render(ContactPage);
    expect(getAllByText(ADDRESS).length).toBeGreaterThan(0);
  });
});
