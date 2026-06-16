<script lang="ts">
  /* 等級 pill。ui.jsx LevelBadge (59-61)。tone 由 LEVEL_TONE 對應。 */
  import Badge from '$lib/components/ui/Badge.svelte';
  import { LEVEL_TONE } from '$lib/mobile/data';

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  export let level: string;

  $: tone = (LEVEL_TONE[level] || 'primary') as Tone;
</script>

<Badge {tone}>{level}</Badge>
