<script lang="ts">
  /* 出席率分布 — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `rows` is now GET /reports/admin's
   * attendance_distribution (契約 §3.24: 每會員 present/(present+absent),leave
   * 不入分母,未點名者不入分布;固定 4 桶零填). Labels come from report-math's
   * ATTENDANCE_BUCKET_LABEL; the per-bucket colours are the archived palette keyed
   * by bucket (presentational, component-local). Bar heights go through
   * normalizeBars(counts, 110) — the archived count/maxC*110 was NaN on an all-zero
   * (empty-library) month. */
  import { Card } from '$lib/components/ui';
  import type { AdminAttendanceDistRow } from '$lib/admin/api';
  import { ATTENDANCE_BUCKET_LABEL, normalizeBars } from '$lib/admin/report-math';

  let { rows }: { rows: AdminAttendanceDistRow[] } = $props();

  /* 桶固定 4 值 → 沿用歸檔 ATT_DIST 的桶色(高出席綠 → 低出席警示)。 */
  const BUCKET_COLOR: Record<AdminAttendanceDistRow['bucket'], string> = {
    gte_95: 'var(--df-success)',
    '85_94': 'var(--df-primary)',
    '75_84': '#0EA5E9',
    lt_75: 'var(--df-warning)'
  };

  const heights = $derived(normalizeBars(rows.map((d) => d.count), 110));
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:6px;"
  >
    出席率分布
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:16px;">
    依個人出席率分桶 · 學員人數
  </div>
  <div style="display:flex; align-items:flex-end; gap:16px; height:168px;">
    {#each rows as d, i (d.bucket)}
      <div class="col">
        <span
          style="font-size:16px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
        >
          {d.count}
        </span>
        <div class="bar" style="height:{heights[i]}px; background:{BUCKET_COLOR[d.bucket]};"></div>
        <span style="font-size:11.5px; color:var(--df-text-light); text-align:center;">
          {ATTENDANCE_BUCKET_LABEL[d.bucket]}
        </span>
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
    max-width: 54px;
    border-radius: 6px 6px 0 0;
  }
</style>
