<script lang="ts">
  /* 小型統計格。ui.jsx StatTile (165-172)。 */
  export let value: string | number;
  export let label: string;
  export let color = 'var(--df-primary)';
</script>

<div style="flex:1; text-align:center;">
  <div style="font-family:var(--df-font-heading); font-size:24px; font-weight:800; color:{color};">{value}</div>
  <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">{label}</div>
</div>
