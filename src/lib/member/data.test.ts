import { describe, it, expect } from 'vitest';
import {
  CATALOG,
  passId,
  marketingCourseId,
  parseNTD,
  marketingCourseToCartItem,
  passToCartItem,
  type MarketingCourseInput,
  type PassInput
} from './data';

describe('parseNTD', () => {
  it('extracts the dollar amount from a price label, ignoring suffix copy', () => {
    expect(parseNTD('NT$ 3,200/月 (4堂)')).toBe(3200);
    expect(parseNTD('NT$ 500')).toBe(500);
  });
  it('returns 0 when no amount is present', () => {
    expect(parseNTD('洽詢')).toBe(0);
  });
});

describe('cart id namespaces', () => {
  // The unified cart dedups by numeric id, so the three product sources MUST
  // never share an id — otherwise a marketing course would bump a member course.
  it('keeps member courses, marketing courses, and passes in disjoint id ranges', () => {
    const courseIds = CATALOG.map((c) => c.id); // 1–6
    const marketingIds = [1, 2, 3, 4].map(marketingCourseId); // 2001–2004
    const passIds = [1, 2, 3, 4, 5, 6].map(passId); // 1001–1006
    const all = [...courseIds, ...marketingIds, ...passIds];
    expect(new Set(all).size).toBe(all.length);
  });
});

const MK: MarketingCourseInput = {
  id: 2,
  name: '競技啦啦隊',
  level: '競技',
  duration: '每週兩次，每次90分鐘',
  price: 'NT$ 4,500/月',
  description: '專業競技啦啦隊訓練',
  includes: ['特技動作訓練']
};
const PASS: PassInput = {
  id: 3,
  name: '競技啦啦隊月費',
  price: 'NT$ 4,500',
  duration: '每月8堂',
  description: '專業競技啦啦隊訓練',
  features: ['每週兩堂90分鐘訓練']
};

describe('marketingCourseToCartItem', () => {
  it('adapts a marketing course into a namespaced course CartItem', () => {
    const item = marketingCourseToCartItem(MK);
    expect(item.type).toBe('course');
    expect(item.id).toBe(2002); // 2000 + 2
    expect(item.price).toBe(4500); // parsed from the label
    expect(item.name).toBe('競技啦啦隊');
    expect(item.icon).toBeTruthy(); // checkout renders an icon; the adapter must supply one
  });
});

describe('passToCartItem', () => {
  it('adapts a pass into a namespaced pass CartItem (features → includes)', () => {
    const item = passToCartItem(PASS);
    expect(item.type).toBe('pass');
    expect(item.id).toBe(1003); // 1000 + 3
    expect(item.price).toBe(4500);
    expect(item.includes).toEqual(['每週兩堂90分鐘訓練']);
    expect(item.icon).toBeTruthy();
  });
});
