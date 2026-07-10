<script lang="ts">
  /* 會員分級分布 — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `rows` is now GET /reports/admin's
   * tier_distribution (契約 §3.24: points_balance 分桶,全體 users;固定 4 桶
   * regular/bronze/silver/gold 零填). Labels AND colours come from report-math's
   * TIER_LABEL (same palette the archived TIER_DIST used). Bar heights go through
   * normalizeBars(counts, 100) — all-zero renders zero-height bars, never NaN. */
  import { Card } from '$lib/components/ui';
  import type { AdminTierDistRow } from '$lib/admin/api';
  import { TIER_LABEL, normalizeBars } from '$lib/admin/report-math';

  let { rows }: { rows: AdminTierDistRow[] } = $props();

  const heights = $derived(normalizeBars(rows.map((d) => d.count), 100));
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:4px;"
  >
    會員分級分布
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:16px;">
    依點數餘額分級 · 會員人數
  </div>
  <div style="display:flex; align-items:flex-end; gap:16px; height:158px;">
    {#each rows as d, i (d.bucket)}
      <div class="col">
        <span
          style="font-size:16px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
        >
          {d.count}
        </span>
        <div class="bar" style="height:{heights[i]}px; background:{TIER_LABEL[d.bucket].color};"></div>
        <span style="font-size:12px; color:var(--df-text-light);">{TIER_LABEL[d.bucket].label}</span>
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
  }
  .bar {
    width: 100%;
    max-width: 48px;
    border-radius: 6px 6px 0 0;
  }
</style>
