<script lang="ts">
  /* KPI 統計卡（2-up grid）。ui.jsx KpiCard (206-217)。
   *
   * delta 契約同桌面 ReportKpi.svelte(Task C5 合一)：吃 report-math 的 deltaPct()
   * 環比 % 數值(number | null)，元件內部格式化(+/− 號、1 位小數)，呼叫端不再傳
   * preformatted 字串。中性態不同於桌面：桌面 ReportKpi 對 null 顯示「—」中性
   * pill；行動版沿用 KpiCard 既有的省略慣例，null → 不渲染 chip(無中性態)。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let icon: IconName;
  export let label: string;
  export let value: string | number;
  /** deltaPct() 環比 %(如 12.5 = +12.5%)；null(分母不成立/無資料)→ 不渲染 chip。 */
  export let delta: number | null = null;
  export let tint = 'var(--df-primary-bg)';
  export let color = 'var(--df-primary)';
  export let onClick: (() => void) | undefined = undefined;

  $: up = delta != null && delta >= 0;
  $: deltaText = delta == null ? '' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  on:click={onClick}
  class={onClick ? 'df-tapscale' : ''}
  style="background:#fff; border:1px solid var(--df-border); border-radius:14px; padding:14px;
    box-shadow:var(--df-shadow-card); cursor:{onClick ? 'pointer' : 'default'};"
>
  <div style="display:flex; align-items:center; justify-content:space-between;">
    <div
      style="width:38px; height:38px; border-radius:11px; background:{tint};
        display:flex; align-items:center; justify-content:center;"
    >
      <Icon name={icon} size={20} color={color} />
    </div>
    {#if delta != null}
      <span
        style="display:inline-flex; align-items:center; gap:2px; font-size:12px; font-weight:700;
          color:{up ? 'var(--df-success-strong, #15803D)' : 'var(--df-error-strong, #B91C1C)'};"
      >
        <Icon name={up ? 'trending-up' : 'trending-down'} size={13} />{deltaText}
      </span>
    {/if}
  </div>
  <div
    style="font-family:var(--df-font-heading); font-size:25px; font-weight:800; color:var(--df-ink);
      margin-top:12px; letter-spacing:-0.5px;"
  >{value}</div>
  <div style="font-size:12.5px; color:var(--df-text-light); margin-top:1px;">{label}</div>
</div>
