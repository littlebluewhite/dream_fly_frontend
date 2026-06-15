<script lang="ts">
  /* 訊息中心 右側資訊面板區塊 — reconstructed from spec.
   * Titled collapsible-style block; content via default slot. */
  export let title: string;
</script>

<div style="padding:16px;border-bottom:1px solid var(--df-border)">
  <div style="font-size:12px;font-weight:700;color:var(--df-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">{title}</div>
  <slot />
</div>
