<script lang="ts">
  /* Blue uppercase eyebrow label with wide tracking (e.g. "COURSES · 課程分類"). */
</script>

<span class="kicker"><slot /></span>

<style>
  .kicker {
    display: inline-block;
    font-family: var(--df-font-body);
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-semibold);
    letter-spacing: 0.12em;
    color: var(--df-primary);
  }
</style>
