<script lang="ts">
  /* 班級程度 badge。ui.jsx LevelBadge (92)。 */
  import Badge from '$lib/components/ui/Badge.svelte';
  import { LEVEL_TONE } from '$lib/mobile-admin/data';

  export let level: string;

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  $: tone = (LEVEL_TONE[level] || 'primary') as Tone;
</script>

<Badge {tone}>{level}</Badge>
