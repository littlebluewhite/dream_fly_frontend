<script lang="ts">
  /* 把 identity-probe 放進指定 layout 的 slot,模擬「layout 底下的頁面」。 */
  import IdentityProbe from './identity-probe.fixture.svelte';

  export let Layout: typeof import('svelte').SvelteComponent<any> | any;
</script>

<svelte:component this={Layout}><IdentityProbe /></svelte:component>
