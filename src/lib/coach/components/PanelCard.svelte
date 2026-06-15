<script lang="ts">
  /* 教練端 panel card (shell.jsx:217-227): title row (with an optional
   * `查看全部 →` link OR a `right` named slot) over a padding:0 Card. Body is the
   * default slot; `padding` controls the body inset only. */
  import Card from '$lib/components/ui/Card.svelte';

  export let title: string;
  export let viewAll = '';
  export let onViewAll: () => void = () => {};
  export let padding = 20;
</script>

<Card padding={0}>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 14px">
    <h3 style="margin:0;font-size:15.5px;font-weight:700;color:var(--df-text-dark);font-family:var(--df-font-body)">
      {title}
    </h3>
    {#if $$slots.right}
      <slot name="right" />
    {:else if viewAll}
      <button
        type="button"
        on:click={onViewAll}
        style="border:none;background:transparent;color:var(--df-primary);font-size:13px;font-weight:500;cursor:pointer;font-family:var(--df-font-body)"
      >
        {viewAll} →
      </button>
    {/if}
  </div>
  <div style="padding:0 {padding}px {padding}px"><slot /></div>
</Card>
