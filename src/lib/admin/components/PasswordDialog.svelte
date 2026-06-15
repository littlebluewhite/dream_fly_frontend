<script lang="ts">
  /* 變更密碼 — change-password form inside the shared EditModal. Faithful port of
   * admin.jsx SettingsView's password EditModal: three password fields (目前密碼 /
   * 新密碼 / 確認新密碼). On 更新密碼 it validates (new non-empty and equal to confirm)
   * via validatePassword — on failure it shows an inline error and does NOT call
   * onSave; on success it clears the form, calls onSave() and fires a success
   * toast. Open/close (取消 / overlay / Esc) is handled by EditModal → onClose. */
  import { Input } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import { toasts } from '$lib/admin/stores';
  import { validatePassword } from './password-validate';

  export let open = false;
  export let onClose: () => void = () => {};
  export let onSave: () => void = () => {};

  let current = '';
  let next = '';
  let confirm = '';
  let error = '';

  // Reset the form + error whenever the dialog transitions to open.
  let wasOpen = false;
  $: if (open && !wasOpen) {
    current = '';
    next = '';
    confirm = '';
    error = '';
  }
  $: wasOpen = open;

  function save() {
    const r = validatePassword({ current, next, confirm });
    if (!r.ok) {
      error = r.error ?? '密碼驗證失敗';
      return;
    }
    error = '';
    onSave();
    toasts.notify('success', '密碼已更新', '請於下次登入使用新密碼。');
  }
</script>

<EditModal
  {open}
  title="變更密碼"
  icon="key-round"
  primaryLabel="更新密碼"
  {onClose}
  onSave={save}
>
  <div style="display:flex;flex-direction:column;gap:14px">
    <Input label="目前密碼" type="password" placeholder="••••••••" bind:value={current} />
    <Input label="新密碼" type="password" placeholder="至少 8 碼，含英數" bind:value={next} />
    <Input
      label="確認新密碼"
      type="password"
      placeholder="再次輸入新密碼"
      bind:value={confirm}
      error={error}
    />
  </div>
</EditModal>
