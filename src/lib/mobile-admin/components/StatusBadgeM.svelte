<script lang="ts">
  /* 學員狀態 badge（MEMBER_STATUS tone+label，帶 dot）。ui.jsx StatusBadgeM (93)。 */
  import Badge from '$lib/components/ui/Badge.svelte';
  import { MEMBER_STATUS } from '$lib/mobile-admin/data';

  export let s: string;

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  $: [tone, label] = (MEMBER_STATUS[s] || MEMBER_STATUS.active) as [Tone, string];
</script>

<Badge {tone} dot>{label}</Badge>
