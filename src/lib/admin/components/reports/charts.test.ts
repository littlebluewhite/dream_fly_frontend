import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';

import ReportKpi from './ReportKpi.svelte';
import CategoryDonut from './CategoryDonut.svelte';
import PaymentSplit from './PaymentSplit.svelte';
import WeekdayLoad from './WeekdayLoad.svelte';
import CoachPerf from './CoachPerf.svelte';
import ConversionFunnel from './ConversionFunnel.svelte';
import RevenueBreakdown from './RevenueBreakdown.svelte';

import {
  REPORT_KPIS,
  CATEGORY_SPLIT,
  PAYMENT_SPLIT,
  WEEKDAY_LOAD,
  COACH_PERF,
  FUNNEL,
  REVENUE_BREAKDOWN,
  REVENUE_TOTAL
} from '$lib/admin/data';
import { donutStops } from './donut';

/* One focused render test per CHART FAMILY (donut / vertical-bar / horizontal-bar
 * list / funnel / KPI card / drill list) — the pure cumulative-stop maths lives in
 * donut.test.ts; here we assert each family paints its labels + values from data. */

describe('ReportKpi (KPI card family)', () => {
  it('renders the KPI label, value and delta', () => {
    const k = REPORT_KPIS[0];
    const { container } = render(ReportKpi, { k });
    expect(container.textContent).toContain(k.label);
    expect(container.textContent).toContain(k.value);
    expect(container.textContent).toContain(k.delta);
  });
});

describe('CategoryDonut (donut family)', () => {
  it('renders every legend label + percentage and a cumulative conic-gradient', () => {
    const { container } = render(CategoryDonut);
    for (const c of CATEGORY_SPLIT) {
      expect(container.textContent).toContain(c.label);
      expect(container.textContent).toContain(`${c.pct}%`);
    }
    // the ring background is built from the shared cumulative-stop helper
    const ring = container.querySelector('.ring') as HTMLElement;
    expect(ring.getAttribute('style')).toContain(`conic-gradient(${donutStops(CATEGORY_SPLIT)})`);
  });

  it('PaymentSplit renders its payment-method legend + percentages', () => {
    const { container } = render(PaymentSplit);
    for (const p of PAYMENT_SPLIT) {
      expect(container.textContent).toContain(p.label);
      expect(container.textContent).toContain(`${p.pct}%`);
    }
  });
});

describe('WeekdayLoad (vertical-bar family)', () => {
  it('renders one bar per weekday with its rate label, height ∝ classes/max', () => {
    const { container } = render(WeekdayLoad);
    const maxC = Math.max(...WEEKDAY_LOAD.map((d) => d.classes));
    const bars = container.querySelectorAll('.bar');
    expect(bars.length).toBe(WEEKDAY_LOAD.length);
    for (const d of WEEKDAY_LOAD) {
      expect(container.textContent).toContain(d.d);
      expect(container.textContent).toContain(`${d.rate}%`);
    }
    // busiest day reaches the full 104px; tallest bar present
    const busiest = WEEKDAY_LOAD.find((d) => d.classes === maxC)!;
    const heights = Array.from(bars).map((b) => (b as HTMLElement).style.height);
    expect(heights).toContain(`${(busiest.classes / maxC) * 104}px`);
  });
});

describe('CoachPerf (horizontal-bar list family)', () => {
  it('renders each coach initial, name, revenue and a revPct-width bar', () => {
    const { container } = render(CoachPerf);
    for (const c of COACH_PERF) {
      expect(container.textContent).toContain(c.name);
      expect(container.textContent).toContain(c.revenue);
    }
    const top = COACH_PERF[0];
    const widths = Array.from(container.querySelectorAll('.track > div')).map(
      (d) => (d as HTMLElement).style.width
    );
    expect(widths).toContain(`${top.revPct}%`);
  });
});

describe('ConversionFunnel (funnel family)', () => {
  it('renders every stage label, count and pct', () => {
    const { container } = render(ConversionFunnel);
    for (const f of FUNNEL) {
      expect(container.textContent).toContain(f.label);
      expect(container.textContent).toContain(String(f.count));
      expect(container.textContent).toContain(`${f.pct}%`);
    }
  });

  it('annotates per-step conversion for stages after the first', () => {
    const { container } = render(ConversionFunnel);
    const step = Math.round((FUNNEL[1].pct / FUNNEL[0].pct) * 100);
    expect(container.textContent).toContain(`轉化 ${step}%`);
  });
});

describe('RevenueBreakdown (drill list)', () => {
  it('renders every source name, meta, amount and drill action + the total', () => {
    const { container } = render(RevenueBreakdown);
    for (const r of REVENUE_BREAKDOWN) {
      expect(container.textContent).toContain(r.name);
      expect(container.textContent).toContain(r.meta);
      expect(container.textContent).toContain(r.amount);
      expect(container.textContent).toContain(r.drill);
    }
    expect(container.textContent).toContain(REVENUE_TOTAL);
  });
});
