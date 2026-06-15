<script lang="ts">
  /* Dream Fly ProgressBar — horizontal progress / mastery indicator. */
  type Tone = 'primary' | 'accent' | 'success' | 'warning';

  export let value = 0;
  export let max = 100;
  export let tone: Tone = 'primary';
  export let showLabel = false;
  export let label = '';
  export let height = 8;
  export let style = '';
  let className = '';
  export { className as class };

  $: pct = Math.max(0, Math.min(100, (value / max) * 100));
</script>

<div class="pb {className}" {style}>
  {#if showLabel || label}
    <div class="head">
      <span class="lbl">{label}</span>
      {#if showLabel}<span class="pct">{Math.round(pct)}%</span>{/if}
    </div>
  {/if}
  <div class="track" style="height:{height}px">
    <div class="fill tone-{tone}" style="width:{pct}%"></div>
  </div>
</div>

<style>
  .pb {
    font-family: var(--df-font-body);
  }
  .head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: var(--df-text-sm);
  }
  .lbl {
    color: var(--df-text-light);
  }
  .pct {
    color: var(--df-text-dark);
    font-weight: var(--df-weight-bold);
  }
  .track {
    width: 100%;
    background: var(--df-bg-light);
    border: 1px solid var(--df-border);
    border-radius: var(--df-radius-pill);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: var(--df-radius-pill);
    transition: width 0.4s ease;
  }
  .tone-primary {
    background: var(--df-primary);
  }
  .tone-accent {
    background: var(--df-accent);
  }
  .tone-success {
    background: var(--df-success);
  }
  .tone-warning {
    background: var(--df-warning);
  }
</style>
