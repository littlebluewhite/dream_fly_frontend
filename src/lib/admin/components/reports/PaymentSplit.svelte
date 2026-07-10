<script lang="ts">
  /* 付款方式占比 — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `rows` is now GET /reports/admin's
   * payment_split (契約 §3.24: 本月 paid 家族訂單筆數 per payment_method;開放
   * 字串桶,零筆方式不出列;占比由前端算). Shares come from pctShares() (0–1,
   * fmtPct-ready) and the ring feeds donutStops with share×100 (合計恰為 100)。
   * Labels via paymentMethodLabel (查無 → 原字串穿透); methods are an open set →
   * cycling palette colour by index. Empty rows paint a neutral ring and an empty
   * hint — pctShares 防除零, never NaN. */
  import { Card } from '$lib/components/ui';
  import type { AdminPaymentSplitRow } from '$lib/admin/api';
  import { fmtPct } from '$lib/admin/format';
  import { paymentMethodLabel, pctShares } from '$lib/admin/report-math';
  import { donutStops } from './donut';

  let { rows }: { rows: AdminPaymentSplitRow[] } = $props();

  /* 開放集合(付款方式不定)的循環色盤 — 純呈現層,沿用歸檔 mock 的既定色系。 */
  const PALETTE = ['var(--df-primary)', '#10B981', '#0EA5E9', '#8B5CF6', 'var(--df-warning)', '#EC4899'];

  const shares = $derived(pctShares(rows.map((p) => p.count)));
  const stops = $derived(
    donutStops(shares.map((share, i) => ({ pct: share * 100, color: PALETTE[i % PALETTE.length] })))
  );
  const hasData = $derived(rows.some((p) => p.count > 0));
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:2px;"
  >
    付款方式占比
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:14px;">本月付款訂單筆數</div>
  <div style="display:flex; align-items:center; gap:20px;">
    <div class="ring" style="background:{hasData ? `conic-gradient(${stops})` : 'var(--df-bg-light)'};">
      <div class="hub">
        <div
          style="font-size:22px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); line-height:1;"
        >
          {rows.length}
        </div>
        <div style="font-size:10.5px; color:var(--df-text-light); margin-top:2px;">種管道</div>
      </div>
    </div>
    <div style="flex:1; display:flex; flex-direction:column; gap:9px;">
      {#each rows as p, i (p.method)}
        <div style="display:flex; align-items:center; gap:8px;">
          <span
            style="width:10px; height:10px; border-radius:5px; background:{PALETTE[
              i % PALETTE.length
            ]}; flex:none;"
          ></span>
          <span style="flex:1; font-size:12.5px; color:var(--df-text-dark);">
            {paymentMethodLabel(p.method)}
          </span>
          <span style="font-size:12.5px; font-weight:700; color:var(--df-text-dark);">
            {fmtPct(shares[i])}
          </span>
        </div>
      {/each}
      {#if rows.length === 0}
        <div style="font-size:12.5px; color:var(--df-text-muted);">本月尚無付款訂單</div>
      {/if}
    </div>
  </div>
</Card>

<style>
  .ring {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hub {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
