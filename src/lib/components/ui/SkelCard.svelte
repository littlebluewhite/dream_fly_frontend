<script lang="ts">
  /* White card wrapper for skeleton groups. */
  export let padding: number | string = 22;
  $: pad = typeof padding === 'number' ? `${padding}px` : padding;
</script>

<div class="skelcard" style="padding:{pad}"><slot /></div>

<style>
  .skelcard {
    background: #fff;
    border: 1px solid var(--df-border);
    border-radius: 12px;
  }
</style>
