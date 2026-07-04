import { describe, it, expect } from 'vitest';
import { courseToCartItem, passToCartItem } from './data';
import type { CatalogCourse, Ticket } from '$lib/public/adapters';

/* cart v3 — cart-item adapters now consume the API-shaped public CatalogCourse /
 * Ticket objects (uuid string ids). No more number-id namespacing (PASS_ID_BASE /
 * MARKETING_COURSE_ID_BASE / passId / marketingCourseId / parseNTD are gone —
 * dedup is by (type, id) in the store now, see stores.test.ts). */

const COURSE: CatalogCourse = {
  id: 'course-uuid-1',
  name: '幼兒體操 啟蒙班',
  level: '初級',
  cat: '幼兒體操',
  age: '3–6 歲',
  days: '週六 10:00',
  price: 3200,
  hot: true,
  coach: '黃教練',
  desc: '透過遊戲建立基礎動作能力',
  spots: 2
};

const TICKET: Ticket = {
  id: 'product-uuid-1',
  name: '競技啦啦隊月費',
  price: 4500,
  desc: '專業競技啦啦隊訓練',
  features: ['每週兩堂90分鐘訓練', '比賽代表隊選拔資格']
};

describe('courseToCartItem', () => {
  it('adapts a public catalog course into a course cart item (uuid id passthrough, qty 1)', () => {
    const item = courseToCartItem(COURSE);
    expect(item.type).toBe('course');
    expect(item.id).toBe('course-uuid-1');
    expect(item.qty).toBe(1);
    expect(item.name).toBe('幼兒體操 啟蒙班');
    expect(item.price).toBe(3200);
    expect(item.icon).toBeTruthy(); // CatalogCourse carries no icon; the adapter must supply one
  });

  it('maps spots/desc/level/cat/days through onto the cart item', () => {
    const item = courseToCartItem(COURSE);
    expect(item.spots).toBe(2);
    expect(item.desc).toBe('透過遊戲建立基礎動作能力');
    expect(item.level).toBe('初級');
    expect(item.cat).toBe('幼兒體操');
    expect(item.days).toBe('週六 10:00');
  });

  it('always returns qty 1 regardless of spots remaining (waitlist branching is store-owned)', () => {
    const full = { ...COURSE, spots: 0 };
    expect(courseToCartItem(full).qty).toBe(1);
  });
});

describe('passToCartItem', () => {
  it('adapts a public ticket into a pass cart item (uuid id passthrough, qty 1)', () => {
    const item = passToCartItem(TICKET);
    expect(item.type).toBe('pass');
    expect(item.id).toBe('product-uuid-1');
    expect(item.qty).toBe(1);
    expect(item.name).toBe('競技啦啦隊月費');
    expect(item.price).toBe(4500);
    expect(item.desc).toBe('專業競技啦啦隊訓練');
    expect(item.icon).toBeTruthy();
  });
});
