import { describe, it, expect } from 'vitest';
import {
	tierOf,
	MEMBERS,
	ORDERS,
	CLASSES,
	COACHES,
	VENUES,
	TICKETS
} from './data';

/* These assertions encode the exact derivation formulas from the admin
 * source (data.jsx:332-359) — the enrichment-by-mutation that we translate
 * into immutable `.map((m,i) => ({...m, derived}))`. Expected values are
 * computed from the formulas, not guessed. */

describe('tierOf', () => {
	it('returns 金卡會員 at the 350-point boundary', () => {
		expect(tierOf(350)).toEqual(['金卡會員', '#F59E0B']);
		expect(tierOf(420)).toEqual(['金卡會員', '#F59E0B']);
	});
	it('returns 銀卡會員 in [250, 350)', () => {
		expect(tierOf(349)).toEqual(['銀卡會員', '#94A3B8']);
		expect(tierOf(250)).toEqual(['銀卡會員', '#94A3B8']);
	});
	it('returns 銅卡會員 in [150, 250)', () => {
		expect(tierOf(249)).toEqual(['銅卡會員', '#B45309']);
		expect(tierOf(150)).toEqual(['銅卡會員', '#B45309']);
	});
	it('returns 一般會員 below 150', () => {
		expect(tierOf(149)).toEqual(['一般會員', '#64748B']);
		expect(tierOf(0)).toEqual(['一般會員', '#64748B']);
	});
});

describe('member enrichment', () => {
	it('derives campus/source/birthday/tier/renewDue/lineId for a paid 金卡 member (index 0)', () => {
		const m = MEMBERS[0];
		expect(m.id).toBe('GY2024001');
		expect(m.campus).toBe('美村本館');
		expect(m.source).toBe('Facebook 廣告');
		expect(m.birthday).toBe('2013/01/01');
		expect(m.tier).toBe('金卡會員');
		expect(m.tierColor).toBe('#F59E0B');
		expect(m.renewDue).toBe('2026/09/15');
		expect(m.lineId).toBe('@df4001'); // "GY2024001".slice(-4)

	});
	it('derives an overdue renewDue for a 待續費 銅卡 member (index 2)', () => {
		const m = MEMBERS[2];
		expect(m.campus).toBe('北屯分館');
		expect(m.source).toBe('LINE 官方帳號');
		expect(m.birthday).toBe('2017/11/15');
		expect(m.tier).toBe('銅卡會員');
		expect(m.renewDue).toBe('已逾期 · 06/03');
		expect(m.lineId).toBe('@df4003'); // "GY2024003".slice(-4)
	});
	it('derives a trial renewDue for a 體驗 一般 member (index 7)', () => {
		const m = MEMBERS[7];
		expect(m.tier).toBe('一般會員');
		expect(m.renewDue).toBe('體驗 06/30 到期');
	});
	it('enriches every member with a known tier and a @df line id', () => {
		const tiers = new Set(['金卡會員', '銀卡會員', '銅卡會員', '一般會員']);
		for (const m of MEMBERS) {
			expect(tiers.has(m.tier)).toBe(true);
			expect(m.lineId.startsWith('@df')).toBe(true);
			expect(m.campus).toBeTruthy();
			expect(m.birthday).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
		}
	});
});

describe('order enrichment', () => {
	it('derives 5% tax, net, paidAt and taxId for a paid order (index 0)', () => {
		const o = ORDERS[0];
		expect(o.id).toBe('DF-24061');
		expect(o.campus).toBe('美村本館');
		expect(o.tax).toBe(229); // round(4800 - 4800/1.05)
		expect(o.net).toBe(4571);
		expect(o.paidAt).toBe('06/08 14:22');
		expect(o.taxId).toBe('53901240'); // i%5===0 → "539012" + "40"
	});
	it('marks a pending order paidAt as 待付款 with no taxId (index 2)', () => {
		const o = ORDERS[2];
		expect(o.paidAt).toBe('—（待付款）');
		expect(o.taxId).toBe('—');
	});
	it('keeps the original date as paidAt for a refunded order (index 4)', () => {
		const o = ORDERS[4];
		expect(o.status).toBe('refunded');
		expect(o.paidAt).toBe('06/06 10:12');
	});
	it('keeps net + tax === amount for every order (rounding invariant)', () => {
		for (const o of ORDERS) {
			expect(o.net + o.tax).toBe(o.amount);
		}
	});
});

describe('class enrichment', () => {
	it('derives startDate/checkinRate/makeup (index 0)', () => {
		const k = CLASSES[0];
		expect(k.startDate).toBe('2026/03/01');
		expect(k.checkinRate).toBe(86);
		expect(k.makeup).toBe(0);
	});
	it('derives checkinRate from 86 + (i % 12) (index 3)', () => {
		const k = CLASSES[3];
		expect(k.startDate).toBe('2026/03/04');
		expect(k.checkinRate).toBe(89);
		expect(k.makeup).toBe(0); // 3 % 3
	});
});

describe('dataset counts (guard against transcription truncation)', () => {
	it('has the expected record counts', () => {
		expect(MEMBERS).toHaveLength(48);
		expect(CLASSES).toHaveLength(22);
		expect(COACHES).toHaveLength(9);
		expect(ORDERS).toHaveLength(36);
		expect(VENUES).toHaveLength(6);
		expect(TICKETS).toHaveLength(6);
	});
});
