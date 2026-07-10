<script lang="ts">
  /* 報表分析 KPI card — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `delta` is now the NUMERIC 環比 %
   * from report-math's deltaPct() (null = 分母不成立/無資料 → renders 「—」in a
   * neutral pill); the card formats it (+/− sign, 1 decimal, trend arrow + tone)
   * instead of receiving a preformatted string. `value` stays a display string —
   * the unit differs per card (NT$ / 位 / 筆 / %), so the page composes it with
   * fmtNT()/fmtPct(). Visually unchanged: 44px icon chip, 27px value, pill delta. */
  import { Card, Icon } from '$lib/components/ui';

  let {
    icon,
    label,
    value,
    delta,
    tint,
    color
  }: {
    icon: string;
    label: string;
    value: string;
    /** deltaPct() 環比 %(如 12.5 = +12.5%);null → 顯示「—」。 */
    delta: number | null;
    tint: string;
    color: string;
  } = $props();

  const deltaText = $derived(delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`);
</script>

<Card padding={0} style="overflow:hidden">
  <div style="padding:16px 18px; display:flex; flex-direction:column; gap:10px;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div
        style="width:44px; height:44px; border-radius:10px; background:{tint}; display:flex; align-items:center; justify-content:center;"
      >
        <Icon name={icon} size={22} {color} />
      </div>
      <span class="delta" class:down={delta != null && delta < 0} class:none={delta == null}>
        {#if delta != null}
          <Icon name={delta >= 0 ? 'trending-up' : 'trending-down'} size={13} />
        {/if}
        {deltaText}
      </span>
    </div>
    <div
      style="font-family:var(--df-font-heading); font-size:27px; font-weight:800; color:var(--df-ink); letter-spacing:-0.5px;"
    >
      {value}
    </div>
    <div style="font-size:13px; color:var(--df-text-light); margin-top:-4px;">{label}</div>
  </div>
</Card>

<style>
  .delta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #10b9811a;
    color: var(--df-success-strong);
    font-size: 12px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
  }
  .delta.down {
    background: #ef44441a;
    color: var(--df-error-strong);
  }
  .delta.none {
    background: var(--df-bg-light);
    color: var(--df-text-muted);
  }
</style>
