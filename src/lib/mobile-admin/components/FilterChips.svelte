<script lang="ts" context="module">
  export interface ChipItem {
    key: string;
    label?: string;
    count?: number;
  }
</script>

<script lang="ts">
  /* Filter chips（水平捲動）。ui.jsx FilterChips (238-254)。
   * items 可為 string[] 或 {key,label,count}[]。用 df-hide-scrollbar（非 df-scroll）。 */
  export let items: (string | ChipItem)[] = [];
  export let value: string;
  export let onChange: (key: string) => void;

  const keyOf = (it: string | ChipItem) => (typeof it === 'string' ? it : it.key);
  const labelOf = (it: string | ChipItem) => (typeof it === 'string' ? it : it.label ?? it.key);
  const countOf = (it: string | ChipItem) => (typeof it === 'string' ? undefined : it.count);
</script>

<div
  class="df-hide-scrollbar"
  style="display:flex; gap:8px; overflow-x:auto; margin:0 -14px; padding:0 14px 2px;"
>
  {#each items as it (keyOf(it))}
    {@const key = keyOf(it)}
    {@const on = value === key}
    {@const count = countOf(it)}
    <button
      on:click={() => onChange(key)}
      class="df-tapscale"
      style="flex:none; height:34px; padding:0 14px; border-radius:999px;
        border:1.5px solid {on ? 'var(--df-primary)' : 'var(--df-border)'};
        background:{on ? 'var(--df-primary)' : '#fff'}; color:{on ? '#fff' : 'var(--df-text-dark)'};
        font-size:13px; font-weight:{on ? 700 : 500}; cursor:pointer; white-space:nowrap;
        display:flex; align-items:center; gap:5px;"
    >
      {labelOf(it)}
      {#if count != null}
        <span style="font-size:11.5px; font-weight:700; color:{on ? 'rgba(255,255,255,0.85)' : 'var(--df-text-muted)'};">{count}</span>
      {/if}
    </button>
  {/each}
</div>
