<script lang="ts">
  /* 熱門課程排行 — faithful port of reports.jsx `TopCourses`. Ranked rows: rank
   * number (rank 1 in primary) · name + 人 count · a width-% track bar
   * (count/max), with rank 1's fill in primary and the rest primary-light.
   * Flexible card beside the fixed IncomeSources. */
  import { Card } from '$lib/components/ui';
  import { TOP_COURSES } from '$lib/admin/data';

  $: max = Math.max(...TOP_COURSES.map((c) => c.count));
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
    {#each TOP_COURSES as c}
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
              style="height:100%; width:{(c.count / max) * 100}%; border-radius:4px; background:{c.rank ===
              1
                ? 'var(--df-primary)'
                : 'var(--df-primary-light)'};"
            ></div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</Card>

<style>
  .track {
    height: 8px;
    border-radius: 4px;
    background: #eef2f6;
    overflow: hidden;
  }
</style>
