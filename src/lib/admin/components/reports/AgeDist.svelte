<script lang="ts">
  /* 年齡層分布 — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `rows` is now GET /reports/admin's
   * age_distribution (契約 §3.24: birth_date 相對 studio 今日足歲,未填生日不計;
   * 固定 6 桶零填,回 count). The archived component took precomputed pct — the
   * shares are now derived via pctShares() (0–1, fmtPct-ready; bar width =
   * share×100 so the fill IS the displayed 占比; all-zero → 全 0, never NaN).
   * Labels via AGE_BUCKET_LABEL; the per-bucket colours are presentational and
   * component-local (6 桶 → 固定色序). */
  import { Card } from '$lib/components/ui';
  import type { AdminAgeDistRow } from '$lib/admin/api';
  import { fmtPct } from '$lib/admin/format';
  import { AGE_BUCKET_LABEL, pctShares } from '$lib/admin/report-math';

  let { rows }: { rows: AdminAgeDistRow[] } = $props();

  /* 桶固定 6 值 → 固定桶色(呈現層)。 */
  const BUCKET_COLOR: Record<AdminAgeDistRow['bucket'], string> = {
    '0-6': '#10B981',
    '7-12': 'var(--df-primary)',
    '13-17': '#0EA5E9',
    '18-25': '#8B5CF6',
    '26-40': '#F59E0B',
    '41+': '#EC4899'
  };

  const shares = $derived(pctShares(rows.map((a) => a.count)));
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:2px;"
  >
    年齡層分布
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:16px;">
    依生日推算足歲 · 未填生日不計
  </div>
  <div style="display:flex; flex-direction:column; gap:14px;">
    {#each rows as a, i (a.bucket)}
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="display:flex; align-items:center; gap:8px;">
            <span
              style="width:9px; height:9px; border-radius:5px; background:{BUCKET_COLOR[a.bucket]};"
            ></span>
            <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">
              {AGE_BUCKET_LABEL[a.bucket]}
            </span>
          </span>
          <span style="font-size:13px; font-weight:700; color:var(--df-text-dark);">
            {fmtPct(shares[i])}
          </span>
        </div>
        <div class="track">
          <div
            style="height:100%; width:{shares[i] * 100}%; border-radius:4px; background:{BUCKET_COLOR[
              a.bucket
            ]};"
          ></div>
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
