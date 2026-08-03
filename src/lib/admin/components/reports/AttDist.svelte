<script lang="ts">
  /* 出席率分布 — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `rows` is now GET /reports/admin's
   * attendance_distribution (契約 §3.24: 每會員 present/(present+absent),leave
   * 不入分母,未點名者不入分布;固定 4 桶零填). Labels AND colours come from
   * report-math's ATTENDANCE_BUCKET_LABEL(R10 架構深化 E 案:原本 component-local
   * 的桶色併入單源查表)。Bar heights go through normalizeBars(counts, 110) — the
   * archived count/maxC*110 was NaN on an all-zero (empty-library) month. */
  import { Card } from '$lib/components/ui';
  import type { AdminAttendanceDistRow } from '$lib/admin/api';
  import { ATTENDANCE_BUCKET_LABEL, attDistVM, REPORT_SCALES } from '$lib/admin/report-math';

  let { rows }: { rows: AdminAttendanceDistRow[] } = $props();

  const heights = $derived(attDistVM(rows, REPORT_SCALES.attDist.desktop));
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
        <div class="bar" style="height:{heights[i]}px; background:{ATTENDANCE_BUCKET_LABEL[d.bucket].color};"></div>
        <span style="font-size:11.5px; color:var(--df-text-light); text-align:center;">
          {ATTENDANCE_BUCKET_LABEL[d.bucket].label}
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
