<script lang="ts">
  /* 教練 · 個人設定。port coach.jsx CoachSettingsScreen (276-401)。
   * SettingRow 內聯（kit 未提供）；CTag selected 內聯選取樣式。
   * onRole → overlay.sheet('role')；notify → toasts.notify；logout 清 localStorage 導向登入。 */
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import HeroHeader from '$lib/mobile-admin/components/HeroHeader.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import { overlay, role, switchRole, session, toasts } from '$lib/mobile-admin/stores';
  import { adminPath, type Role } from '$lib/mobile-admin/nav';
  import { PROFILES, COACHES } from '$lib/mobile-admin/data';

  const p = PROFILES.coach;
  const cInfo = COACHES.find((c) => c.name === '林雅婷') || COACHES[0];

  let notif = { parentMsg: true, classRemind: true, attUndone: true, lowAtt: true, weekly: false, sms: false };
  let twoFA = true;
  let pwOpen = false;

  const LOGINS = [
    { icon: 'smartphone', device: 'iPhone · Dream Fly App', place: '台中 · 行動網路', time: '目前使用中', now: true },
    { icon: 'monitor', device: 'MacBook · Chrome', place: '台中 · 場館', time: '今天 08:14', now: false },
    { icon: 'tablet', device: 'iPad · Safari', place: '台中 · 場館 Wi-Fi', time: '昨天 19:32', now: false }
  ];
  // alarm-clock → clock（registry 未含 alarm-clock）
  const notifRows: [keyof typeof notif, string, string, string][] = [
    ['parentMsg', 'message-circle', '家長訊息通知', '有家長傳送新訊息時即時通知'],
    ['classRemind', 'clock', '課前提醒', '上課前 30 分鐘提醒準備與點名'],
    ['attUndone', 'calendar-check', '點名未完成提醒', '課後尚未點名於 30 分鐘後提醒'],
    ['lowAtt', 'user-x', '學員出席偏低警示', '我的學員出席率低於 75% 通知'],
    ['weekly', 'bar-chart-3', '每週訓練摘要', '每週一寄送上週班級摘要'],
    ['sms', 'smartphone', '簡訊提醒', '重要館務異動同步以簡訊通知']
  ];

  const onRole = () => overlay.sheet('role', { role: $role, setRole: (r: Role) => { switchRole(r); goto(adminPath(r, r === 'admin' ? 'home' : 'today')); } });
  function logout() {
    if (browser) {
      try {
        localStorage.removeItem('df_madmin_session');
        localStorage.removeItem('df_madmin_role');
      } catch (_) {}
    }
    session.set(false);
    goto('/mobile-admin/login');
  }
</script>

<HeroHeader role="coach" {p} unread={0} onBell={() => {}} {onRole} greeting="個人設定" sub="個人資料、通知偏好與帳號安全" />

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:18px; margin-top:-2px;">
    <!-- profile summary -->
    <div style="background:#fff; border:1px solid var(--df-border); border-radius:16px; box-shadow:var(--df-shadow-card); padding:16px;">
      <div style="display:flex; align-items:center; gap:13px;">
        <div style="position:relative; flex:none;">
          <Avatar name={cInfo.initial} size="lg" color={cInfo.color} />
          <span style="position:absolute; right:0; bottom:0; width:14px; height:14px; border-radius:999px; background:var(--df-success); border:2.5px solid #fff;"></span>
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:7px;"><span style="font-size:18px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{cInfo.name} 教練</span></div>
          <div style="font-size:12px; color:var(--df-primary); margin-top:2px;">{cInfo.title}</div>
        </div>
        <button
          on:click={() => toasts.notify('info', '更換照片', '請上傳正方形大頭照。')}
          class="df-tapscale"
          style="width:40px; height:40px; border-radius:11px; border:1.5px solid var(--df-border); background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
        ><Icon name="camera" size={18} color="var(--df-text-light)" /></button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:15px; border-top:1px solid var(--df-border); padding-top:14px;">
        {#each [[cInfo.years + ' 年', '年資'], [cInfo.students + ' 位', '學員'], [cInfo.classes + ' 班', '班級'], [cInfo.awards + ' 座', '獲獎']] as [v, l] (l)}
          <div style="text-align:center;">
            <div style="font-size:16.5px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{v}</div>
            <div style="font-size:11px; color:var(--df-text-light); margin-top:1px;">{l}</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- contact info -->
    <Panel title="基本資料" pad={16}>
      <div style="display:flex; flex-direction:column; gap:12px;">
        {#each [['姓名', cInfo.name], ['職稱', cInfo.title], ['聯絡電話', cInfo.phone], ['Email', 'ya-ting.lin@dreamfly.tw']] as [l, v] (l)}
          <div>
            <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">{l}</div>
            <input value={v} style="width:100%; height:44px; padding:0 13px; border:1.5px solid var(--df-border-strong); border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark); outline:none; box-sizing:border-box;" />
          </div>
        {/each}
        <div>
          <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">教練簡介</div>
          <textarea rows={3} style="width:100%; padding:11px 13px; border:1.5px solid var(--df-border-strong); border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark); outline:none; resize:vertical; box-sizing:border-box; line-height:1.6;">專注於競技啦啦隊與競技體操訓練，重視動作安全與循序漸進。帶領選手班備賽全國錦標賽。</textarea>
        </div>
        <div>
          <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:7px;">專長領域</div>
          <div style="display:flex; gap:7px; flex-wrap:wrap;">
            {#each cInfo.tags as t (t)}
              <span style="display:inline-flex; align-items:center; padding:4px 10px; border-radius:var(--df-radius-sm); background:var(--df-primary-bg); border:1px solid var(--df-primary); font-size:var(--df-text-xs); font-weight:var(--df-weight-medium); color:var(--df-primary); white-space:nowrap;">{t}</span>
            {/each}
          </div>
        </div>
      </div>
    </Panel>

    <!-- notification prefs -->
    <Panel title="通知偏好">
      {#each notifRows as [k, ic, t, d], i (k)}
        <div style="display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:{i < notifRows.length - 1 ? '1px solid var(--df-border)' : 'none'};">
          <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name={ic} size={17} color="var(--df-text-light)" /></div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">{t}</div>
            <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">{d}</div>
          </div>
          <Switch bind:checked={notif[k]} />
        </div>
      {/each}
    </Panel>

    <!-- account -->
    <Panel title="帳號與安全">
      <div style="display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:1px solid var(--df-border);">
        <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name="key-round" size={17} color="var(--df-text-light)" /></div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">變更密碼</div>
          <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">上次更新於 2026/03/12</div>
        </div>
        <button
          on:click={() => (pwOpen = true)}
          class="df-tapscale"
          style="height:34px; padding:0 14px; border-radius:9px; border:1.5px solid var(--df-border); background:#fff; color:var(--df-primary); font-size:13px; font-weight:700; cursor:pointer;"
        >變更</button>
      </div>
      <div style="display:flex; align-items:center; gap:12px; padding:13px 16px;">
        <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name="shield-check" size={17} color="var(--df-text-light)" /></div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">雙重驗證（2FA）</div>
          <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">{twoFA ? '已啟用 · 登入需動態驗證碼' : '建議啟用'}</div>
        </div>
        <Switch checked={twoFA} on:change={(e) => { twoFA = e.detail; toasts.notify(twoFA ? 'success' : 'warning', twoFA ? '已啟用雙重驗證' : '已關閉雙重驗證', twoFA ? '下次登入將需要動態驗證碼。' : '帳號安全性已降低。'); }} />
      </div>
    </Panel>

    <!-- login devices -->
    <Panel title="登入裝置" sub="近期登入此帳號的裝置">
      <button slot="right" on:click={() => toasts.notify('warning', '已登出其他裝置', '除目前裝置外，所有工作階段已結束。')} style="border:none; background:none; font-size:12.5px; font-weight:700; color:var(--df-error); cursor:pointer;">登出其他</button>
      {#each LOGINS as l, i (i)}
        <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:{i < LOGINS.length - 1 ? '1px solid var(--df-border)' : 'none'};">
          <div style="width:36px; height:36px; border-radius:9px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;"><Icon name={l.icon} size={17} color="var(--df-text-light)" /></div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">{l.device}</div>
            <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">{l.place}</div>
          </div>
          {#if l.now}
            <Badge tone="success" dot>{l.time}</Badge>
          {:else}
            <span style="font-size:11.5px; color:var(--df-text-muted); font-family:var(--df-font-mono);">{l.time}</span>
          {/if}
        </div>
      {/each}
    </Panel>

    <Button variant="primary" fullWidth on:click={() => toasts.notify('success', '已儲存', '個人設定已更新。')}>
      <span style="display:inline-flex; align-items:center; gap:6px; justify-content:center;"><Icon name="check" size={16} color="#fff" />儲存變更</span>
    </Button>
    <button
      on:click={logout}
      class="df-tapscale"
      style="display:flex; align-items:center; justify-content:center; gap:8px; height:48px; border-radius:12px; border:none; background:#FEF2F2; color:var(--df-error); font-size:14px; font-weight:700; cursor:pointer;"
    >
      <Icon name="log-out" size={17} color="var(--df-error)" /> 登出
    </button>
    <div style="height:8px;"></div>
  </div>
</div>

<!-- change-password sheet -->
<Sheet open={pwOpen} onClose={() => (pwOpen = false)} title="變更密碼">
  <div style="display:flex; flex-direction:column; gap:14px;">
    {#each [['目前密碼', '輸入目前密碼'], ['新密碼', '至少 8 碼，含英數'], ['確認新密碼', '再次輸入新密碼']] as [l, ph] (l)}
      <div>
        <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">{l}</div>
        <input type="password" placeholder={ph} style="width:100%; height:46px; padding:0 13px; border:1.5px solid var(--df-border-strong); border-radius:10px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark); outline:none; box-sizing:border-box;" />
      </div>
    {/each}
  </div>
  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={() => (pwOpen = false)}>取消</Button>
    <Button variant="primary" style="flex:1;" on:click={() => { pwOpen = false; toasts.notify('success', '密碼已更新', '請於下次登入使用新密碼。'); }}>
      <span style="display:inline-flex; align-items:center; gap:6px; justify-content:center;"><Icon name="check" size={16} color="#fff" />更新密碼</span>
    </Button>
  </svelte:fragment>
</Sheet>
