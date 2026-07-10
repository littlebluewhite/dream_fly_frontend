<script lang="ts">
  /* 教練管理 — faithful port of admin.jsx CoachesView. PageHead (教練團隊 + 新增教練)
   * over a responsive grid of CoachCard, filtered by the topbar `search` store
   * (matches 姓名 / 職稱 / 專長標籤, case-insensitive). The pencil on a card opens
   * CoachEditDialog on that coach; 新增教練 opens it in new mode.
   *
   * Data arrives async via getCoaches() (admin seam): onMount loads it into a
   * three-state gate (loading/error/ready); `coaches` is the local mutable
   * working copy.
   *
   * Task F5：新增/編輯改接真後端。新增教練的產品流程是「先建 user 帳號、再綁
   * coach」兩步——後端沒有複合端點：
   *   1. createMember({email,name,password})（POST /users，Task 16 既有）拿 user_id。
   *   2. createCoach({user_id,title,specialties,is_active})（POST /coaches）。
   * 第一步失敗：一般新增失敗處理(繁中錯誤 toast，對話框維持開啟)。第二步失敗：
   * 使用者帳號「已經」真的建立了，但這位還沒有教練身分——不做自動回滾（後端沒有
   * 複合建立端點，也沒有刪除使用者的端點可呼叫，任務報告已註明）。把已建立的
   * user_id 記在 pendingUserId：只要對話框還開著（使用者可以直接重新點擊「建立
   * 教練」），儲存時見 pendingUserId 非 null 就跳過 createMember、只重打
   * createCoach，不會因為 email 已被使用而 409。若改按取消，pendingUserId 隨
   * closeEdit() 清空——沒有「關閉後仍可續傳」的機制，錯誤文案另外提示可至會員
   * 管理頁確認該帳號。
   *
   * 編輯模式：姓名有變才呼叫 updateMember(coach.userId,{name})（PATCH
   * /users/{user_id}）；教練欄位(title/tags/isActive)一律呼叫
   * updateCoach(coach.id,...)（同 MemberEditDialog 的全量 resend 慣例——PATCH
   * /coaches/{id} 對未變動的欄位是 no-op，只刷新 updated_at，不是驗證錯誤）。兩者
   * 皆有變動時依序執行：先 users 後 coaches，任一失敗即中止並顯示對應錯誤，不繼續
   * 打下一支。 */
  import { onMount } from 'svelte';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import CoachCard from '$lib/admin/components/CoachCard.svelte';
  import CoachEditDialog from '$lib/admin/components/CoachEditDialog.svelte';
  import { Button, Icon, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { createLoadGate } from '$lib/load-gate';
  import type { Coach, CoachFormValues } from '$lib/admin/data';
  import { search, toasts } from '$lib/admin/stores';
  import {
    getCoaches,
    createCoach,
    updateCoach,
    createMember,
    updateMember,
    type CoachWriteBody
  } from '$lib/admin/api';
  import { ApiError } from '$lib/api/client';

  let coaches: Coach[] = [];

  let editing: Coach | null = null;
  let editOpen = false;
  let addNew = false;
  /** 新增流程中若 createCoach（第二步）失敗，記下第一步已建立的 user_id，讓「同一次
   *  對話框工作階段」內的重試只補打第二步，不會重新 POST /users 撞 409 email 重複。
   *  取消或成功後清空——見上方檔頭註解。 */
  let pendingUserId: string | null = null;

  const gate = createLoadGate({
    fetch: getCoaches,
    onData: (d) => { coaches = d.coaches; }
  });
  onMount(() => {
    gate.load();
  });

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
    editing = null;
    pendingUserId = null;
    editOpen = true;
  }

  function closeEdit() {
    editOpen = false;
    editing = null;
    addNew = false;
    pendingUserId = null;
  }

  // /users 端點(createMember/updateMember)的錯誤訊息已是後端給的 繁中 使用者可讀
  // 文字(例："Email 已被使用")，直接透傳，同 members/+page.svelte 的
  // memberErrorMessage 慣例。
  function memberErrorMessage(e: unknown): string {
    return e instanceof ApiError ? e.message : '連線發生問題，請稍後再試。';
  }

  // /coaches 端點的 404/409 是後端英文文字(coaches/service.rs 的
  // AppError::NotFound/Conflict)，跟 /users 端點的 繁中 訊息來源不同，故用狀態碼
  // 對應繁中文案(同 venueErrorMessage 慣例)，不直接顯示 e.message。
  function coachErrorMessage(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 404) return '找不到對應的使用者帳號。';
      if (e.status === 409) return '這個帳號已經是教練身分了。';
      if (e.status === 422) return '輸入資料不符規則，請確認後再試。';
    }
    return '連線發生問題，請稍後再試。';
  }

  function coachBody(v: CoachFormValues): CoachWriteBody {
    return { title: v.title, specialties: v.tags, is_active: v.isActive };
  }

  async function saveNew(v: CoachFormValues) {
    let userId = pendingUserId;
    if (!userId) {
      try {
        userId = (await createMember({ email: v.email, name: v.name, password: v.password })).id;
      } catch (e) {
        toasts.notify('error', '新增失敗', memberErrorMessage(e));
        return;
      }
    }
    try {
      await createCoach({ user_id: userId, ...coachBody(v) });
    } catch (e) {
      pendingUserId = userId; // 帳號已建立——留給同一個對話框工作階段內的重試
      toasts.notify(
        'error',
        '教練綁定失敗',
        `帳號「${v.email}」已建立，但綁定教練身分失敗（${coachErrorMessage(e)}）。可重新點擊「建立教練」重試綁定，或至「會員管理」頁面確認該帳號。`
      );
      return;
    }
    pendingUserId = null;
    closeEdit();
    toasts.notify('success', '已新增教練', `「${v.name}」已建立為教練。`);
    await gate.silentRefresh();
  }

  async function saveEdit(v: CoachFormValues) {
    if (!editing) return;
    const target = editing;
    if (v.name.trim() !== target.name) {
      try {
        await updateMember(target.userId, { name: v.name.trim() });
      } catch (e) {
        toasts.notify('error', '儲存失敗', memberErrorMessage(e));
        return;
      }
    }
    try {
      await updateCoach(target.id, coachBody(v));
    } catch (e) {
      toasts.notify('error', '儲存失敗', coachErrorMessage(e));
      return;
    }
    closeEdit();
    toasts.notify('success', '已儲存', `${v.name} 教練資料已更新。`);
    await gate.silentRefresh();
  }

  function save(v: CoachFormValues): Promise<void> {
    return addNew ? saveNew(v) : saveEdit(v);
  }
</script>

<LoadGate {gate}>
  <div class="grid" data-testid="coaches-skeleton" slot="loading">
    {#each [0, 1, 2] as i (i)}
      <SkelCard><Skeleton w="100%" h={240} r={12} /></SkelCard>
    {/each}
  </div>

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

  <CoachEditDialog
    coach={editing}
    open={editOpen}
    isNew={addNew}
    {pendingUserId}
    onClose={closeEdit}
    onSave={save}
  />
</LoadGate>

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
