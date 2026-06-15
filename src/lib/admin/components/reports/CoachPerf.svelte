<script lang="ts">
  /* 教練表現排行 — faithful port of reports.jsx `CoachPerf`. One row per coach: a
   * 34px coloured initial avatar · name + students·att meta · mono revenue, over a
   * width-% bar (revPct, filled in the coach colour). Flexible card beside the
   * fixed VenueUsage. */
  import { Card } from '$lib/components/ui';
  import { COACH_PERF } from '$lib/admin/data';
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
    <div
      style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
    >
      教練表現排行
    </div>
    <span style="font-size:12px; color:var(--df-text-light);">營收 · 學員數 · 出席率</span>
  </div>
  <div style="display:flex; flex-direction:column; gap:13px;">
    {#each COACH_PERF as c}
      <div style="display:flex; align-items:center; gap:13px;">
        <div class="avatar" style="background:{c.color};">{c.initial}</div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <span style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">
              {c.name}
              <span style="font-size:11.5px; color:var(--df-text-muted);">
                · {c.students} 位 · 出席 {c.att}%
              </span>
            </span>
            <span
              style="font-size:13px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);"
            >
              {c.revenue}
            </span>
          </div>
          <div class="track">
            <div style="height:100%; width:{c.revPct}%; border-radius:4px; background:{c.color};"></div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</Card>

<style>
  .avatar {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 14px;
    font-family: var(--df-font-heading);
    flex: none;
  }
  .track {
    height: 8px;
    border-radius: 4px;
    background: #eef2f6;
    overflow: hidden;
  }
</style>
