<script lang="ts">
  /* 教練管理 push screen。admin2.jsx CoachesScreen (68)。
   * $coaches 卡片（Avatar + 公開顯示狀態 + 標籤 + 課表）；
   * 新增 → onNew()（未提供時 overlay.sheet('coachForm',{c:null,onSave})）；
   * 編輯鉛筆 → overlay.sheet('coachForm',{c,onSave})。
   *
   * Task F5：新增/編輯改接真 POST/PATCH /coaches + POST/PATCH /users——同桌面
   * routes/admin/coaches/+page.svelte 的兩步流程（先建 user 帳號、再綁 coach）與
   * 錯誤訊息設計，經 $lib/mobile-admin/api 薄層重用同一組
   * createCoach/updateCoach/createMember/updateMember。寫入成功後 refreshOps()
   * 整包重抓 members/classes/coaches/orders 四個 store（同
   * routes/mobile-admin/admin/members/+page.svelte 慣例），取代舊有的本地
   * saveCoach() 假寫入。
   *
   * 本頁沿用既有的「儲存即關閉 sheet、成功/失敗 toast 非同步顯示」慣例（同
   * MemberForm 對照的 members/+page.svelte handleSave），跟桌面「失敗時保留對話框
   * 供重試」的慣例不同——故第二步（教練綁定）失敗時，本頁不提供「同一個 sheet
   * 工作階段內重試」的機制（sheet 已經關閉），錯誤 toast 改為建議至「學員管理」頁
   * 確認帳號、或重新執行一次新增教練（換一個 email）。同桌面一樣不做自動回滾
   * （後端沒有複合建立端點，也沒有刪除使用者的端點可呼叫）。 */
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Tag from '$lib/components/ui/Tag.svelte';
  import { overlay, coaches as coachesStore, toasts, refreshOps } from '$lib/mobile-admin/stores';
  import type { Coach } from '$lib/mobile-admin/data';
  import {
    createCoach,
    updateCoach,
    createMember,
    updateMember,
    type CoachFormValues,
    type CoachWriteBody
  } from '$lib/mobile-admin/api';
  import { ApiError } from '$lib/api/client';

  export let onBack: () => void;
  export let onNew: (() => void) | undefined = undefined;

  // /users 端點(createMember/updateMember)的錯誤訊息已是後端給的 繁中 使用者可讀
  // 文字，直接透傳，同桌面 memberErrorMessage 慣例。
  function memberErrorMessage(e: unknown): string {
    return e instanceof ApiError ? e.message : '連線發生問題，請稍後再試。';
  }

  // /coaches 端點的 404/409 是後端英文文字(coaches/service.rs)，跟 /users 端點的
  // 繁中 訊息來源不同，故用狀態碼對應繁中文案，不直接顯示 e.message（同桌面
  // coachErrorMessage 慣例）。
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

  async function createAndRefresh(v: CoachFormValues) {
    let userId: string;
    try {
      userId = (await createMember({ email: v.email, name: v.name, password: v.password })).id;
    } catch (e) {
      toasts.notify('error', '新增失敗', memberErrorMessage(e));
      return;
    }
    try {
      await createCoach({ user_id: userId, ...coachBody(v) });
    } catch (e) {
      toasts.notify(
        'error',
        '教練綁定失敗',
        `帳號「${v.email}」已建立，但綁定教練身分失敗（${coachErrorMessage(e)}）。請至「學員管理」頁確認該帳號，或重新新增一次教練。`
      );
      return;
    }
    toasts.notify('success', '已新增教練', `「${v.name}」已建立為教練。`);
    await refreshOps();
  }

  async function updateAndRefresh(coach: Coach, v: CoachFormValues) {
    if (v.name.trim() !== coach.name) {
      try {
        await updateMember(coach.userId, { name: v.name.trim() });
      } catch (e) {
        toasts.notify('error', '儲存失敗', memberErrorMessage(e));
        return;
      }
    }
    try {
      await updateCoach(coach.id, coachBody(v));
    } catch (e) {
      toasts.notify('error', '儲存失敗', coachErrorMessage(e));
      return;
    }
    toasts.notify('success', '已儲存', `${v.name} 教練資料已更新。`);
    await refreshOps();
  }

  function handleSave(v: CoachFormValues, isNew: boolean, coach?: Coach): Promise<void> {
    return isNew ? createAndRefresh(v) : coach ? updateAndRefresh(coach, v) : Promise.resolve();
  }

  function newCoach() {
    if (onNew) onNew();
    else overlay.sheet('coachForm', { c: null, onSave: (v: CoachFormValues) => handleSave(v, true) });
  }
  function editCoach(c: Coach) {
    overlay.sheet('coachForm', { c, onSave: (v: CoachFormValues) => handleSave(v, false, c) });
  }
</script>

<PushScreen>
  <ScreenHeader {onBack} title="教練管理" sub={$coachesStore.length + ' 位專任教練'}>
    <HeaderIcon slot="right" icon="user-plus" label="新增教練" onClick={newCoach} />
  </ScreenHeader>
  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
      {#each $coachesStore as c (c.id)}
        <div
          style="background:#fff; border:1px solid var(--df-border); border-radius:16px;
            box-shadow:var(--df-shadow-card); overflow:hidden;"
        >
          <div style="display:flex; gap:13px; padding:15px 16px 13px;">
            <Avatar name={c.initial} size="md" color={c.color} />
            <div style="flex:1; min-width:0;">
              <div style="font-size:15.5px; font-weight:700; color:var(--df-ink);">
                {c.name} <span style="font-size:12px; font-weight:500; color:var(--df-text-muted);">教練</span>
              </div>
              <div style="font-size:12px; color:var(--df-primary); margin-top:2px; line-height:1.4;">{c.title}</div>
              <div style="display:flex; align-items:center; gap:4px; margin-top:4px; font-size:11px; color:var(--df-text-light);">
                <span
                  style="width:7px; height:7px; border-radius:999px; flex:none;
                    background:{c.isActive ? 'var(--df-success)' : 'var(--df-text-muted)'};"
                ></span>{c.isActive ? '公開顯示中' : '未公開顯示'}
              </div>
              <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
                {#each c.tags as t (t)}<Tag>{t}</Tag>{/each}
              </div>
            </div>
            <button
              on:click={() => editCoach(c)}
              aria-label="編輯教練"
              class="df-tapscale"
              style="width:34px; height:34px; border-radius:10px; border:1px solid var(--df-border);
                background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;
                flex:none; align-self:flex-start;"
            >
              <Icon name="pencil-line" size={16} color="var(--df-text-light)" />
            </button>
          </div>
          <div style="display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--df-border);">
            <button
              on:click={() => toasts.notify('info', '課表', '顯示 ' + c.name + ' 教練的授課時段。')}
              class="df-tapscale"
              style="flex:1; height:38px; border-radius:10px; border:1.5px solid var(--df-border);
                background:#fff; color:var(--df-text-dark); font-size:13px; font-weight:600; cursor:pointer;
                display:flex; align-items:center; justify-content:center; gap:6px;"
            >
              <Icon name="calendar-days" size={15} color="var(--df-primary)" />課表
            </button>
          </div>
        </div>
      {/each}
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
