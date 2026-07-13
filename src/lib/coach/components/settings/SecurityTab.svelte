<script lang="ts">
  /* 帳號安全 tab — 變更密碼 Dialog + 雙重驗證 Switch + 登入裝置 list
   * coach 改為 required prop(元件樹檢查,Task 4):不再自行 import COACH。 */
  import type { Coach } from '$lib/coach/data';
  import { toasts } from '$lib/coach/stores';
  import Card from '$lib/components/ui/Card.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import CoachSettingRow from '$lib/coach/components/CoachSettingRow.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let coach: Coach;

  // Password dialog
  let pwDialogOpen = false;
  let oldPw = '';
  let newPw = '';
  let confirmPw = '';
  let pwError = '';

  function openPwDialog() {
    oldPw = '';
    newPw = '';
    confirmPw = '';
    pwError = '';
    pwDialogOpen = true;
  }

  function closePwDialog() {
    pwDialogOpen = false;
  }

  function submitPw() {
    if (!oldPw || !newPw || !confirmPw) {
      pwError = '請填寫所有欄位';
      return;
    }
    if (newPw !== confirmPw) {
      pwError = '新密碼與確認密碼不符';
      return;
    }
    if (newPw.length < 8) {
      pwError = '新密碼至少需 8 個字元';
      return;
    }
    pwDialogOpen = false;
    toasts.notify('success', '密碼已成功變更', '下次登入請使用新密碼');
  }

  // 2FA
  let twoFAEnabled = false;
  function onTwoFA(e: CustomEvent<boolean>) {
    toasts.notify('info', e.detail ? '已開啟雙重驗證' : '已關閉雙重驗證');
  }

  // Login devices (mock)
  const DEVICES: { id: string; name: string; icon: IconName; location: string; time: string; current: boolean }[] = [
    { id: 'd1', name: 'MacBook Pro 14"', icon: 'monitor', location: '台北市', time: '目前使用中', current: true },
    { id: 'd2', name: 'iPhone 15 Pro',   icon: 'smartphone', location: '台北市', time: '昨天 20:14', current: false },
    { id: 'd3', name: 'iPad Air',         icon: 'tablet',    location: '台北市', time: '2 天前',     current: false }
  ];

  function logout(device: typeof DEVICES[number]) {
    toasts.notify('info', `已登出裝置`, device.name);
  }
</script>

<div style="display:flex;flex-direction:column;gap:24px;padding-top:20px">
  <!-- Password card -->
  <Card padding={24}>
    <div
      style="font-size:var(--df-text-base);font-weight:var(--df-weight-bold);color:var(--df-text-dark);font-family:var(--df-font-heading);margin-bottom:6px"
    >
      登入安全
    </div>
    <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-bottom:16px">
      保護您的帳號安全
    </div>

    <CoachSettingRow
      icon="lock"
      title="登入密碼"
      desc="建議每三個月更換一次密碼"
    >
      <Button variant="secondary" size="sm" on:click={openPwDialog}>
        <span style="display:inline-flex;align-items:center;gap:6px">
          <Icon name="key-round" size={14} color="var(--df-primary)" />變更密碼
        </span>
      </Button>
    </CoachSettingRow>

    <CoachSettingRow
      icon="shield-check"
      title="雙重驗證（2FA）"
      desc="登入時額外驗證手機驗證碼"
    >
      <Switch bind:checked={twoFAEnabled} on:change={onTwoFA} />
    </CoachSettingRow>
  </Card>

  <!-- Login devices -->
  <Card padding={24}>
    <div
      style="font-size:var(--df-text-base);font-weight:var(--df-weight-bold);color:var(--df-text-dark);font-family:var(--df-font-heading);margin-bottom:6px"
    >
      已登入裝置
    </div>
    <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-bottom:16px">
      上次登入：{coach.lastLogin}
    </div>

    <div style="display:flex;flex-direction:column;gap:12px">
      {#each DEVICES as device (device.id)}
        <div
          style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:var(--df-radius-md);border:1px solid {device.current ? 'var(--df-primary)' : 'var(--df-border)'};background:{device.current ? 'var(--df-primary-bg)' : '#fff'}"
        >
          <div
            style="width:40px;height:40px;border-radius:10px;background:{device.current ? 'var(--df-primary-bg)' : 'var(--df-bg-light)'};display:flex;align-items:center;justify-content:center;flex:none"
          >
            <Icon name={device.icon} size={20} color={device.current ? 'var(--df-primary)' : 'var(--df-text-light)'} />
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span
                style="font-size:var(--df-text-base);font-weight:var(--df-weight-semibold);color:var(--df-text-dark);font-family:var(--df-font-body)"
              >
                {device.name}
              </span>
              {#if device.current}
                <span
                  style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:var(--df-radius-pill);background:var(--df-success-bg);color:var(--df-success-strong);font-size:11px;font-weight:700;font-family:var(--df-font-body)"
                >
                  <span style="width:6px;height:6px;border-radius:50%;background:var(--df-success);display:inline-block"></span>
                  目前使用中
                </span>
              {/if}
            </div>
            <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px">
              {device.location} · {device.time}
            </div>
          </div>
          {#if !device.current}
            <Button variant="ghost" size="sm" on:click={() => logout(device)}>
              <span style="display:inline-flex;align-items:center;gap:6px;color:var(--df-error)">
                <Icon name="log-out" size={14} color="var(--df-error)" />登出
              </span>
            </Button>
          {/if}
        </div>
      {/each}
    </div>
  </Card>
</div>

<!-- Password change dialog -->
<Dialog
  open={pwDialogOpen}
  title="變更登入密碼"
  width={420}
  onClose={closePwDialog}
  primaryAction={{ label: '確認變更', onClick: submitPw, variant: 'primary' }}
  secondaryAction={{ label: '取消', onClick: closePwDialog, variant: 'secondary' }}
>
  <div style="display:flex;flex-direction:column;gap:14px;padding-top:8px">
    <Input label="目前密碼" bind:value={oldPw} type="password" placeholder="請輸入目前密碼" required />
    <Input label="新密碼" bind:value={newPw} type="password" placeholder="至少 8 個字元" required />
    <Input label="確認新密碼" bind:value={confirmPw} type="password" placeholder="再次輸入新密碼" required />
    {#if pwError}
      <div
        style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:var(--df-radius-md);background:var(--df-error-bg);color:var(--df-error);font-size:var(--df-text-sm);font-family:var(--df-font-body)"
      >
        <Icon name="circle-alert" size={15} color="var(--df-error)" />{pwError}
      </div>
    {/if}
  </div>
</Dialog>
