<script lang="ts">
  /* Dream Fly Stepper — numbered horizontal progress for multi-step flows
   * (e.g. checkout). Steps before `current` show a check; the active step is
   * blue; future steps are muted. */
  export let steps: string[] = [];
  export let current = 0;
  export let style = '';
  let className = '';
  export { className as class };
</script>

<div class="stepper {className}" {style}>
  {#each steps as label, i}
    {@const done = i < current}
    {@const active = i === current}
    <div class="step">
      <span class="circle" class:done class:active>
        {#if done}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        {:else}{i + 1}{/if}
      </span>
      <span class="label" class:done class:active>{label}</span>
    </div>
    {#if i < steps.length - 1}<span class="line" class:done={i < current}></span>{/if}
  {/each}
</div>

<style>
  .stepper {
    display: flex;
    align-items: center;
    width: 100%;
    font-family: var(--df-font-body);
  }
  .step {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }
  .circle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: 50%;
    background: #fff;
    border: 1.5px solid var(--df-border-strong);
    color: var(--df-text-muted);
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-bold);
  }
  .circle.active {
    background: var(--df-primary);
    border-color: var(--df-primary);
    color: #fff;
  }
  .circle.done {
    background: var(--df-success);
    border-color: var(--df-success);
    color: #fff;
  }
  .label {
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-medium);
    color: var(--df-text-muted);
    white-space: nowrap;
  }
  .label.active {
    font-weight: var(--df-weight-bold);
    color: var(--df-primary);
  }
  .label.done {
    color: var(--df-success);
  }
  .line {
    flex: 1;
    height: 2px;
    margin: 0 12px;
    background: var(--df-border);
    border-radius: 2px;
  }
  .line.done {
    background: var(--df-success);
  }
</style>
