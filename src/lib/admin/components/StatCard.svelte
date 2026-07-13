<script lang="ts">
  /* Dashboard KPI card — faithful port of shell.jsx `StatCard`.
   * An icon chip (tinted bg + coloured icon) over a large value and label, with
   * an optional delta. `up` alone drives the trend arrow/colour and is independent
   * of the delta sign (admin.jsx passes e.g. `delta="-2" up` for 出席偏低). The
   * delta is omitted when null/undefined. */
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let icon: IconName;
  export let label: string;
  export let value: string | number;
  export let delta: string | number | null | undefined = undefined;
  export let up = false;
  export let tint = 'var(--df-primary-bg)';
  export let color = 'var(--df-primary)';
</script>

<Card padding={20}>
  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
    <div
      style="width:42px; height:42px; border-radius:11px; background:{tint}; display:flex; align-items:center; justify-content:center;"
    >
      <Icon name={icon} size={21} {color} />
    </div>
    {#if delta != null}
      <span
        style="display:inline-flex; align-items:center; gap:3px; font-size:12px; font-weight:700; color:{up
          ? 'var(--df-success-strong)'
          : 'var(--df-error-strong)'};"
      >
        <Icon name={up ? 'trending-up' : 'trending-down'} size={14} />{delta}
      </span>
    {/if}
  </div>
  <div
    style="font-family:var(--df-font-heading); font-size:30px; font-weight:800; color:var(--df-ink); margin-top:14px; letter-spacing:-0.5px;"
  >
    {value}
  </div>
  <div style="font-size:13px; color:var(--df-text-light); margin-top:2px;">{label}</div>
</Card>
