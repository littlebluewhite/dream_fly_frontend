import { describe, it, expect } from 'vitest';
import { navigationConfig } from './navigationConfig';

describe('navigationConfig', () => {
  it('三個 dropdown 父項的 basePath 精確對應各自路由(逐字 pin,防三項全誤填為 "/" 的 vacuous pass)', () => {
    const venues = navigationConfig.find((item) => item.label === '場館介紹');
    const coaches = navigationConfig.find((item) => item.label === '教練介紹');
    const courses = navigationConfig.find((item) => item.label === '課程介紹');

    expect(venues?.basePath).toBe('/venues');
    expect(coaches?.basePath).toBe('/coaches');
    expect(courses?.basePath).toBe('/courses');
  });

  it('dropdown 父項底下所有子項的 href 都以父項 basePath 為前綴', () => {
    const dropdownItems = navigationConfig.filter((item) => item.hasDropdown);
    expect(dropdownItems.length).toBeGreaterThan(0); // 避免下方迴圈因空陣列而 vacuously pass

    for (const item of dropdownItems) {
      expect(item.basePath).toBeTruthy();
      const basePath = item.basePath as string;

      for (const category of item.categories ?? []) {
        for (const link of category.items) {
          expect(link.href.startsWith(basePath)).toBe(true);
        }
      }
    }
  });

  it('非 dropdown 項目都必須有 href', () => {
    const nonDropdownItems = navigationConfig.filter((item) => !item.hasDropdown);
    expect(nonDropdownItems.length).toBeGreaterThan(0); // 避免下方迴圈因空陣列而 vacuously pass

    for (const item of nonDropdownItems) {
      expect(item.href).toBeTruthy();
    }
  });
});
