<script lang="ts">
  /* Page/section header — faithful port of shell.jsx `PageHead`.
   * Title (+ optional subtitle) on the left, trailing actions on the right. The
   * React `actions` node maps to the named slot `actions`; the wrapper renders
   * only when that slot is filled. */
  export let title: string;
  export let sub: string | undefined = undefined;
</script>

<div
  style="display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:20px; flex-wrap:wrap;"
>
  <div>
    <h2
      style="margin:0; font-family:var(--df-font-heading); font-size:24px; font-weight:800; color:var(--df-ink);"
    >
      {title}
    </h2>
    {#if sub}
      <p style="margin:5px 0 0; font-size:14px; color:var(--df-text-light);">{sub}</p>
    {/if}
  </div>
  {#if $$slots.actions}
    <div style="display:flex; gap:10px; align-items:center;">
      <slot name="actions" />
    </div>
  {/if}
</div>
