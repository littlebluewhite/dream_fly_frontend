<script lang="ts">
  /* 場館使用率 — faithful port of reports.jsx `VenueUsage`. One block per venue:
   * dot + name · "{pct}% · {hours}" meta, over a width-% bar (pct, in the venue
   * colour). Fixed 380px beside the flexible CoachPerf. */
  import { Card } from '$lib/components/ui';
  import { VENUE_USAGE } from '$lib/admin/data';
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:16px;"
  >
    場館使用率
  </div>
  <div style="display:flex; flex-direction:column; gap:14px;">
    {#each VENUE_USAGE as v}
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="display:flex; align-items:center; gap:8px;">
            <span style="width:9px; height:9px; border-radius:5px; background:{v.color};"></span>
            <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">{v.name}</span>
          </span>
          <span style="font-size:12.5px; color:var(--df-text-light);">
            <b style="color:var(--df-text-dark);">{v.pct}%</b> · {v.hours}
          </span>
        </div>
        <div class="track">
          <div style="height:100%; width:{v.pct}%; border-radius:4px; background:{v.color};"></div>
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
