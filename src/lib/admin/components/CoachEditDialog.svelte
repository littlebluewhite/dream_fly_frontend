<script lang="ts">
  /* 教練檔案編輯 / 新增 — edit form inside the shared EditModal (Task F5).
   *
   * 欄位收斂到後端真實形狀（POST/PATCH /coaches + PATCH /users/{user_id}，契約
   * §3.2/§3.4）——移除 years/awards/classes/status(獨立線上/忙碌/離線版)/phone/color
   * 等無後端來源欄位：classes/students 統計已有真實來源(admin/api.ts getReports() 的
   * AdminReportCoachRow，屬於唯讀彙總，不是這張表單該手填的數字)；color 原本只是
   * 頭像底色 swatch 選色器，無後端欄位可存，移除後同 MemberEditDialog/
   * MemberCreateDialog 一樣不再顯示大頭貼預覽。
   *
   * 保留：name(編輯時對應 PATCH /users/{user_id}；新增時進 POST /users)、
   * title(必填，coaches.title 為 NOT NULL)、tags(=specialties)、isActive(取代原本
   * 「目前狀態」線上/忙碌/離線三態 Select——那組狀態從未有後端來源，一律固定顯示
   * 離線。isActive 對應 coaches.is_active，是唯一真實存在的狀態欄位，語意是「是否
   * 於公開教練頁 /coaches 與課程頁的教練列表顯示」，故用誠實的公開顯示開關取代，
   * 而非偽裝成同一種「忙碌中」的展示裝飾——見下方 helper 文案)。
   *
   * 新增模式(isNew)多收 email/密碼——後端沒有「建 user + 綁 coach」的複合端點，
   * 兩步分別是 POST /users、POST /coaches；本元件不知道兩步怎麼打，只負責收欄位、
   * 組出 CoachFormValues 交給 onSave，實際的兩步 API 呼叫、失敗訊息、成功後刷新皆由
   * 呼叫端（routes/admin/coaches/+page.svelte）決定——同 Task F1/F4 的「dialog 不打
   * API、不丟 toast」慣例。 */
  import { Input, Switch } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import type { Coach, CoachFormValues } from '$lib/admin/data';

  export let coach: Coach | null = null;
  export let open = false;
  /** New-coach mode 多收 email/密碼(POST /users 用)，其餘欄位同編輯模式。 */
  export let isNew = false;
  export let onClose: () => void = () => {};
  export let onSave: (values: CoachFormValues) => void = () => {};
  /** 非 null＝新增流程第一步(createMember)已成功、第二步(createCoach)失敗待重試
   *  （見呼叫端 coaches/+page.svelte 的 pendingUserId 註解）。此時鎖住 email/姓名——
   *  重試只會重打 createCoach，不會回頭重打 createMember，這兩欄位這時候編輯了也是
   *  靜默被忽略，鎖住比讓使用者誤以為改了會生效更誠實。 */
  export let pendingUserId: string | null = null;

  // Local editable fields, reset whenever the coach prop changes — INCLUDING
  // coach → null on close — or when the dialog transitions to open (single-stage
  // pattern，同 MemberEditDialog / 原版 CoachEditDialog 的 `lastCoach`/`wasOpen`
  // guard；沿用同一個寫法是因為兩段式 `wasOpen` 或 `coach &&` 短路寫法都曾在這個
  // guard 上出過 regression——見下方三個對應測試）。coach 為 null 時（新增模式或
  // 對話框關閉）欄位一律回到空白/預設值。
  let name = coach?.name ?? '';
  let title = coach?.title ?? '';
  let tagsText = coach ? coach.tags.join('、') : '';
  let isActive = coach ? coach.isActive : true;
  let email = '';
  let password = '';
  let titleError = '';
  let passwordError = '';

  let lastCoach: Coach | null = coach;
  let wasOpen = open;
  $: if (coach !== lastCoach || (open && !wasOpen)) {
    wasOpen = open;
    lastCoach = coach;
    name = coach?.name ?? '';
    title = coach?.title ?? '';
    tagsText = coach ? coach.tags.join('、') : '';
    isActive = coach ? coach.isActive : true;
    email = '';
    password = '';
    titleError = '';
    passwordError = '';
  }

  function save() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      titleError = '請輸入職稱';
      return;
    }
    titleError = '';
    if (isNew && password.length < 8) {
      passwordError = '密碼至少需要 8 碼';
      return;
    }
    passwordError = '';
    const tags = tagsText
      .split(/[、,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    return onSave({ email: email.trim(), password, name: name.trim(), title: trimmedTitle, tags, isActive });
  }
</script>

<EditModal
  {open}
  title={isNew ? '新增教練' : '編輯教練'}
  sub={isNew ? '建立教練帳號與檔案' : (coach?.name ?? '') + ' 教練'}
  icon="user-check"
  primaryLabel={isNew ? '建立教練' : '儲存'}
  {onClose}
  onSave={save}
>
  <div style="display:flex;flex-direction:column;gap:14px">
    {#if isNew}
      <Input
        label="Email"
        type="email"
        bind:value={email}
        placeholder="coach@example.com"
        disabled={pendingUserId !== null}
      />
    {/if}
    <Input label="教練姓名" bind:value={name} disabled={pendingUserId !== null} />
    <Input label="職稱 / 專業" required error={titleError} bind:value={title} />
    <Input label="專長標籤（以、分隔）" bind:value={tagsText} />
    {#if isNew}
      <Input
        label="初始密碼"
        type="password"
        bind:value={password}
        placeholder="至少 8 碼"
        error={passwordError}
      />
    {/if}
    <div style="display:flex;flex-direction:column;gap:4px;padding-top:4px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:600;color:var(--df-text-dark)">公開顯示</span>
        <Switch bind:checked={isActive} />
      </div>
      <span style="font-size:var(--df-text-xs);color:var(--df-text-light)">
        關閉後，教練不會出現在公開的教練介紹頁與課程頁面的教練列表中。
      </span>
    </div>
  </div>
</EditModal>
