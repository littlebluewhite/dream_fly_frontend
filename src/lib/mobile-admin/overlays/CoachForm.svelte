<script lang="ts">
  /* 教練 新增 / 編輯 sheet。forms.jsx CoachForm (121) 的行動版接線改版。
   * 透過 OverlayHost 掛載：每次 overlay.sheet('coachForm',{c}) 都是新實例。
   *
   * Task F5：教練新增/編輯改接真 POST /coaches、PATCH /coaches/{id}（桌面
   * admin/api.ts 新增的 createCoach/updateCoach）——同桌面 CoachEditDialog 的兩步
   * 流程：新增＝先 POST /users（createMember，Task 16 既有）拿 user_id 再 POST
   * /coaches；編輯＝姓名有變才 PATCH /users/{user_id}，教練欄位一律 PATCH
   * /coaches/{id}。契約 §3.2/§3.4 兩組端點接受的欄位完全不同，故本表單依 isNew
   * 顯示不同欄位組合，同 MemberForm 的分工慣例——保留單一元件、內部切換（不拆兩個
   * 檔案）。儲存 → onSave(values, isNew)；沒有 onSave 時單純不送出，不再有本地
   * saveCoach() 假寫入 fallback（同 MemberForm/ClassForm 的決定：沒有後端呼叫者
   * 就不假裝成功）——兩步 API 呼叫、失敗訊息、成功後刷新皆由呼叫端
   * （CoachesScreen.svelte）決定。
   *
   * 欄位收斂同桌面 CoachEditDialog（Task F5）：移除 years/awards/classes/status(獨立
   * 線上/忙碌/離線版)/phone/color 等無後端來源欄位；isActive(coaches.is_active)
   * 取代 status 的開關語意——這個旗標實際控制公開教練頁/課程頁看不看得到這位教練，
   * 故用誠實的「公開顯示」開關取代，不是假的線上/忙碌裝飾（完整理由見桌面
   * CoachEditDialog 註解）。
   *
   * R13 Task 4：驗證與標籤拆分改用桌面同一份 coach-save.ts(checkNewCoach/
   * checkCoachEdit)，主按鈕 disabled 依驗證結果。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import type { Coach } from '$lib/domain/coaches';
  import type { CoachFormValues } from '$lib/mobile-admin/api';
  import { initialOf } from '$lib/api/wire';
  import { checkNewCoach, checkCoachEdit } from '$lib/admin/components/coach-save';

  export let onClose: () => void;
  export let c: Coach | null = null;
  export let onSave: ((values: CoachFormValues, isNew: boolean) => void | Promise<unknown>) | undefined = undefined;

  const isNew = !c;

  let email = '';
  let name = c?.name ?? '';
  let password = '';
  let title = c?.title ?? '';
  let tagsText = (c?.tags ?? []).join('、');
  let isActive = c ? c.isActive : true;

  $: initial = initialOf(name, '教');
  $: check = isNew
    ? checkNewCoach({ email, password, name, title, tagsText, isActive })
    : checkCoachEdit({ name, title, tagsText, isActive });

  function save() {
    if (check.kind !== 'valid') return;
    onSave?.(check.values, isNew);
    onClose();
  }
</script>

<Sheet
  open
  {onClose}
  maxHeight="93%"
  title={isNew ? '新增教練' : '編輯教練'}
  sub={isNew ? '建立教練帳號與檔案' : (c?.name ?? '') + ' 教練'}
>
  <div style="display:flex; flex-direction:column; gap:16px;">
    <div style="display:flex; align-items:center; gap:13px;">
      <Avatar name={initial} size="lg" color="var(--df-primary)" />
      <div style="font-size:12.5px; color:var(--df-text-light); line-height:1.5;">頭像以姓氏首字顯示</div>
    </div>

    {#if isNew}
      <Input label="Email" type="email" bind:value={email} placeholder="coach@example.com" />
    {/if}
    <Input label="教練姓名" bind:value={name} />
    <Input label="職稱 / 專業" required bind:value={title} />
    <Input label="專長標籤（以、分隔）" bind:value={tagsText} />
    {#if isNew}
      <Input
        label="初始密碼"
        type="password"
        bind:value={password}
        placeholder="至少 8 碼"
      />
    {/if}
    <div style="display:flex; flex-direction:column; gap:4px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:14px; font-weight:600; color:var(--df-text-dark);">公開顯示</span>
        <Switch bind:checked={isActive} />
      </div>
      <span style="font-size:12px; color:var(--df-text-light);">
        關閉後，教練不會出現在公開的教練介紹頁與課程頁面中。
      </span>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={onClose}>取消</Button>
    <Button variant="primary" disabled={check.kind !== 'valid'} style="flex:1;" on:click={save}>
      <Icon name="check" size={16} style="margin-right:6px;" />{isNew ? '建立教練' : '儲存'}
    </Button>
  </svelte:fragment>
</Sheet>
