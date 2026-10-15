<script lang="ts">
  /* 把 identity-probe 放進指定 layout(或身分範圍)的 slot,模擬「layout 底下的頁面」;props 原樣轉給它。 */
  import IdentityProbe from './identity-probe.fixture.svelte';

  export let Layout: typeof import('svelte').SvelteComponent<any> | any;
  export let props: Record<string, unknown> = {};
</script>

<svelte:component this={Layout} {...props}><IdentityProbe /></svelte:component>
