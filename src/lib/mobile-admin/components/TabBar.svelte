<script lang="ts">
  import TabBarShell from '$lib/components/mobile/TabBar.svelte';
  import { tabsFor, adminPath, isActive, type Role } from '$lib/mobile-admin/nav';
  import { coachMsgUnread } from '$lib/mobile-admin/stores';
  export let role: Role;
  $: badges = role === 'coach' ? { messages: $coachMsgUnread } : ({} as Record<string, number>);
</script>
<TabBarShell tabs={tabsFor(role)} hrefFor={(id) => adminPath(role, id)} {isActive} {badges} />
