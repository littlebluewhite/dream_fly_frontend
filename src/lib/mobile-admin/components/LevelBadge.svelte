<script lang="ts">
  /* 班級程度 badge。ui.jsx LevelBadge (92)。 */
  import Badge from '$lib/components/ui/Badge.svelte';
  import { courseLevelTone } from '$lib/domain/course-level';

  export let level: string;

  $: tone = courseLevelTone(level);
</script>

<Badge {tone}>{level}</Badge>
