<script lang="ts">
  /* 教練管理 push screen。admin2.jsx CoachesScreen (68)。
   * $coaches 卡片（Avatar + 公開顯示狀態 + 標籤 + 課表）；
   * 新增 → onNew()（未提供時 overlay.sheet('coachForm',{c:null,onCreate})）；
   * 編輯鉛筆 → overlay.sheet('coachForm',{c,onUpdate})。
   *
   * Task F5：新增/編輯改接真 POST/PATCH /coaches + POST/PATCH /users——同桌面
   * routes/admin/coaches/+page.svelte 的兩步流程（先建 user 帳號、再綁 coach）與
   * 錯誤訊息設計。寫入成功後整包重抓 members/classes/coaches/orders 四個 store
   * （同 routes/mobile-admin/admin/members/+page.svelte 慣例）。
   *
   * C3：兩步序列本身（API 呼叫順序、outcome 判別聯集）已收進
   * $lib/admin/components/coach-save.ts 的 saveNewCoach/saveCoachEdit——同桌面
   * admin/coaches/+page.svelte 復用的同一套無狀態純函式（K4）。R12 起再由 store 的
   * addCoach/saveCoach 動詞包起來(成功 outcome → 動詞內 await refreshOps())，本頁
   * 只剩「呼叫動詞 → 依 outcome.kind 翻譯 toast」，toast 在重抓完成後才出現。
   *
   * R17：表單送出時驗證、handler 回 Promise<boolean>（true＝已存才關 sheet，false＝sheet 留著）。
   * 新增的第二步（教練綁定）失敗時，outcome.coachBindFailed 攜帶的 pendingUserId 連同第一次的
   * email/name 存在本頁的 pending（每次開新增 sheet 重置）；handler 回 'bind-failed'，CoachForm
   * 鎖住 email/姓名/密碼，同一個 sheet 內重試只補打 createCoach、沿用同一個 user id，不重建帳號
   * （避免 email 409），toast 指名實際建立的帳號——同桌面 coaches 頁的哨兵。同桌面
   * 一樣不做自動回滾（後端沒有複合建立端點，也沒有刪除使用者的端點可呼叫）。 */
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Tag from '$lib/components/ui/Tag.svelte';
  import { ErrorState, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { overlay, coaches as coachesStore, toasts, opsPageEntry, addCoach, saveCoach } from '$lib/mobile-admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import type { Coach } from '$lib/domain/coaches';
  import type { CoachFormValues } from '$lib/admin/data';
  import { apiErrorMessage, apiErrorText } from '$lib/api/error-text';

  export let onBack: () => void;
  export let onNew: (() => void) | undefined = undefined;

  // R11(C3,LoadGate 三態第五次複製,先例 VenuesScreen):R10 加的 onMount 自保呼叫
  // (hydrateOps().catch(()=>{}))只解決「未曾水合」的個案本身——fetch 失敗時仍永久
  // 停留在 domain seed、沒有 loading 骨架、也沒有重試入口,是 ADR 0016 明文記載的
  // 風險窗。改建 createLoadGate 三態(loading/error/ready)。R14(F1)起佈線改 spread
  // ops 閘門的頁面進場包 opsPageEntry(同 routes/mobile-admin/admin/members/+page.svelte)
  // ——閘門的 apply 寫 $coachesStore,卸載後才落地的回應不寫。ops 閘門已水合
  // 時 load-gate 的 guard 命中,同步 ready、不重打 getOpsCollections。ScreenHeader(含
  // 「新增教練」按鈕)留在閘外,三態只包卡片列表區(同 VenuesScreen 裁決)。
  const gate = createLoadGate({ ...opsPageEntry });

  // /users 端點(createMember/updateMember)的錯誤訊息已是後端給的 繁中 使用者可讀
  // 文字 → apiErrorMessage 直接透傳，同桌面 coaches 頁慣例。
  // /coaches 端點的 404/409 是後端英文文字(coaches/service.rs)，跟 /users 端點的
  // 繁中 訊息來源不同，故用狀態碼查表對應繁中文案，不透傳 e.message（apiErrorText
  // + 本頁自持文案表，同桌面 coaches 頁慣例）。
  const COACH_ERROR_TEXT: Record<number, string> = {
    404: '找不到對應的使用者帳號。',
    409: '這個帳號已經是教練身分了。',
    422: '輸入資料不符規則，請確認後再試。'
  };

  // 非 null＝本次新增 sheet 內第一步(createMember)已成功、第二步(createCoach)失敗待重試。
  // 連同第一次送出的 email/name 一起留著：toast 要指名「實際建立的帳號」，不是重試時
  // 表單帶的值（重試不重建帳號，表單的 email/name 會被忽略；CoachForm 也已鎖住這些欄位）。
  let pending: { userId: string; email: string; name: string } | null = null;

  async function createAndRefresh(v: CoachFormValues): Promise<'saved' | 'kept' | 'bind-failed'> {
    const account = pending ?? { userId: null, email: v.email, name: v.name };
    const outcome = await addCoach(v, pending?.userId ?? null);
    switch (outcome.kind) {
      case 'userCreateFailed':
        toasts.notify('error', '新增失敗', apiErrorMessage(outcome.error));
        return 'kept';
      case 'coachBindFailed':
        pending = { userId: outcome.pendingUserId, email: account.email, name: account.name };
        toasts.notify(
          'error',
          '教練綁定失敗',
          `帳號「${account.email}」已建立，但綁定教練身分失敗（${apiErrorText(outcome.error, COACH_ERROR_TEXT)}）。請直接再按一次「建立教練」重試綁定。`
        );
        return 'bind-failed';
      case 'created':
        pending = null;
        toasts.notify('success', '已新增教練', `「${account.name}」已建立為教練。`);
        return 'saved';
    }
  }

  async function updateAndRefresh(coach: Coach, v: CoachFormValues): Promise<boolean> {
    const outcome = await saveCoach(v, coach);
    switch (outcome.kind) {
      case 'nameUpdateFailed':
        toasts.notify('error', '儲存失敗', apiErrorMessage(outcome.error));
        return false;
      case 'coachUpdateFailed':
        toasts.notify('error', '儲存失敗', apiErrorText(outcome.error, COACH_ERROR_TEXT));
        return false;
      case 'saved':
        toasts.notify('success', '已儲存', `${v.name} 教練資料已更新。`);
        return true;
    }
  }

  function newCoach() {
    if (onNew) {
      onNew();
      return;
    }
    pending = null;
    overlay.sheet('coachForm', { c: null, onCreate: createAndRefresh });
  }
  function editCoach(c: Coach) {
    overlay.sheet('coachForm', { c, onUpdate: (v: CoachFormValues) => updateAndRefresh(c, v) });
  }
</script>

<PushScreen>
  <ScreenHeader {onBack} title="教練管理" sub={($gate === 'ready' ? $coachesStore.length + ' 位' : '') + '專任教練'}>
    <HeaderIcon slot="right" icon="user-plus" label="新增教練" onClick={newCoach} />
  </ScreenHeader>
  <LoadGate {gate}>
    <div class="df-scroll" data-testid="coaches-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:12px;" slot="loading">
      {#each [0, 1, 2] as i (i)}
        <SkelCard padding={16}><Skeleton w="100%" h={120} r={12} /></SkelCard>
      {/each}
    </div>

    <div class="df-scroll" style="padding:16px;" slot="error">
      <ErrorState onRetry={gate.refresh} />
    </div>

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
  </LoadGate>
</PushScreen>
