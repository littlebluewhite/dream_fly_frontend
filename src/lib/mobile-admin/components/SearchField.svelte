<script lang="ts">
  /* 搜尋欄。ui.jsx SearchField (257-265)。 */
  import Icon from '$lib/components/ui/Icon.svelte';

  export let value = '';
  export let onChange: (v: string) => void;
  export let placeholder = '';
</script>

<div
  style="display:flex; align-items:center; gap:8px; background:var(--df-bg-light);
    border:1px solid var(--df-border); border-radius:11px; padding:0 13px; height:42px;"
>
  <Icon name="search" size={17} color="var(--df-text-muted)" />
  <input
    {value}
    on:input={(e) => onChange((e.target as HTMLInputElement).value)}
    {placeholder}
    style="flex:1; border:none; background:transparent; outline:none; font-size:14px;
      color:var(--df-text-dark); font-family:var(--df-font-body); min-width:0;"
  />
  {#if value}
    <button
      aria-label="清除"
      on:click={() => onChange('')}
      style="border:none; background:none; cursor:pointer; padding:0; display:flex;"
    >
      <Icon name="x" size={16} color="var(--df-text-muted)" />
    </button>
  {/if}
</div>
