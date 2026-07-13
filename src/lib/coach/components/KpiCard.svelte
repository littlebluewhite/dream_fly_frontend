<script lang="ts">
  /* 教練端 KPI card (shell.jsx:202-215). Free-text coloured `sub` line with an
   * optional leading icon — distinct from admin's StatCard. Value + optional
   * right-hand icon tile. */
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let label: string;
  export let value: string | number;
  export let sub = '';
  export let subTone = 'var(--df-primary)';
  export let icon: IconName | undefined = undefined;
  export let iconColor = 'var(--df-primary)';
</script>

<Card padding={20}>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
    <div style="min-width:0">
      <div style="font-size:13px;color:var(--df-text-light)">{label}</div>
      <div
        style="font-size:28px;font-weight:800;color:var(--df-text-dark);margin-top:8px;font-family:var(--df-font-body);letter-spacing:-0.5px"
      >
        {value}
      </div>
      {#if sub}
        <div style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:{subTone};margin-top:8px">
          {#if icon}<Icon name={icon} size={14} color={subTone} />{/if}{sub}
        </div>
      {/if}
    </div>
    {#if icon}
      <div
        style="width:40px;height:40px;border-radius:10px;background:var(--df-bg-light);display:flex;align-items:center;justify-content:center;flex:none"
      >
        <Icon name={icon} size={20} color={iconColor} />
      </div>
    {/if}
  </div>
</Card>
