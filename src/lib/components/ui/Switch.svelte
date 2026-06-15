<script lang="ts">
  /* Dream Fly Switch — on/off toggle (44×26 track, 20px knob). Use bind:checked;
   * also dispatches a `change` event with the new boolean. */
  import { createEventDispatcher } from 'svelte';

  export let checked = false;
  export let disabled = false;
  export let label = '';
  export let style = '';
  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher<{ change: boolean }>();
  function toggle() {
    if (disabled) return;
    checked = !checked;
    dispatch('change', checked);
  }
</script>

<label class="sw {className}" class:disabled {style}>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label || 'toggle'}
    class="track"
    class:on={checked}
    {disabled}
    on:click={toggle}
  >
    <span class="knob" class:on={checked}></span>
  </button>
  {#if label}<span class="label">{label}</span>{/if}
</label>

<style>
  .sw {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-family: var(--df-font-body);
    font-size: var(--df-text-base);
    color: var(--df-text-dark);
    cursor: pointer;
    user-select: none;
  }
  .sw.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .track {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 44px;
    height: 26px;
    flex: none;
    padding: 0;
    border: none;
    border-radius: var(--df-radius-pill);
    background: var(--df-border-strong);
    cursor: inherit;
    transition: background 0.18s ease;
  }
  .track.on {
    background: var(--df-primary);
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: left 0.18s ease;
  }
  .knob.on {
    left: 21px;
  }
</style>
