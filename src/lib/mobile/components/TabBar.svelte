<script lang="ts">
  import TabBarShell from '$lib/components/mobile/TabBar.svelte';
  import { TABS, mobilePath, isActive } from '$lib/mobile/nav';
  import { unread } from '$lib/mobile/stores';
</script>
<TabBarShell tabs={TABS} hrefFor={mobilePath} {isActive} badges={{ notifications: $unread }} />
