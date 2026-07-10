<script lang="ts">
  /* 本月營收來源拆解 — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `rows` is now GET /reports/admin's
   * revenue_breakdown (契約 §3.24: 本月、折扣前毛額、6 個 canonical source 桶含
   * 場租): the component looks up 中文標籤/dot colour via REVENUE_SOURCE_LABEL,
   * formats cents with fmtNT(ntd()) and builds the meta line from ordersCount/
   * units. 合計 is derived from the rows themselves — NOT the revenue KPI's
   * this_month figure, which is a different 口徑 (實收 net of discounts, orders
   * only) and would not reconcile with the listed gross amounts. The prototype's
   * static drill button (r.drill, a dead demo affordance) is dropped along with
   * the「點任一來源可下鑽」promise — no drill-down exists; the 可追溯 pill stays. */
  import { Card, Icon } from '$lib/components/ui';
  import type { AdminRevenueBreakdownRow } from '$lib/admin/api';
  import { ntd } from '$lib/public/adapters';
  import { fmtNT } from '$lib/admin/format';
  import { REVENUE_SOURCE_LABEL } from '$lib/admin/report-math';

  let { rows }: { rows: AdminRevenueBreakdownRow[] } = $props();

  const totalCents = $derived(rows.reduce((sum, r) => sum + r.grossCents, 0));
</script>

<Card padding={0} style="overflow:hidden">
  <div class="head">
    <div style="display:flex; align-items:center; gap:12px;">
      <div class="head-chip"><Icon name="dollar-sign" size={18} color="var(--df-primary)" /></div>
      <div>
        <div
          style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
        >
          本月營收來源拆解
        </div>
        <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">
          依訂單品項毛額(折扣前)分列,含場地租借
        </div>
      </div>
    </div>
    <span class="trace-pill"><Icon name="scan-line" size={13} />可追溯來源</span>
  </div>

  <div>
    {#each rows as r, i (r.source)}
      <div class="row" class:bordered={i < rows.length - 1}>
        <div style="flex:1; display:flex; align-items:center; gap:10px; min-width:0;">
          <span
            style="width:8px; height:8px; border-radius:4px; background:{REVENUE_SOURCE_LABEL[r.source]
              .color}; flex:none;"
          ></span>
          <div style="min-width:0;">
            <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">
              {REVENUE_SOURCE_LABEL[r.source].label}
            </div>
            <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">
              訂單 {r.ordersCount} 筆 · 數量 {r.units}
            </div>
          </div>
        </div>
        <div
          style="width:140px; text-align:right; font-size:14px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);"
        >
          {fmtNT(ntd(r.grossCents))}
        </div>
      </div>
    {/each}
    <div class="foot">
      <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">合計(本月毛額)</span>
      <span
        style="font-size:16px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);"
      >
        {fmtNT(ntd(totalCents))}
      </span>
    </div>
  </div>
</Card>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    background: #0066cc0a;
    border-bottom: 1px solid var(--df-border);
  }
  .head-chip {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #0066cc14;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .trace-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--df-primary-bg);
    color: var(--df-primary);
    font-size: 11px;
    font-weight: 600;
    padding: 5px 11px;
    border-radius: 999px;
    flex: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 13px 18px;
  }
  .row.bordered {
    border-bottom: 1px solid #f3f4f6;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 18px;
    background: var(--df-bg-light);
  }
</style>
