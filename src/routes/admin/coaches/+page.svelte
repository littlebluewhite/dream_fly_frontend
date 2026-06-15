<script lang="ts">
  /* 教練管理 — faithful port of admin.jsx CoachesView. PageHead (教練團隊 + 新增教練)
   * over a responsive grid of CoachCard, filtered by the topbar `search` store
   * (matches 姓名 / 職稱 / 專長標籤, case-insensitive). The pencil on a card opens
   * CoachEditDialog on that coach; 新增教練 opens it on a blank coach. Saves update
   * the local working copy (mock-only — no backend), appending new coaches. */
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import CoachCard from '$lib/admin/components/CoachCard.svelte';
  import CoachEditDialog from '$lib/admin/components/CoachEditDialog.svelte';
  import { Button, Icon } from '$lib/components/ui';
  import { COACHES, type Coach } from '$lib/admin/data';
  import { search } from '$lib/admin/stores';

  const blankCoach = (): Coach => ({
    id: '',
    name: '',
    initial: '',
    title: '',
    color: '#0066CC',
    tags: [],
    years: 0,
    students: 0,
    awards: 0,
    classes: 0,
    status: 'online',
    phone: ''
  });

  // Local working copy so saves reflect immediately (mirrors the source useState).
  let coaches: Coach[] = COACHES;

  let editing: Coach | null = null;
  let editOpen = false;
  let addNew = false;

  // Filter by 姓名 / 職稱 / 專長標籤, case-insensitive (source matches name/title/tags).
  $: q = $search.trim().toLowerCase();
  $: visible = q
    ? coaches.filter((c) =>
        (c.name + c.title + c.tags.join('')).toLowerCase().includes(q)
      )
    : coaches;

  function openEdit(c: Coach) {
    addNew = false;
    editing = c;
    editOpen = true;
  }

  function openNew() {
    addNew = true;
    editing = blankCoach();
    editOpen = true;
  }

  function onSaved(updated: Coach) {
    if (addNew) {
      const id = 'c' + (coaches.length + 1);
      coaches = [...coaches, { ...updated, id }];
    } else {
      coaches = coaches.map((c) => (c.id === updated.id ? updated : c));
    }
    editOpen = false;
    editing = null;
    addNew = false;
  }

  function onClose() {
    editOpen = false;
    editing = null;
    addNew = false;
  }
</script>

<PageHead title="教練團隊" sub={coaches.length + ' 位專任教練'}>
  <svelte:fragment slot="actions">
    <Button variant="primary" size="sm" on:click={openNew}>
      <Icon name="user-plus" size={15} />新增教練
    </Button>
  </svelte:fragment>
</PageHead>

<div class="grid">
  {#each visible as coach (coach.id)}
    <CoachCard {coach} onEdit={openEdit} />
  {/each}
  {#if visible.length === 0}
    <div class="empty">找不到符合的教練</div>
  {/if}
</div>

<CoachEditDialog coach={editing} open={editOpen} isNew={addNew} {onClose} onSave={onSaved} />

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 16px;
  }
  .empty {
    grid-column: 1 / -1;
    padding: 40px 22px;
    text-align: center;
    color: var(--df-text-muted);
    font-size: 14px;
  }
  /* the source's primary action button shows a leading icon beside the label */
  :global(.df-view) :global(.btn-primary) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
