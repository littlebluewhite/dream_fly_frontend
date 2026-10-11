<script lang="ts">
  import TabBarShell from '$lib/components/mobile/TabBar.svelte';
  import { tabsFor, adminPath, isActive, type Role } from '$lib/mobile-admin/nav';
  import { unreadConversationCount } from '$lib/coach/conversations';
  export let role: Role;
  $: badges = role === 'coach' ? { messages: $unreadConversationCount } : ({} as Record<string, number>);
</script>
<TabBarShell tabs={tabsFor(role)} hrefFor={(id) => adminPath(role, id)} {isActive} {badges} />
