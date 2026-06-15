<script lang="ts">
  /* Simulates a fetch: shows the `skeleton` slot for `delay` ms on mount, then
   * the default slot. Matches the prototype's LoadingGate. */
  import { onMount } from 'svelte';
  export let delay = 650;
  let ready = false;
  onMount(() => {
    const t = setTimeout(() => (ready = true), delay);
    return () => clearTimeout(t);
  });
</script>

{#if ready}
  <slot />
{:else}
  <slot name="skeleton" />
{/if}
