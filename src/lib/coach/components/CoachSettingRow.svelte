<script lang="ts">
  /* 教練端 CoachSettingRow — settings row with a leading 40px icon tile.
   * Props: icon (kebab name), title, desc.
   * Trailing slot is for a Switch or other control. */
  import Icon from '$lib/components/ui/Icon.svelte';

  export let icon = '';
  export let title = '';
  export let desc = '';
</script>

<div
  style="display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid var(--df-border)"
>
  <!-- Leading icon tile -->
  <div
    style="width:40px;height:40px;border-radius:10px;background:var(--df-primary-bg);display:flex;align-items:center;justify-content:center;flex:none"
  >
    <Icon name={icon} size={20} color="var(--df-primary)" />
  </div>

  <!-- Text -->
  <div style="flex:1;min-width:0">
    <div
      style="font-size:var(--df-text-base);font-weight:var(--df-weight-semibold);color:var(--df-text-dark);font-family:var(--df-font-body)"
    >
      {title}
    </div>
    {#if desc}
      <div
        style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px;font-family:var(--df-font-body)"
      >
        {desc}
      </div>
    {/if}
  </div>

  <!-- Trailing slot -->
  <div style="flex:none">
    <slot />
  </div>
</div>
