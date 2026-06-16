import { describe, it, expect } from 'vitest';
import { uniqueVenueId } from './venue-id';

describe('uniqueVenueId', () => {
  it('returns the desired code when it is free', () => {
    expect(uniqueVenueId([{ id: 'A' }, { id: 'B' }], 'C')).toBe('C');
  });

  it('suffixes a colliding user code so the keyed id stays unique', () => {
    // codex round 1 P2: adding a venue with an existing 場地代號 ('A') must not
    // produce a duplicate `{#each venues as v (v.id)}` key.
    expect(uniqueVenueId([{ id: 'A' }], 'A')).toBe('A-2');
  });

  it('keeps bumping the suffix past existing suffixed ids', () => {
    expect(uniqueVenueId([{ id: 'A' }, { id: 'A-2' }], 'A')).toBe('A-3');
  });

  it('generates a non-colliding fallback when the code is blank', () => {
    const existing = [{ id: 'V1' }, { id: 'V2' }];
    const id = uniqueVenueId(existing, '');
    expect(existing.map((v) => v.id)).not.toContain(id);
    expect(id).toBeTruthy();
  });

  it('skips a taken fallback in the generated sequence', () => {
    // length+1 would be V2, but V2 is taken → must bump to V3
    expect(uniqueVenueId([{ id: 'V2' }], '')).toBe('V3');
  });

  it('trims whitespace before comparing', () => {
    expect(uniqueVenueId([{ id: 'A' }], '  A  ')).toBe('A-2');
  });
});
