<script lang="ts">
  /* 系統設定 push screen。admin2.jsx AdminSettingsScreen (487) + SettingRow (472)。
   * 場館資訊輸入 + 通知/自動化開關（本地狀態）+ 帳號與安全列 + 儲存變更。 */
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import { toasts } from '$lib/mobile-admin/stores';

  export let onBack: () => void;

  let email = true;
  let sms = false;
  let lowAtt = true;
  let autoWait = true;

  const fields: [string, string][] = [
    ['場館名稱', 'Dream Fly 夢飛體操館'],
    ['聯絡電話', '04-2376-1688'],
    ['地址', '台中市西區美村路一段 168 號']
  ];
  const selects: [string, string[], string][] = [
    ['預設師生比', ['1:4', '1:6', '1:8'], '1:6'],
    ['每班人數上限', ['8 人', '10 人', '12 人'], '12 人']
  ];
</script>

<PushScreen>
  <ScreenHeader {onBack} title="系統設定" sub="場館資訊、通知與權限" />
  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:18px;">
      <Panel title="場館資訊" sub="顯示於官網與報名通知" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each fields as [l, v] (l)}
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">{l}</div>
              <input
                value={v}
                style="width:100%; height:44px; padding:0 13px; border:1.5px solid var(--df-border-strong);
                  border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark);
                  outline:none; box-sizing:border-box;"
              />
            </div>
          {/each}
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            {#each selects as [l, opts, def] (l)}
              <div>
                <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">{l}</div>
                <select
                  value={def}
                  style="width:100%; height:44px; padding:0 11px; border:1.5px solid var(--df-border-strong);
                    border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark);
                    outline:none; box-sizing:border-box; background:#fff; appearance:none; -webkit-appearance:none;"
                >
                  {#each opts as o (o)}<option value={o}>{o}</option>{/each}
                </select>
              </div>
            {/each}
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
          <div style="flex:none;"><Switch bind:checked={email} /></div>
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
          <div style="flex:none;"><Switch bind:checked={sms} /></div>
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
          <div style="flex:none;"><Switch bind:checked={lowAtt} /></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:13px 16px;">
          <div style="display:flex; align-items:center; gap:12px; min-width:0;">
            <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name="repeat" size={17} color="var(--df-text-light)" /></div>
            <div style="min-width:0;">
              <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">自動候補遞補</div>
              <div style="font-size:12px; color:var(--df-text-light); margin-top:1px; line-height:1.4;">額滿班級退出時通知候補</div>
            </div>
          </div>
          <div style="flex:none;"><Switch bind:checked={autoWait} /></div>
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
          <div style="flex:none;"><Switch checked /></div>
        </div>
      </Panel>

      <Button variant="primary" fullWidth on:click={() => toasts.notify('success', '已儲存', '系統設定已更新。')}>
        <Icon name="check" size={16} style="margin-right:6px;" />儲存變更
      </Button>
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
