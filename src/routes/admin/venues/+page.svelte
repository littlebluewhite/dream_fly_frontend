<script lang="ts">
  /* 場館管理 — faithful port of reports.jsx VenuesView. PageHead + a card grid
   * over the venues: an id chip (Task F4：改顯示 slug，見下) + name + venue
   * StatusBadge + type header, the 器材配置 Tag chips, and the 排課表/編輯 actions.
   * 編輯 / 新增場地 open the VenueEditDialog. 排課表 still fires a toast.
   *
   * Data arrives async via getVenues() (admin seam): onMount loads it into a
   * three-state gate (loading/error/ready); `venues` is the local mutable
   * working copy the card grid renders from.
   *
   * Task F4：新增/編輯 now submit to the real POST /venues / PATCH /venues/{id}
   * (createVenue/updateVenue, admin/api.ts) instead of only mutating `venues`
   * locally (same wiring pattern as Task F1's tickets/+page.svelte). Success
   * refreshes via gate.silentRefresh(); failure shows a 繁中 error toast and
   * keeps the dialog open so the admin can fix and retry. The former local-
   * array 新增 path needed uniqueVenueId() to dodge keyed-id collisions on a
   * user-typed 場地代號 — real venues now come back from the backend with a
   * real id/slug, so that helper (and its import here) is gone (dead by this
   * change, removed together with venue-id.ts/.test.ts).
   *
   * Task F4：id chip 改顯示 v.slug，不是 v.id——真實後端 id 是 UUID，塞進這個原本
   * 設計給短代號用的方塊會整個溢出；slug 是後端提供的人類可讀短字串，同
   * VenueEditDialog 的「場地代號」欄位改顯示 slug 是同一個決定(報告已註明)。 */
  import { onMount } from 'svelte';
  import { Button, Card, Icon, Tag, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatusBadge from '$lib/admin/components/StatusBadge.svelte';
  import VenueEditDialog from '$lib/admin/components/VenueEditDialog.svelte';
  import { toasts } from '$lib/admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import type { Venue } from '$lib/admin/data';
  import { getVenues, createVenue, updateVenue, type VenueWriteBody } from '$lib/admin/api';
  import { apiErrorText } from '$lib/api/error-text';

  const notify = toasts.notify;

  // Blank場地 for the 新增 flow (mirrors classes/+page.svelte blankClass). slug 留空
  // ——由後端依名稱自動產生，這裡的欄位收斂到 VenueResponse 真實形狀(Task F4)。
  const blankVenue = (): Venue => ({
    id: '',
    slug: '',
    name: '',
    type: '',
    equip: [],
    status: 'available'
  });

  let venues: Venue[] = [];
  let edit: Venue | null = null;
  let editOpen = false;
  let addNew = false;

  const gate = createLoadGate({
    fetch: getVenues,
    onData: (d) => { venues = d.venues; }
  });
  onMount(() => {
    gate.load();
  });

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

  // Venue（表單/卡片形狀）→ POST/PATCH /venues 共用欄位。只有 VenueEditDialog 開放
  // 編輯的四個欄位會送出；category_id/image_url/slug 沒有對應 UI，一律不帶(省略＝
  // 維持原值，見 admin/api.ts VenueWriteBody 註解)。
  function buildVenueBody(v: Venue): VenueWriteBody {
    return {
      name: v.name,
      description: v.type,
      features: v.equip,
      is_active: v.status === 'available'
    };
  }

  // 422 驗證 / 403 權限 / 409 slug 撞號 → 對應的繁中錯誤提示；其餘（連線問題等）給
  // 通用訊息，同 tickets/+page.svelte 的 ApiError 判斷慣例。slug 由名稱自動產生且
  // 表單不可編輯，409 文案明講「改名稱」而非「改代號」，才是使用者能實際採取的動作。
  function venueErrorMessage(e: unknown): string {
    return apiErrorText(e, {
      422: '輸入資料不符規則，請確認後再試。',
      403: '沒有權限執行此操作。',
      409: '場地代號（slug）重複，請修改場地名稱後再試。'
    });
  }

  async function save(updated: Venue) {
    const wasNew = addNew;
    const body = buildVenueBody(updated);
    try {
      if (wasNew) {
        await createVenue(body);
      } else {
        await updateVenue(updated.id, body);
      }
    } catch (e) {
      toasts.notify('error', wasNew ? '新增失敗' : '儲存失敗', venueErrorMessage(e));
      return;
    }
    closeEdit();
    toasts.notify(
      'success',
      wasNew ? '已新增場地' : '已儲存場地',
      '「' + updated.name + '」已' + (wasNew ? '建立' : '更新') + '。'
    );
    await gate.silentRefresh();
  }
</script>

<LoadGate {gate}>
  <div style="display:flex; flex-direction:column; gap:20px;" data-testid="venues-skeleton" slot="loading">
    <Skeleton w={160} h={32} r={8} />
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px;">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={200} r={12} /></SkelCard>
      {/each}
    </div>
  </div>

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
        <Card padding={0} hoverable style="overflow:hidden;">
          <div
            style="display:flex; align-items:center; gap:14px; padding:18px 20px 14px; border-bottom:1px solid var(--df-border);"
          >
            <div
              style="width:48px; height:48px; border-radius:12px; background:var(--df-primary-bg); display:flex; align-items:center; justify-content:center; flex:none; overflow:hidden; padding:0 4px; font-family:var(--df-font-heading); font-size:13px; font-weight:800; color:var(--df-primary); text-align:center; white-space:nowrap; text-overflow:ellipsis;"
            >
              {v.slug}
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

          <div style="padding:14px 20px; display:flex; flex-direction:column; gap:10px;">
            <div
              style="font-size:11.5px; font-weight:600; color:var(--df-text-muted); letter-spacing:0.04em;"
            >
              器材配置
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              {#each v.equip as e, i (i)}
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
</LoadGate>
