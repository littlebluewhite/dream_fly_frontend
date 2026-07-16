<script lang="ts">
  /* 收入來源分析 — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `rows` is now GET /reports/admin's
   * income_sources_12m (契約 §3.24: 近 12 studio 月 × 6 canonical source 的攤平
   * 72 列,毛額). The component reshapes it with groupIncomeSources() (per-source
   * series, canonical order preserved), sums each series into a 12-month total,
   * and derives 占比 via pctShares() (0–1, fmtPct-ready; bar width = share×100 so
   * the fill IS the displayed 占比 — same semantics as the archived pct bars).
   * Labels/colours via REVENUE_SOURCE_LABEL; amounts via fmtNT(ntd()). All-zero
   * inputs render zero shares (pctShares 防除零), never NaN. */
  import { Card } from '$lib/components/ui';
  import type { AdminIncomeSourceRow } from '$lib/admin/api';
  import { ntd } from '$lib/public/adapters';
  import { fmtNT } from '$lib/format';
  import { fmtPct } from '$lib/admin/format';
  import { incomeSourcesVM, revenueSourceLabel } from '$lib/admin/report-math';

  let { rows }: { rows: AdminIncomeSourceRow[] } = $props();

  const vm = $derived(incomeSourcesVM(rows));
  const totals = $derived(vm.totals);
  const shares = $derived(vm.shares);
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:2px;"
  >
    收入來源分析
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:16px;">近 12 個月毛額</div>
  <div style="display:flex; flex-direction:column; gap:14px;">
    {#each totals as s, i (s.source)}
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="display:flex; align-items:center; gap:8px;">
            <span
              style="width:9px; height:9px; border-radius:5px; background:{revenueSourceLabel(s.source)
                .color};"
            ></span>
            <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">
              {revenueSourceLabel(s.source).label}
            </span>
          </span>
          <span
            style="font-size:13px; font-weight:700; color:var(--df-text-dark); font-family:var(--df-font-mono);"
          >
            {fmtNT(ntd(s.totalCents))}
          </span>
        </div>
        <div class="track">
          <div
            style="height:100%; width:{shares[i] * 100}%; border-radius:4px; background:{revenueSourceLabel(
              s.source
            ).color};"
          ></div>
        </div>
        <div style="font-size:11px; color:var(--df-text-light); margin-top:4px;">
          {fmtPct(shares[i])} 占比
        </div>
      </div>
    {/each}
    {#if totals.length === 0}
      <div class="empty">尚無收入資料</div>
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
