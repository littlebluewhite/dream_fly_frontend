<script lang="ts">
  /* 熱門課程排行 — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `rows` is now report-math's
   * TopCourseRow[] — the page derives it from GET /reports/admin's courses[] via
   * topCoursesFrom() (依 enrolled 降冪取前 5;契約 §3.24「mock 有但契約無」對
   * topCourses 的裁決:免後端另開聚合端點), the same {rank,name,count} shape the
   * archived component consumed. Bar widths go through normalizeBars (0–100,
   * 相對最大值), so an all-zero or empty list renders zero-width bars, never NaN. */
  import { Card } from '$lib/components/ui';
  import { normalizeBars, type TopCourseRow } from '$lib/admin/report-math';

  let { rows }: { rows: TopCourseRow[] } = $props();

  const widths = $derived(normalizeBars(rows.map((c) => c.count)));
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
    <div
      style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
    >
      熱門課程排行
    </div>
    <span style="font-size:12px; color:var(--df-text-light);">依報名人數</span>
  </div>
  <div style="display:flex; flex-direction:column; gap:15px;">
    {#each rows as c, i (c.rank)}
      <div style="display:flex; align-items:center; gap:14px;">
        <span
          style="width:20px; text-align:center; font-size:14px; font-weight:800; color:{c.rank === 1
            ? 'var(--df-primary)'
            : 'var(--df-text-light)'}; font-family:var(--df-font-heading);"
        >
          {c.rank}
        </span>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">{c.name}</span>
            <span style="font-size:12px; color:var(--df-text-light);">{c.count} 人</span>
          </div>
          <div class="track">
            <div
              style="height:100%; width:{widths[i]}%; border-radius:4px; background:{c.rank === 1
                ? 'var(--df-primary)'
                : 'var(--df-primary-light)'};"
            ></div>
          </div>
        </div>
      </div>
    {/each}
    {#if rows.length === 0}
      <div class="empty">尚無課程報名資料</div>
    {/if}
  </div>
</Card>

<style>
  .track {
    height: 8px;
    border-radius: 4px;
    background: #eef2f6;
    overflow: hidden;
  }
  .empty {
    padding: 24px 0;
    text-align: center;
    color: var(--df-text-muted);
    font-size: 13px;
  }
</style>
