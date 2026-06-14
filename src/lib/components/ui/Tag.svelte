<script lang="ts">
  /* Square (4px) neutral chip — per DS, square radius is reserved for tags. */
</script>

<span class="tag"><slot /></span>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--df-radius-sm);
    background: var(--df-bg-light);
    border: 1px solid var(--df-border);
    font-size: var(--df-text-xs);
    font-weight: var(--df-weight-medium);
    color: var(--df-text-light);
    white-space: nowrap;
  }
</style>
