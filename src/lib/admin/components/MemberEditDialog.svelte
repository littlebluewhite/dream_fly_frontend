<script lang="ts">
  /* 編輯學員 — edit form inside the shared EditModal (Task 16). 契約 §3.2 PATCH
   * /users/{id}：name/phone/is_active 皆選填，但這裡一律全部送出（同 CoachEditDialog
   * 的全量 resend 慣例）——is_active 一定有具體布林值，name/phone 也都是既有帳號預先
   * 帶入的值，實務上不會真的「全省略」；真正會發生的「PATCH body 為空」情境是呼叫端
   * 直接呼叫 seam（updateMember）本身，不是這個表單，見 admin/api.test.ts。空白 phone
   * 仍省略（undefined，維持原值語意），避免把「本來就沒填」的欄位誤送成空字串觸發
   * 8-20 字驗證。不可改 email/roles/password——本表單完全不出現這三個欄位（契約明文
   * v1 範圍外，不是遺漏）。
   *
   * Local editable copy pattern mirrors CoachEditDialog: single reactive block
   * keyed on `member !== lastMember || (open && !wasOpen)`, so it resets both on
   * a newly-assigned member AND on the close→reopen-same-member transition (見
   * CoachEditDialog 的完整 regression 說明 — 兩段式 wasOpen 或 `member &&` 短路寫法都
   * 會漏掉其中一種轉場)。 */
  import { Input, Switch } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import type { MemberAccount } from '$lib/admin/data';
  import type { UpdateMemberBody } from '$lib/admin/api';

  export let member: MemberAccount | null = null;
  export let open = false;
  export let onClose: () => void = () => {};
  export let onSave: (id: string, body: UpdateMemberBody) => void = () => {};

  let name = member?.name ?? '';
  let phone = member?.phone ?? '';
  let isActive = member ? member.status === 'active' : true;
  let lastMember: MemberAccount | null = member;
  let wasOpen = open;
  $: if (member !== lastMember || (open && !wasOpen)) {
    wasOpen = open;
    lastMember = member;
    name = member?.name ?? '';
    phone = member?.phone ?? '';
    isActive = member ? member.status === 'active' : true;
  }

  function save() {
    if (!member) return;
    const body: UpdateMemberBody = { name: name.trim(), is_active: isActive };
    const trimmedPhone = phone.trim();
    if (trimmedPhone) body.phone = trimmedPhone;
    return onSave(member.id, body);
  }
</script>

{#if member}
  <EditModal
    {open}
    title="編輯學員"
    sub={member.name + ' 學員'}
    icon="user"
    primaryLabel="儲存"
    {onClose}
    onSave={save}
  >
    <div style="display:flex;flex-direction:column;gap:14px">
      <Input label="姓名" bind:value={name} />
      <Input label="聯絡電話" bind:value={phone} />
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px">
        <span style="font-size:14px;font-weight:600;color:var(--df-text-dark)">帳號啟用</span>
        <Switch bind:checked={isActive} />
      </div>
    </div>
  </EditModal>
{/if}
