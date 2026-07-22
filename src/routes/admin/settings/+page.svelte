<script lang="ts">
  /* 系統設定 — faithful port of admin.jsx SettingsView. Three cards:
   *  · 場館資訊 — venue info field grid.
   *  · 通知與自動化 — four Switch rows. 儲存變更 → putSettings().
   *  · 帳號與安全 — 變更密碼 (opens PasswordDialog), 雙重驗證 Switch, and the
   *    登入裝置 list (monitor / smartphone / tablet icons) with 登出其他裝置.
   *
   * Task F9：GET/PUT /settings 接真(integration-contract.md §3.25)。三態載入閘門
   * (createLoadGate)取代原本的純本地假資料；欄位改為 bind:value/bind:checked 的
   * 可編輯草稿，單一「儲存變更」動作打 putSettings() 全量送出三組 key(只有一個
   * Save 動作、沒有逐卡片獨立儲存 UI，全送最簡單，不需要另外追蹤 dirty 狀態，見
   * admin/api.ts SettingsWriteBody 附註)。切換 Switch 只更新本地草稿、不再各自
   * 即時 toast(接真前每次切換就跳「已開啟/已關閉」暗示已即時持久化；接真後這句話
   * 會變成謊言——真正持久化只發生在按下「儲存變更」的那一刻)。
   *
   * 「登入裝置清單」不在本任務範圍(契約 §3.25 開頭：需 session 管理，另案處理)，
   * 維持現狀——LOGINS 仍是純本地 mock，最小 diff。
   *
   * 卡 C2：草稿狀態機（10 欄 + saving 旗標 + save() 的 SettingsWriteBody 組裝）
   * 收斂進 $lib/admin/settings-form 的 createSettingsForm（與 mobile-admin
   * AdminSettingsScreen 共用同一份機制，0014 §2 雙生核可類）；403 文案/成功
   * toast/gate.silentRefresh() 仍逐字留在本檔。 */
  import { onMount } from 'svelte';
  import { Card, Input, Select, Switch, Button, Badge, Icon, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import SettingsRow from '$lib/admin/components/SettingsRow.svelte';
  import PasswordDialog from '$lib/admin/components/PasswordDialog.svelte';
  import { toasts } from '$lib/admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { getSettings, putSettings } from '$lib/admin/api';
  import { createSettingsForm } from '$lib/admin/settings-form';
  import { apiErrorText } from '$lib/api/error-text';
  import type { IconName } from '$lib/icon-registry';

  let pwOpen = false;

  const MAX_CLASS_SIZE_OPTIONS = ['8 人', '10 人', '12 人'];

  // getSettings 不進 deps——資料由下方 gate 的 onData 呼叫 form.applyData(d) 餵入。
  const form = createSettingsForm({ putSettings });
  const { draft, saving } = form;

  const gate = createLoadGate({
    fetch: getSettings,
    onData: (d) => form.applyData(d)
  });
  onMount(() => {
    gate.load();
  });

  function settingsErrorMessage(e: unknown): string {
    return apiErrorText(e, { 403: '沒有權限執行此操作。' });
  }

  async function save(): Promise<void> {
    const outcome = await form.save();
    switch (outcome.kind) {
      case 'alreadySaving':
        return;
      case 'failed':
        toasts.notify('error', '儲存失敗', settingsErrorMessage(outcome.error));
        return;
      case 'saved':
        toasts.notify('success', '已儲存', '系統設定已更新。');
        await gate.silentRefresh();
        return;
    }
  }

  const LOGINS: { icon: IconName; device: string; place: string; time: string; now: boolean }[] = [
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

<LoadGate {gate}>
  <div style="display:flex;flex-direction:column;gap:20px;max-width:760px" data-testid="settings-skeleton" slot="loading">
    <Skeleton w={160} h={32} r={8} />
    <SkelCard><Skeleton w="100%" h={180} r={12} /></SkelCard>
    <SkelCard><Skeleton w="100%" h={220} r={12} /></SkelCard>
    <SkelCard><Skeleton w="100%" h={260} r={12} /></SkelCard>
  </div>

  <div class="df-view" style="display:flex;flex-direction:column;gap:20px;max-width:760px">
    <PageHead title="系統設定" sub="場館資訊、通知與權限" />

    <!-- 場館資訊 -->
    <Card padding={24}>
      <h3 class="sec-title">場館資訊</h3>
      <p class="sec-sub">顯示於官網與報名通知</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <Input label="場館名稱" bind:value={$draft.name} />
        <Input label="聯絡電話" bind:value={$draft.phone} />
        <Input label="地址" bind:value={$draft.address} style="grid-column:span 2" />
        <Select label="預設師生比" bind:value={$draft.defaultRatio} options={['1:4', '1:6', '1:8']} />
        <Select label="每班人數上限" bind:value={$draft.maxClassSizeLabel} options={MAX_CLASS_SIZE_OPTIONS} />
      </div>
    </Card>

    <!-- 通知與自動化 -->
    <Card padding={24}>
      <h3 class="sec-title" style="margin-bottom:12px">通知與自動化</h3>
      <SettingsRow label="Email 通知" desc="報名、繳費與請假以 Email 通知家長">
        <Switch bind:checked={$draft.email} />
      </SettingsRow>
      <SettingsRow label="簡訊提醒" desc="課前一日發送簡訊提醒（需加購點數）">
        <Switch bind:checked={$draft.sms} />
      </SettingsRow>
      <SettingsRow label="出席偏低警示" desc="學員出席率低於 75% 時通知管理員">
        <Switch bind:checked={$draft.lowAtt} />
      </SettingsRow>
      <SettingsRow label="自動候補遞補" desc="額滿班級有人退出時自動通知候補學員">
        <Switch bind:checked={$draft.autoWait} />
      </SettingsRow>
      <div style="display:flex;justify-content:flex-end;margin-top:18px">
        <Button variant="primary" disabled={$saving} on:click={save}>
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
        desc={$draft.twoFA ? '已啟用 · 登入時需輸入動態驗證碼' : '建議啟用以提升帳號安全'}
      >
        <Switch bind:checked={$draft.twoFA} />
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
</LoadGate>

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
