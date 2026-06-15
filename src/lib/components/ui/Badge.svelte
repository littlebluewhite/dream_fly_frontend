<script lang="ts">
  /* Small pill label. Semantic tones use tint-bg + a contrast-safe dark text
   * (the raw semantic hues don't pass AA as text on their tints).
   * `dot` prepends a status dot; `solid` fills the pill with the tone colour. */
  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  export let tone: Tone = 'primary';
  export let solid = false;
  export let dot = false;
</script>

<span class="badge {tone}" class:solid>
  {#if dot}<span class="dot"></span>{/if}
  <slot />
</span>

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
  /* ── Tint (default) ── */
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
  /* ── Leading dot — uses the tone's strong hue ── */
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: none;
  }
  .primary .dot {
    background: var(--df-primary);
  }
  .accent .dot {
    background: var(--df-accent-dark);
  }
  .success .dot {
    background: var(--df-success);
  }
  .warning .dot {
    background: var(--df-warning);
  }
  .error .dot {
    background: var(--df-error);
  }
  .info .dot {
    background: var(--df-info);
  }
  .neutral .dot {
    background: var(--df-text-muted);
  }
  /* ── Solid fill ── */
  .solid {
    color: #fff;
  }
  .solid.primary {
    background: var(--df-primary);
  }
  .solid.accent {
    background: var(--df-accent);
    color: var(--df-ink);
  }
  .solid.success {
    background: var(--df-success);
  }
  .solid.warning {
    background: var(--df-warning);
  }
  .solid.error {
    background: var(--df-error);
  }
  .solid.info {
    background: var(--df-info);
  }
  .solid.neutral {
    background: var(--df-text-light);
  }
  .solid .dot {
    background: currentColor;
  }
</style>
