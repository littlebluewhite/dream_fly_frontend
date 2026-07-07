import { describe, it, expect } from 'vitest';
import { orderStatusBadge, pageMeta, initialOf, isoDateTime, ageRange } from './wire';
import type { ApiPage } from './wire';

/* Expected [tone, label] pairs are copied verbatim from the current
 * admin/data.ts ORDER_STATUS / member/api.ts ORDER_STATUS (confirmed
 * byte-identical before this module existed); ageRange's branch outputs are
 * copied verbatim from the current admin/api.ts / public/adapters.ts
 * ageRange (also confirmed identical). Not guessed. */

describe('orderStatusBadge', () => {
  it('returns the exact [tone, label] pair for each of the 6 known statuses', () => {
    expect(orderStatusBadge('pending')).toEqual(['warning', '待付款']);
    expect(orderStatusBadge('paid')).toEqual(['success', '已付款']);
    expect(orderStatusBadge('processing')).toEqual(['info', '處理中']);
    expect(orderStatusBadge('completed')).toEqual(['neutral', '已完成']);
    expect(orderStatusBadge('cancelled')).toEqual(['error', '已取消']);
    expect(orderStatusBadge('refunded')).toEqual(['neutral', '已退款']);
  });

  it('falls back to [neutral, original string] for an unknown status (downstream tests depend on this)', () => {
    expect(orderStatusBadge('some-unknown-status')).toEqual(['neutral', 'some-unknown-status']);
  });
});

describe('pageMeta', () => {
  it('maps the snake_case envelope meta fields to camelCase', () => {
    expect(pageMeta({ total: 42, page: 2, per_page: 20 })).toEqual({ total: 42, page: 2, perPage: 20 });
  });
});

describe('ApiPage', () => {
  it('is assignable to a plain object keyed by the given field name plus the meta fields', () => {
    type OrdersPage = ApiPage<'orders', { id: string }>;
    const page: OrdersPage = { orders: [{ id: 'o1' }], total: 1, page: 1, per_page: 20 };

    expect(page.orders).toEqual([{ id: 'o1' }]);
    expect(page.total).toBe(1);
  });
});

describe('initialOf', () => {
  it('returns the first character of a name', () => {
    expect(initialOf('王小明')).toBe('王');
    expect(initialOf('Alice')).toBe('A');
  });

  it("returns '?' for an empty string", () => {
    expect(initialOf('')).toBe('?');
  });
});

describe('isoDateTime', () => {
  it("formats an ISO datetime string to 'YYYY-MM-DD HH:mm'", () => {
    expect(isoDateTime('2026-07-07T14:30:00')).toBe('2026-07-07 14:30');
  });
});

describe('ageRange', () => {
  it('shows both bounds', () => {
    expect(ageRange(5, 12)).toBe('5–12 歲');
  });

  it('shows only a lower bound', () => {
    expect(ageRange(6, null)).toBe('6 歲以上');
  });

  it('shows only an upper bound', () => {
    expect(ageRange(null, 10)).toBe('10 歲以下');
  });

  it('shows an empty string when both bounds are null', () => {
    expect(ageRange(null, null)).toBe('');
  });
});
