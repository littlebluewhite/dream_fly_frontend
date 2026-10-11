<script lang="ts">
  /* 等級 pill。ui.jsx LevelBadge (59-61)。tone 由 courseLevelTone 對應。 */
  import Badge from '$lib/components/ui/Badge.svelte';
  import { courseLevelTone } from '$lib/domain/course-level';

  export let level: string;

  $: tone = courseLevelTone(level);
</script>

<Badge {tone}>{level}</Badge>
