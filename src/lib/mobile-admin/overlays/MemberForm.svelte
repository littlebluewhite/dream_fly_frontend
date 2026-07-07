<script lang="ts">
  /* 學員 新增 / 編輯 sheet。forms.jsx MemberForm (31) 的行動版接線改版。
   * 透過 OverlayHost 掛載：每次 overlay.sheet('memberForm',{m}) 都是新實例。
   *
   * Task 20：學員新增/編輯改接真 POST /users、PATCH /users/{id}（admin/api.ts
   * createMember/updateMember，Task 16）——契約 §3.2 兩個端點接受的欄位完全不同
   * （新增：email/name/phone?/password；編輯：name/phone/is_active，且編輯不可
   * 改 email/roles/password），故本表單依 isNew 顯示不同欄位組合，同桌面
   * MemberCreateDialog/MemberEditDialog 兩支各自負責一種模式的分工——但保留單一
   * 元件、內部切換（不拆兩個檔案），對齊行動版既有的「一個 overlay 元件」慣例。
   * 儲存 → onSave(body, isNew)；沒有 onSave 時單純不送出，不再有本地 store 假寫入
   * fallback（同 ClassForm 的決定：沒有後端呼叫者就不假裝成功）。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import type { MemberRow } from '$lib/mobile-admin/data';
  import type { CreateMemberBody, UpdateMemberBody } from '$lib/mobile-admin/api';

  export let onClose: () => void;
  export let m: MemberRow | null = null;
  export let onSave: ((body: CreateMemberBody | UpdateMemberBody, isNew: boolean) => void) | undefined = undefined;

  const isNew = !m;

  // 新增欄位
  let email = '';
  let name = m?.name ?? '';
  let phone = m?.phone ?? '';
  let password = '';
  let passwordError = '';

  // 編輯欄位（is_active 由既有 status 推導：只有 'active' 視為啟用中）
  let isActive = m ? m.status === 'active' : true;

  $: initial = name.trim().charAt(0) || '學';
  $: valid = isNew
    ? !!email.trim() && !!name.trim() && password.length >= 8
    : !!name.trim();

  function save() {
    if (isNew) {
      if (password.length < 8) {
        passwordError = '密碼至少需要 8 碼';
        return;
      }
      passwordError = '';
      const body: CreateMemberBody = { email: email.trim(), name: name.trim(), password };
      const trimmedPhone = phone.trim();
      if (trimmedPhone) body.phone = trimmedPhone;
      onSave?.(body, true);
    } else {
      if (!m) return;
      const body: UpdateMemberBody = { name: name.trim(), is_active: isActive };
      const trimmedPhone = phone.trim();
      if (trimmedPhone) body.phone = trimmedPhone;
      onSave?.(body, false);
    }
    onClose();
  }
</script>

<Sheet
  open
  {onClose}
  maxHeight="93%"
  title={isNew ? '新增學員' : '編輯學員資料'}
  sub={isNew ? '建立新的學員帳號' : '會員編號 ' + (m?.id ?? '')}
>
  <div style="display:flex; flex-direction:column; gap:16px;">
    <div style="display:flex; align-items:center; gap:13px;">
      <Avatar name={initial} size="lg" color="var(--df-primary)" />
      <div style="font-size:12.5px; color:var(--df-text-light); line-height:1.5;">
        頭像以姓氏首字顯示<br />{isNew ? '建立後可隨時編輯' : '入會 ' + (m?.joined ?? '') + ' · ' + (m?.points ?? 0) + ' 點'}
      </div>
    </div>

    {#if isNew}
      <Input label="Email" type="email" bind:value={email} placeholder="member@example.com" />
    {/if}
    <Input label="學員姓名" bind:value={name} />
    <Input label="聯絡電話（選填）" bind:value={phone} />

    {#if isNew}
      <Input
        label="初始密碼"
        type="password"
        bind:value={password}
        placeholder="至少 8 碼"
        error={passwordError}
      />
    {:else}
      <div style="display:flex; justify-content:space-between; align-items:center; padding-top:4px;">
        <span style="font-size:14px; font-weight:600; color:var(--df-text-dark);">帳號啟用</span>
        <Switch bind:checked={isActive} />
      </div>
    {/if}
  </div>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={onClose}>取消</Button>
    <Button variant="primary" disabled={!valid} style="flex:1;" on:click={save}>
      <Icon name="check" size={16} style="margin-right:6px;" />{isNew ? '建立學員' : '儲存資料'}
    </Button>
  </svelte:fragment>
</Sheet>
