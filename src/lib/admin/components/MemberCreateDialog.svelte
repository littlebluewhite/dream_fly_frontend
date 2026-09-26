<script lang="ts">
  /* 新增學員 — create-only form inside the shared EditModal (Task 16). 契約 §3.2
   * POST /users。R13 Task 4：驗證與 body 組裝收進 member-request.ts 的
   * checkNewMember()（三個學員表單共用）——不過就把錯誤顯示在各欄位的 inline hint、
   * 不呼叫 onSave；過了就把 CreateMemberBody 交給 onSave。只有這一種模式（新增），沒有 isNew 分支——
   * 編輯是完全不同的欄位組合（name/phone/is_active，見 MemberEditDialog，且契約明文
   * 不可在編輯端寫入 birth_date），兩者不共用同一個表單。本元件不打 API、不丟成功
   * toast——成功/失敗一律由呼叫端（members/+page.svelte）依 createMember() 的結果處理。 */
  import { Input } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import type { CreateMemberBody } from '$lib/admin/api';
  import { checkNewMember, type MemberErrors } from './member-request';

  export let open = false;
  export let onClose: () => void = () => {};
  export let onSave: (body: CreateMemberBody) => void | Promise<void> = () => {};

  let email = '';
  let name = '';
  let phone = '';
  let password = '';
  let birthDate = '';
  let errors: MemberErrors = {};

  // Reset the form whenever the dialog transitions to open. The wasOpen write
  // must live in the SAME reactive statement as the read (see CouponCreateDialog
  // for why splitting it into a trailing `$:` statement is unreliable).
  let lastOpen = false;
  $: {
    if (open && !lastOpen) {
      email = '';
      name = '';
      phone = '';
      password = '';
      birthDate = '';
      errors = {};
    }
    lastOpen = open;
  }

  function save() {
    const r = checkNewMember({ email, name, phone, password, birthDate });
    if (r.kind === 'invalid') {
      errors = r.errors;
      return;
    }
    errors = {};
    return onSave(r.body);
  }
</script>

<EditModal
  {open}
  title="新增學員"
  sub="建立學員帳號"
  icon="user-plus"
  primaryLabel="建立學員"
  {onClose}
  onSave={save}
>
  <div style="display:flex;flex-direction:column;gap:14px">
    <Input label="Email" type="email" bind:value={email} placeholder="member@example.com" error={errors.email ?? ''} />
    <Input label="姓名" bind:value={name} error={errors.name ?? ''} />
    <Input label="聯絡電話（選填）" bind:value={phone} error={errors.phone ?? ''} />
    <Input label="生日（選填）" type="date" bind:value={birthDate} />
    <Input
      label="初始密碼"
      type="password"
      bind:value={password}
      placeholder="至少 8 碼"
      error={errors.password ?? ''}
    />
  </div>
</EditModal>
