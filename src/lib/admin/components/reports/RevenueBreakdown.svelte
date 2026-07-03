<script lang="ts">
  /* 本月營收來源拆解 — faithful port of reports.jsx `RevenueBreakdown`. A padding-0
   * Card: a tinted header (dollar chip + title + 可追溯 pill), then one row per
   * `rows` entry (dot · name/meta · mono amount · drill button), then a
   * 合計 footer on bg-light. The drill button is a static demo affordance. */
  import { Card, Icon } from '$lib/components/ui';
  import type { RevenueRow } from '$lib/admin/data';

  export let rows: RevenueRow[];
  export let total: string;
</script>

<Card padding={0} style="overflow:hidden">
  <div class="head">
    <div style="display:flex; align-items:center; gap:12px;">
      <div class="head-chip"><Icon name="dollar-sign" size={18} color="var(--df-primary)" /></div>
      <div>
        <div
          style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
        >
          本月營收 {total} · 來源拆解
        </div>
        <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">
          點任一來源可下鑽至原始訂單／班級／票券,每個數字皆可追溯
        </div>
      </div>
    </div>
    <span class="trace-pill"><Icon name="scan-line" size={13} />可追溯來源</span>
  </div>

  <div>
    {#each rows as r, i}
      <div class="row" class:bordered={i < rows.length - 1}>
        <div style="flex:1; display:flex; align-items:center; gap:10px; min-width:0;">
          <span style="width:8px; height:8px; border-radius:4px; background:{r.dot}; flex:none;"></span>
          <div style="min-width:0;">
            <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">{r.name}</div>
            <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{r.meta}</div>
          </div>
        </div>
        <div
          style="width:120px; text-align:right; font-size:14px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);"
        >
          {r.amount}
        </div>
        <button type="button" class="drill">{r.drill}<Icon name="arrow-right" size={14} /></button>
      </div>
    {/each}
    <div class="foot">
      <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">合計(本月)</span>
      <span
        style="font-size:16px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);"
      >
        {total}
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
  .drill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #0066cc0f;
    color: var(--df-primary);
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    padding: 7px 12px;
    border-radius: 8px;
    font-family: var(--df-font-body);
    flex: none;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 18px;
    background: var(--df-bg-light);
  }
</style>
