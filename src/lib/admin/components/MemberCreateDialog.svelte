<script lang="ts">
  /* 新增學員 — create-only form inside the shared EditModal (Task 16). 契約 §3.2
   * POST /users：email/name/password 必填，phone/birth_date 選填；密碼 8-128 字。
   * 前端在送出前同步擋 < 8 碼（不打一定會 422 的請求），錯誤顯示在密碼欄位的 inline
   * hint（同 PasswordDialog 的 error 用法）。空白 phone 省略（undefined），對應
   * CreateUserRequest「不填 = 無電話」；birth_date（Round 4 Task P4-F4）同一慣例——
   * date input 留白就省略欄位，不送空字串。不做 email 格式驗證——同 CouponCreateDialog
   * 對其餘欄位的作法，交由後端 422 判斷。只有這一種模式（新增），沒有 isNew 分支——
   * 編輯是完全不同的欄位組合（name/phone/is_active，見 MemberEditDialog，且契約明文
   * 不可在編輯端寫入 birth_date），兩者不共用同一個表單。本元件不打 API、不丟成功
   * toast——成功/失敗一律由呼叫端（members/+page.svelte）依 createMember() 的結果處理。 */
  import { Input } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import type { CreateMemberBody } from '$lib/admin/api';

  export let open = false;
  export let onClose: () => void = () => {};
  export let onSave: (body: CreateMemberBody) => void = () => {};

  let email = '';
  let name = '';
  let phone = '';
  let password = '';
  let passwordError = '';
  let birthDate = '';

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
      passwordError = '';
      birthDate = '';
    }
    lastOpen = open;
  }

  function save() {
    if (password.length < 8) {
      passwordError = '密碼至少需要 8 碼';
      return;
    }
    passwordError = '';
    const body: CreateMemberBody = {
      email: email.trim(),
      name: name.trim(),
      password
    };
    const trimmedPhone = phone.trim();
    if (trimmedPhone) body.phone = trimmedPhone;
    if (birthDate) body.birth_date = birthDate;
    onSave(body);
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
    <Input label="Email" type="email" bind:value={email} placeholder="member@example.com" />
    <Input label="姓名" bind:value={name} />
    <Input label="聯絡電話（選填）" bind:value={phone} />
    <Input label="生日（選填）" type="date" bind:value={birthDate} />
    <Input
      label="初始密碼"
      type="password"
      bind:value={password}
      placeholder="至少 8 碼"
      error={passwordError}
    />
  </div>
</EditModal>
