<script lang="ts">
  /* Panel header — faithful port of shell.jsx `PanelHead`.
   * Sits inside a padding-0 Card; title (+ optional subtitle) on the left with a
   * bottom border, and an optional trailing node on the right. The React `right`
   * node maps to the named slot `right`. */
  export let title: string;
  export let sub: string | undefined = undefined;
</script>

<div
  style="display:flex; justify-content:space-between; align-items:center; padding:18px 22px; border-bottom:1px solid var(--df-border);"
>
  <div>
    <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--df-ink);">{title}</h3>
    {#if sub}
      <div style="font-size:12.5px; color:var(--df-text-light); margin-top:2px;">{sub}</div>
    {/if}
  </div>
  <slot name="right" />
</div>
