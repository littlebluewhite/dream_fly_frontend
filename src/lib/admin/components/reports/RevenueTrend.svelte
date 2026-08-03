<script lang="ts">
  /* 月營收趨勢 — faithful port of reports.jsx `RevenueTrend`. Flexbox column bars
   * inside a 190px-tall track; the peak month renders in primary-dark. Task 15:
   * `rows` 改吃 GET /reports/admin 的真實 12 月營收（見 admin/api.ts getReports()）
   * ——單位改為實際新台幣元（不再是 mock 的「仟元」），總計現場加總 rows 計算
   * （不再是硬編的 "NT$ 4.51M"）。total/heights 皆出自 report-math.ts
   * revenueTrendVM(rows, REPORT_SCALES.revenueTrend.desktop)(Round 2 C3,行動版
   * ReportsScreen 同源；R10 架構深化 E 案將本檔原本內嵌的 (h/max)*160 公式與
   * 160px 值域收進該函式與 REPORT_SCALES 單源——全 0 時 normalizeBars 自身防除以
   * 0,不再需要另外「max 保底 1」)。 */
  import { Card } from '$lib/components/ui';
  import { fmtNT } from '$lib/format';
  import { revenueTrendVM, REPORT_SCALES } from '$lib/admin/report-math';
  import type { TrendBar } from '$lib/admin/data';

  export let rows: TrendBar[];

  $: ({ total, heights } = revenueTrendVM(rows, REPORT_SCALES.revenueTrend.desktop));
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px;">
    <div>
      <div
        style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
      >
        月營收趨勢
      </div>
      <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">單位:新台幣元</div>
    </div>
    <span style="font-size:13px; font-weight:700; color:var(--df-primary);">總計 {fmtNT(total)}</span>
  </div>
  <div style="display:flex; align-items:flex-end; gap:8px; height:190px;">
    {#each rows as d, i}
      <div class="col">
        <div
          class="bar"
          title={d.m}
          style="height:{heights[i]}px; background:{d.peak
            ? 'var(--df-primary-dark)'
            : 'var(--df-primary)'};"
        ></div>
        <span style="font-size:11px; color:var(--df-text-light);">{d.m}</span>
      </div>
    {/each}
  </div>
</Card>

<style>
  .col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
    height: 100%;
  }
  .bar {
    width: 100%;
    max-width: 26px;
    border-radius: 5px 5px 0 0;
    transition: height 0.4s ease;
  }
</style>
