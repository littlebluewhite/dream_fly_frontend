<script lang="ts">
  /* 營收類別占比 — restored from the archived reports.jsx port (689769a^, there
   * titled 課程分類占比 over mock course categories), re-plumbed for real data
   * (Round 4 P4-F2). `rows` is now GET /reports/admin's category_split (契約
   * §3.24: 本月 order-line 毛額五桶占比,不含 venue_rental;ratio 0–1、分母 0 →
   * null) — retitled 營收類別占比 to match that 口徑. Labels/colours come from
   * REVENUE_SOURCE_LABEL; percentages render via fmtPct (null → 「—」); the ring
   * feeds donutStops with ratio×100 (null → 0). All-zero months paint a neutral
   * ring (donutStops('') is not valid conic-gradient input). The hub counts
   * categories with revenue this month (the archived hardcoded 142 總課程數 had
   * no data source). */
  import { Card } from '$lib/components/ui';
  import type { AdminCategorySplitRow } from '$lib/admin/api';
  import { fmtPct } from '$lib/admin/format';
  import { REVENUE_SOURCE_LABEL } from '$lib/admin/report-math';
  import { donutStops } from './donut';

  let { rows }: { rows: AdminCategorySplitRow[] } = $props();

  const stops = $derived(
    donutStops(
      rows.map((r) => ({ pct: (r.ratio ?? 0) * 100, color: REVENUE_SOURCE_LABEL[r.source].color }))
    )
  );
  const activeCount = $derived(rows.filter((r) => r.grossCents > 0).length);
</script>

<Card padding={18} style="width:360px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:2px;"
  >
    營收類別占比
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:10px;">
    本月訂單品項毛額 · 不含場租
  </div>
  <div style="display:flex; justify-content:center; margin-bottom:14px;">
    <div
      class="ring"
      style="background:{activeCount > 0 ? `conic-gradient(${stops})` : 'var(--df-bg-light)'};"
    >
      <div class="hub">
        <div
          style="font-size:28px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); line-height:1;"
        >
          {activeCount}
        </div>
        <div style="font-size:11px; color:var(--df-text-light); margin-top:3px;">有進帳類別</div>
      </div>
    </div>
  </div>
  <div style="display:flex; flex-direction:column; gap:9px;">
    {#each rows as c (c.source)}
      <div style="display:flex; align-items:center; gap:9px;">
        <span
          style="width:10px; height:10px; border-radius:5px; background:{REVENUE_SOURCE_LABEL[c.source]
            .color}; flex:none;"
        ></span>
        <span style="flex:1; font-size:13px; color:var(--df-text-dark);">
          {REVENUE_SOURCE_LABEL[c.source].label}
        </span>
        <span style="font-size:13px; font-weight:700; color:var(--df-text-dark);">{fmtPct(c.ratio)}</span>
      </div>
    {/each}
  </div>
</Card>

<style>
  .ring {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .hub {
    width: 93px;
    height: 93px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
