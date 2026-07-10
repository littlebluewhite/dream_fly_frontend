<script lang="ts">
  /* 場館使用時數 — restored from the archived reports.jsx port (689769a^, there
   * titled 場館使用率 over a mock pct), re-plumbed for real data (Round 4 P4-F2).
   * `rows` is now GET /reports/admin's venue_usage (契約 §3.24: 本月已物化場次
   * 分鐘數 SUM per venue,無場次的場地不出列). There is no capacity denominator,
   * so the dishonest 使用率 % is dropped — the metric shown is fmtHours(minutes)
   * and the bar width is normalizeBars (相對最忙場地 0–100; all-zero → zero-width,
   * never NaN). Venue names are an open set → cycling palette colour by index. */
  import { Card } from '$lib/components/ui';
  import type { AdminVenueUsageRow } from '$lib/admin/api';
  import { fmtHours, normalizeBars } from '$lib/admin/report-math';

  let { rows }: { rows: AdminVenueUsageRow[] } = $props();

  /* 開放集合(場地數不定)的循環色盤 — 純呈現層,沿用歸檔 mock 的既定色系。 */
  const PALETTE = ['var(--df-primary)', '#0EA5E9', '#10B981', '#8B5CF6', '#EC4899', 'var(--df-warning)'];

  const widths = $derived(normalizeBars(rows.map((v) => v.minutes)));
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:2px;"
  >
    場館使用時數
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:16px;">本月排課場次時數</div>
  <div style="display:flex; flex-direction:column; gap:14px;">
    {#each rows as v, i (v.venue)}
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="display:flex; align-items:center; gap:8px;">
            <span
              style="width:9px; height:9px; border-radius:5px; background:{PALETTE[i % PALETTE.length]};"
            ></span>
            <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">{v.venue}</span>
          </span>
          <span style="font-size:12.5px; color:var(--df-text-light);">
            <b style="color:var(--df-text-dark);">{fmtHours(v.minutes)}</b>
          </span>
        </div>
        <div class="track">
          <div
            style="height:100%; width:{widths[i]}%; border-radius:4px; background:{PALETTE[
              i % PALETTE.length
            ]};"
          ></div>
        </div>
      </div>
    {/each}
    {#if rows.length === 0}
      <div class="empty">本月尚無場地使用資料</div>
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
