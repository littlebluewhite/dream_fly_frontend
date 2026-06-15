<script lang="ts">
  /* 系統設定 — faithful port of admin.jsx SettingsView. Three cards:
   *  · 場館資訊 — venue info field grid (read-only-feeling mock inputs/selects).
   *  · 通知與自動化 — four Switch rows; toggling any fires a toast. 儲存變更 → toast.
   *  · 帳號與安全 — 變更密碼 (opens PasswordDialog), 雙重驗證 Switch (toast), and the
   *    登入裝置 list (monitor / smartphone / tablet icons) with 登出其他裝置.
   * Local `let` state only; the toast singleton is the cross-route channel. */
  import { Card, Input, Select, Switch, Button, Badge, Icon } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import SettingsRow from '$lib/admin/components/SettingsRow.svelte';
  import PasswordDialog from '$lib/admin/components/PasswordDialog.svelte';
  import { toasts } from '$lib/admin/stores';

  // 通知與自動化 toggles — each change pushes a toast (mock; no persistence).
  let email = true;
  let sms = false;
  let lowAtt = true;
  let autoWait = true;

  let twoFA = true;
  let pwOpen = false;

  function toggled(label: string, on: boolean) {
    toasts.notify('success', on ? label + '已開啟' : label + '已關閉', '系統設定已更新。');
  }

  function onTwoFA(on: boolean) {
    twoFA = on;
    toasts.notify(
      on ? 'success' : 'warning',
      on ? '已啟用雙重驗證' : '已關閉雙重驗證',
      on ? '下次登入將需要動態驗證碼。' : '您的帳號安全性已降低。'
    );
  }

  const LOGINS = [
    { icon: 'monitor', device: 'MacBook · Chrome', place: '台中 · 辦公室', time: '目前使用中', now: true },
    {
      icon: 'smartphone',
      device: 'iPhone · Dream Fly App',
      place: '台中 · 行動網路',
      time: '今天 08:14',
      now: false
    },
    { icon: 'tablet', device: 'iPad · Safari', place: '台中 · 場館 Wi-Fi', time: '昨天 19:32', now: false }
  ];
</script>

<div class="df-view" style="display:flex;flex-direction:column;gap:20px;max-width:760px">
  <PageHead title="系統設定" sub="場館資訊、通知與權限" />

  <!-- 場館資訊 -->
  <Card padding={24}>
    <h3 class="sec-title">場館資訊</h3>
    <p class="sec-sub">顯示於官網與報名通知</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <Input label="場館名稱" value="Dream Fly 夢飛體操館" />
      <Input label="聯絡電話" value="04-2376-1688" />
      <Input label="地址" value="台中市西區美村路一段 168 號" style="grid-column:span 2" />
      <Select label="預設師生比" value="1:6" options={['1:4', '1:6', '1:8']} />
      <Select label="每班人數上限" value="12 人" options={['8 人', '10 人', '12 人']} />
    </div>
  </Card>

  <!-- 通知與自動化 -->
  <Card padding={24}>
    <h3 class="sec-title" style="margin-bottom:12px">通知與自動化</h3>
    <SettingsRow label="Email 通知" desc="報名、繳費與請假以 Email 通知家長">
      <Switch bind:checked={email} on:change={(e) => toggled('Email 通知', e.detail)} />
    </SettingsRow>
    <SettingsRow label="簡訊提醒" desc="課前一日發送簡訊提醒（需加購點數）">
      <Switch bind:checked={sms} on:change={(e) => toggled('簡訊提醒', e.detail)} />
    </SettingsRow>
    <SettingsRow label="出席偏低警示" desc="學員出席率低於 75% 時通知管理員">
      <Switch bind:checked={lowAtt} on:change={(e) => toggled('出席偏低警示', e.detail)} />
    </SettingsRow>
    <SettingsRow label="自動候補遞補" desc="額滿班級有人退出時自動通知候補學員">
      <Switch bind:checked={autoWait} on:change={(e) => toggled('自動候補遞補', e.detail)} />
    </SettingsRow>
    <div style="display:flex;justify-content:flex-end;margin-top:18px">
      <Button
        variant="primary"
        on:click={() => toasts.notify('success', '已儲存', '系統設定已更新。')}
      >
        <Icon name="check" size={16} />
        儲存變更
      </Button>
    </div>
  </Card>

  <!-- 帳號與安全 -->
  <Card padding={24}>
    <h3 class="sec-title" style="margin-bottom:12px">帳號與安全</h3>
    <SettingsRow label="變更密碼" desc="上次更新於 2026/03/12">
      <Button variant="secondary" size="sm" on:click={() => (pwOpen = true)}>變更密碼</Button>
    </SettingsRow>
    <SettingsRow
      label="雙重驗證（2FA）"
      desc={twoFA ? '已啟用 · 登入時需輸入動態驗證碼' : '建議啟用以提升帳號安全'}
    >
      <Switch checked={twoFA} on:change={(e) => onTwoFA(e.detail)} />
    </SettingsRow>

    <div style="margin-top:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:13.5px;font-weight:600;color:var(--df-text-dark)">登入裝置</div>
        <button
          type="button"
          class="signout"
          on:click={() =>
            toasts.notify('warning', '已登出其他裝置', '除目前裝置外，所有工作階段已結束。')}
        >
          <Icon name="log-out" size={14} color="var(--df-error)" />
          登出其他裝置
        </button>
      </div>
      {#each LOGINS as l, i}
        <div
          class="device"
          style={i < LOGINS.length - 1 ? 'border-bottom:1px solid var(--df-border)' : ''}
        >
          <div class="device-icon"><Icon name={l.icon} size={17} color="var(--df-text-light)" /></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">{l.device}</div>
            <div style="font-size:12px;color:var(--df-text-light);margin-top:1px">{l.place}</div>
          </div>
          {#if l.now}
            <Badge tone="success" dot>{l.time}</Badge>
          {:else}
            <span style="font-size:12.5px;color:var(--df-text-muted);font-family:var(--df-font-mono)"
              >{l.time}</span
            >
          {/if}
        </div>
      {/each}
    </div>
  </Card>
</div>

<PasswordDialog open={pwOpen} onClose={() => (pwOpen = false)} onSave={() => (pwOpen = false)} />

<style>
  .sec-title {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .sec-sub {
    margin: 0 0 16px;
    font-size: 13px;
    color: var(--df-text-light);
  }
  .signout {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--df-border);
    background: #fff;
    border-radius: 8px;
    padding: 6px 11px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--df-error);
    cursor: pointer;
    font-family: var(--df-font-body);
  }
  .device {
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 12px 0;
  }
  .device-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: var(--df-bg-light);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
</style>
