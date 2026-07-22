<script lang="ts">
  /* 系統設定 push screen。admin2.jsx AdminSettingsScreen (487) + SettingRow (472)。
   * 場館資訊輸入 + 通知/自動化開關 + 帳號與安全列 + 儲存變更。
   *
   * Task F9：GET/PUT /settings 接真(integration-contract.md §3.25)——復用桌面
   * admin/api.ts 的 getSettings/putSettings(見 $lib/mobile-admin/api 零映射
   * re-export，兩個 surface 消費完全相同的欄位形狀)。載入採 createLoadGate 三態
   * (同 coach/settings/+page.svelte 慣例——本畫面是單筆表單、只有這一個畫面消費，
   * 不需要 $lib/mobile-admin/stores.ts 那套給 members/classes/coaches/orders 用的
   * 跨畫面集合水合機制)。單一「儲存變更」全量送出三組 key，理由同桌面版
   * +page.svelte(admin/api.ts SettingsWriteBody 附註)。「登入裝置清單」不在本任務
   * 範圍——桌面版才有這個區塊，行動版原本就沒有，維持現狀。
   *
   * 卡 C2：草稿狀態機（10 欄 + saving 旗標 + save() 的 SettingsWriteBody 組裝）
   * 收斂進 $lib/admin/settings-form 的 createSettingsForm，經 $lib/mobile-admin/api
   * 零映射 re-export 取用（與桌面 +page.svelte 共用同一份機制，0014 §2 雙生核可
   * 類）；403 文案（SETTINGS_ERROR_TEXT）/成功 toast/gate.silentRefresh() 仍逐字
   * 留在本檔。 */
  import { onMount } from 'svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { ErrorState, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { getSettings, putSettings, createSettingsForm } from '$lib/mobile-admin/api';
  import { apiErrorText } from '$lib/api/error-text';

  export let onBack: () => void;

  const RATIO_OPTIONS = ['1:4', '1:6', '1:8'];
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

  // PUT /settings:403 無權限 → 繁中文案查表(apiErrorText)，其餘通用訊息。
  const SETTINGS_ERROR_TEXT: Record<number, string> = { 403: '沒有權限執行此操作。' };

  async function save(): Promise<void> {
    const outcome = await form.save();
    switch (outcome.kind) {
      case 'alreadySaving':
        return;
      case 'failed':
        toasts.notify('error', '儲存失敗', apiErrorText(outcome.error, SETTINGS_ERROR_TEXT));
        return;
      case 'saved':
        toasts.notify('success', '已儲存', '系統設定已更新。');
        await gate.silentRefresh();
        return;
    }
  }
</script>

<PushScreen>
  <ScreenHeader {onBack} title="系統設定" sub="場館資訊、通知與權限" />
  <LoadGate {gate}>
    <div class="df-scroll" data-testid="settings-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:18px;" slot="loading">
      {#each [0, 1, 2] as i (i)}
        <SkelCard padding={16}><Skeleton w="100%" h={i === 0 ? 220 : 140} r={12} /></SkelCard>
      {/each}
    </div>

    <div class="df-scroll" style="padding:16px;" slot="error">
      <ErrorState onRetry={gate.refresh} />
    </div>

    <div class="df-scroll">
      <div style="padding:16px; display:flex; flex-direction:column; gap:18px;">
        <Panel title="場館資訊" sub="顯示於官網與報名通知" pad={16}>
          <div style="display:flex; flex-direction:column; gap:13px;">
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">場館名稱</div>
              <input
                bind:value={$draft.name}
                style="width:100%; height:44px; padding:0 13px; border:1.5px solid var(--df-border-strong);
                  border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark);
                  outline:none; box-sizing:border-box;"
              />
            </div>
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">聯絡電話</div>
              <input
                bind:value={$draft.phone}
                style="width:100%; height:44px; padding:0 13px; border:1.5px solid var(--df-border-strong);
                  border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark);
                  outline:none; box-sizing:border-box;"
              />
            </div>
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">地址</div>
              <input
                bind:value={$draft.address}
                style="width:100%; height:44px; padding:0 13px; border:1.5px solid var(--df-border-strong);
                  border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark);
                  outline:none; box-sizing:border-box;"
              />
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">預設師生比</div>
                <select
                  bind:value={$draft.defaultRatio}
                  style="width:100%; height:44px; padding:0 11px; border:1.5px solid var(--df-border-strong);
                    border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark);
                    outline:none; box-sizing:border-box; background:#fff; appearance:none; -webkit-appearance:none;"
                >
                  {#each RATIO_OPTIONS as o (o)}<option value={o}>{o}</option>{/each}
                </select>
              </div>
              <div>
                <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">每班人數上限</div>
                <select
                  bind:value={$draft.maxClassSizeLabel}
                  style="width:100%; height:44px; padding:0 11px; border:1.5px solid var(--df-border-strong);
                    border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark);
                    outline:none; box-sizing:border-box; background:#fff; appearance:none; -webkit-appearance:none;"
                >
                  {#each MAX_CLASS_SIZE_OPTIONS as o (o)}<option value={o}>{o}</option>{/each}
                </select>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="通知與自動化">
          <div
            style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:13px 16px;
              border-bottom:1px solid var(--df-border);"
          >
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
              <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name="mail" size={17} color="var(--df-text-light)" /></div>
              <div style="min-width:0;">
                <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">Email 通知</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:1px; line-height:1.4;">報名、繳費與請假通知家長</div>
              </div>
            </div>
            <div style="flex:none;"><Switch bind:checked={$draft.email} /></div>
          </div>
          <div
            style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:13px 16px;
              border-bottom:1px solid var(--df-border);"
          >
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
              <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name="smartphone" size={17} color="var(--df-text-light)" /></div>
              <div style="min-width:0;">
                <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">簡訊提醒</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:1px; line-height:1.4;">課前一日發送簡訊（需點數）</div>
              </div>
            </div>
            <div style="flex:none;"><Switch bind:checked={$draft.sms} /></div>
          </div>
          <div
            style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:13px 16px;
              border-bottom:1px solid var(--df-border);"
          >
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
              <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name="user-x" size={17} color="var(--df-text-light)" /></div>
              <div style="min-width:0;">
                <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">出席偏低警示</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:1px; line-height:1.4;">出席率低於 75% 通知管理員</div>
              </div>
            </div>
            <div style="flex:none;"><Switch bind:checked={$draft.lowAtt} /></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:13px 16px;">
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
              <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name="repeat" size={17} color="var(--df-text-light)" /></div>
              <div style="min-width:0;">
                <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">自動候補遞補</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:1px; line-height:1.4;">額滿班級退出時通知候補</div>
              </div>
            </div>
            <div style="flex:none;"><Switch bind:checked={$draft.autoWait} /></div>
          </div>
        </Panel>

        <Panel title="帳號與安全">
          <div
            style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:13px 16px;
              border-bottom:1px solid var(--df-border);"
          >
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
              <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name="key-round" size={17} color="var(--df-text-light)" /></div>
              <div style="min-width:0;">
                <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">變更密碼</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:1px; line-height:1.4;">上次更新於 2026/03/12</div>
              </div>
            </div>
            <div style="flex:none;"><Icon name="chevron-right" size={18} color="var(--df-text-muted)" /></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:13px 16px;">
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
              <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name="shield-check" size={17} color="var(--df-text-light)" /></div>
              <div style="min-width:0;">
                <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">雙重驗證（2FA）</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:1px; line-height:1.4;">登入時需動態驗證碼</div>
              </div>
            </div>
            <div style="flex:none;"><Switch bind:checked={$draft.twoFA} /></div>
          </div>
        </Panel>

        <Button variant="primary" fullWidth disabled={$saving} on:click={save}>
          <Icon name="check" size={16} style="margin-right:6px;" />儲存變更
        </Button>
        <div style="height:8px;"></div>
      </div>
    </div>
  </LoadGate>
</PushScreen>
