<script lang="ts">
  /* Small pill label. Semantic tones use tint-bg + a contrast-safe dark text
   * (the raw semantic hues don't pass AA as text on their tints). */
  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  export let tone: Tone = 'primary';
</script>

<span class="badge {tone}"><slot /></span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: var(--df-radius-pill);
    font-size: var(--df-text-xs);
    font-weight: var(--df-weight-semibold);
    line-height: 1.5;
    white-space: nowrap;
  }
  .primary {
    background: var(--df-primary-bg);
    color: var(--df-primary);
  }
  .accent {
    background: var(--df-accent);
    color: var(--df-ink);
  }
  .success {
    background: var(--df-success-bg);
    color: var(--df-success-strong);
  }
  .warning {
    background: var(--df-warning-bg);
    color: #92400e;
  }
  .error {
    background: var(--df-error-bg);
    color: var(--df-error-strong);
  }
  .info {
    background: var(--df-info-bg);
    color: #0369a1;
  }
  .neutral {
    background: var(--df-bg-light);
    color: var(--df-text-light);
  }
</style>
