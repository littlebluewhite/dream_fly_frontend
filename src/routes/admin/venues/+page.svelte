<script lang="ts">
  /* 場館管理 — faithful port of reports.jsx VenuesView. PageHead + a card grid
   * over the venues: an id chip + name + venue StatusBadge + type header, a
   * 面積/容納/今日排課 stats strip, the 器材配置 Tag chips, and the 排課表/編輯
   * actions. The row set is held locally so 新增 / 儲存 reflect immediately; 編輯 /
   * 新增場地 open the VenueEditDialog (the prototype is front-end only). 排課表 still
   * fires a toast. */
  import { Button, Card, Icon, Tag } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatusBadge from '$lib/admin/components/StatusBadge.svelte';
  import VenueEditDialog from '$lib/admin/components/VenueEditDialog.svelte';
  import { uniqueVenueId } from '$lib/admin/components/venue-id';
  import { toasts } from '$lib/admin/stores';
  import { VENUES, type Venue } from '$lib/admin/data';

  const notify = toasts.notify;

  // Blank場地 for the 新增 flow (mirrors classes/+page.svelte blankClass).
  const blankVenue = (): Venue => ({
    id: '',
    name: '',
    type: '',
    area: '',
    cap: 12,
    equip: [],
    status: 'available',
    today: 0
  });

  let venues: Venue[] = VENUES;
  let edit: Venue | null = null;
  let editOpen = false;
  let addNew = false;

  function openEdit(v: Venue) {
    addNew = false;
    edit = v;
    editOpen = true;
  }
  function openNew() {
    addNew = true;
    edit = blankVenue();
    editOpen = true;
  }
  function closeEdit() {
    editOpen = false;
    edit = null;
    addNew = false;
  }
  function save(updated: Venue) {
    if (addNew) {
      // Guarantee a unique keyed id — a user-entered 場地代號 may collide with an
      // existing one, which would throw Svelte's duplicate-key error on the grid.
      const id = uniqueVenueId(venues, updated.id);
      if (updated.id.trim() && id !== updated.id.trim()) {
        notify('info', '場地代號已調整', `代號「${updated.id.trim()}」已存在，已改用「${id}」。`);
      }
      venues = [{ ...updated, id }, ...venues];
    } else {
      venues = venues.map((v) => (v.id === updated.id ? updated : v));
    }
    closeEdit();
  }
</script>

<div style="display:flex; flex-direction:column; gap:20px;">
  <PageHead title="場館管理" sub="教室、訓練場地與器材配置">
    <svelte:fragment slot="actions">
      <Button variant="primary" size="sm" on:click={openNew}>
        <Icon name="plus" size={15} style="margin-right:6px;" />新增場地
      </Button>
    </svelte:fragment>
  </PageHead>

  <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px;">
    {#each venues as v (v.id)}
      {@const stats = [
        [v.area, '面積'],
        [v.cap + ' 人', '容納'],
        [v.today + ' 堂', '今日排課']
      ] as [string, string][]}
      <Card padding={0} hoverable style="overflow:hidden;">
        <div
          style="display:flex; align-items:center; gap:14px; padding:18px 20px 14px; border-bottom:1px solid var(--df-border);"
        >
          <div
            style="width:48px; height:48px; border-radius:12px; background:var(--df-primary-bg); display:flex; align-items:center; justify-content:center; flex:none; font-family:var(--df-font-heading); font-size:20px; font-weight:800; color:var(--df-primary);"
          >
            {v.id}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px;">
              <h3
                style="margin:0; font-size:17px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-heading);"
              >
                {v.name}
              </h3>
              <StatusBadge kind="venue" value={v.status} />
            </div>
            <div style="font-size:12.5px; color:var(--df-text-light); margin-top:3px;">{v.type}</div>
          </div>
        </div>

        <div
          style="display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1px solid var(--df-border);"
        >
          {#each stats as [val, lbl], i (lbl)}
            <div
              style="padding:12px 0; text-align:center; border-left:{i
                ? '1px solid var(--df-border)'
                : 'none'};"
            >
              <div
                style="font-size:16px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);"
              >
                {val}
              </div>
              <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">{lbl}</div>
            </div>
          {/each}
        </div>

        <div style="padding:14px 20px; display:flex; flex-direction:column; gap:10px;">
          <div
            style="font-size:11.5px; font-weight:600; color:var(--df-text-muted); letter-spacing:0.04em;"
          >
            器材配置
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            {#each v.equip as e (e)}
              <Tag>{e}</Tag>
            {/each}
          </div>
        </div>

        <div style="display:flex; gap:8px; padding:0 20px 18px;">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            on:click={() => notify('info', v.name, '顯示 ' + v.name + ' 的排課時段。')}
          >
            <Icon name="calendar-days" size={14} style="margin-right:6px;" />排課表
          </Button>
          <Button variant="primary" size="sm" fullWidth on:click={() => openEdit(v)}>
            <Icon name="pencil-line" size={14} style="margin-right:6px;" />編輯
          </Button>
        </div>
      </Card>
    {/each}
  </div>
</div>

<VenueEditDialog venue={edit} open={editOpen} isNew={addNew} onClose={closeEdit} onSave={save} />
