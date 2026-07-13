<script lang="ts">
  /* 教練 · 個人設定。port coach.jsx CoachSettingsScreen (276-401)。
   * SettingRow 內聯（kit 未提供）；CTag selected 內聯選取樣式。
   * onRole → overlay.sheet('role')；notify → toasts.notify；logout 清真 authStore session。
   *
   * Task 20：改讀真 getCsettings()(coach/api.ts getSettings()，GET /users/me +
   * GET /coaches)，取代舊 mock 對 PROFILES.coach + COACHES.find(name==='林雅婷')
   * 的拼湊方式——真實 Coach 型別(coach/data.ts)沒有 years/students/classes/awards
   * 統計欄位(舊 $lib/domain/coaches 型別才有，行動版專屬豐富化、後端從未提供)，
   * 改用桌面 coach/settings 頁自己在這個位置的固定假統計(授課時數/學員數/年資，
   * 3 格，同該頁「Stats — sensible values derived from data / mock」的決定，不
   * 新發明第 4 格)。姓名/聯絡電話改真送 PATCH /users/me(saveSettings)；職稱/
   * Email/簡介維持頁面本地編輯、不送出(契約不支援寫入這些欄位，同桌面 ProfileTab
   * 的決定)。通知偏好/帳號安全(密碼/2FA/登入裝置)桌面自己在這兩個位置也是全部
   * mock(NotifTab/SecurityTab 皆無對應後端)，鏡射同一決定原樣保留。
   * cInfo 找不到本人資料(coach 為 null，通常是 CoachNotFoundError)時顯示
   * EmptyState，不當機。 */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import HeroHeader from '$lib/mobile-admin/components/HeroHeader.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import { LoadGate, EmptyState, Skeleton, SkelCard } from '$lib/components/ui';
  import { overlay, role, switchRole, toasts } from '$lib/mobile-admin/stores';
  import { adminPath, type Role } from '$lib/mobile-admin/nav';
  import { createLoadGate } from '$lib/load-gate';
  import { getCsettings, saveSettings, CoachNotFoundError, type CsettingsData } from '$lib/mobile-admin/api';
  import { authStore } from '$lib/stores/authStore';
  import type { IconName } from '$lib/icon-registry';

  let data: CsettingsData | null = null;
  let errorTitle = '載入失敗';
  let errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';

  const gate = createLoadGate({
    fetch: getCsettings,
    onData: (d) => { data = d; },
    onError: (e) => {
      if (e instanceof CoachNotFoundError || (e instanceof Error && e.name === 'CoachNotFoundError')) {
        errorTitle = '此帳號未綁定教練檔案';
        errorBody = '請聯繫系統管理員協助設定教練檔案。';
      } else {
        errorTitle = '載入失敗';
        errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';
      }
    }
  });
  onMount(() => {
    gate.load();
  });

  $: cInfo = data?.coach;

  // 編輯欄位：姓名/電話有真實後端 PATCH /users/me 欄位；職稱/Email/簡介後端不支援
  // 寫入，維持本地編輯、不送出(同桌面 ProfileTab 的決定)——但每次 cInfo 變動(載入
  // 完成)都要重新帶入真值，不能只在宣告時取一次快照。
  let name = '';
  let phone = '';
  let bio = '';
  let saving = false;
  $: if (cInfo) {
    name = cInfo.name;
    phone = cInfo.phone;
    bio = cInfo.bio;
  }

  const STATS: [string, string][] = [
    ['312 hr', '授課時數'],
    ['36 人', '學員數'],
    ['6 年', '年資']
  ];

  let notif = { parentMsg: true, classRemind: true, attUndone: true, lowAtt: true, weekly: false, sms: false };
  let twoFA = true;
  let pwOpen = false;

  const LOGINS: { icon: IconName; device: string; place: string; time: string; now: boolean }[] = [
    { icon: 'smartphone', device: 'iPhone · Dream Fly App', place: '台中 · 行動網路', time: '目前使用中', now: true },
    { icon: 'monitor', device: 'MacBook · Chrome', place: '台中 · 場館', time: '今天 08:14', now: false },
    { icon: 'tablet', device: 'iPad · Safari', place: '台中 · 場館 Wi-Fi', time: '昨天 19:32', now: false }
  ];
  // alarm-clock → clock（registry 未含 alarm-clock）
  const notifRows: [keyof typeof notif, IconName, string, string][] = [
    ['parentMsg', 'message-circle', '家長訊息通知', '有家長傳送新訊息時即時通知'],
    ['classRemind', 'clock', '課前提醒', '上課前 30 分鐘提醒準備與點名'],
    ['attUndone', 'calendar-check', '點名未完成提醒', '課後尚未點名於 30 分鐘後提醒'],
    ['lowAtt', 'user-x', '學員出席偏低警示', '我的學員出席率低於 75% 通知'],
    ['weekly', 'bar-chart-3', '每週訓練摘要', '每週一寄送上週班級摘要'],
    ['sms', 'smartphone', '簡訊提醒', '重要館務異動同步以簡訊通知']
  ];

  const onRole = () => overlay.sheet('role', { role: $role, setRole: (r: Role) => { switchRole(r); goto(adminPath(r, r === 'admin' ? 'home' : 'today')); } });

  async function save() {
    saving = true;
    try {
      const saved = await saveSettings({ name, phone });
      data = { coach: saved.coach };
      toasts.notify('success', '已儲存', '個人設定已更新。');
    } catch {
      toasts.notify('error', '儲存失敗', '連線發生問題，請稍後再試。');
    } finally {
      saving = false;
    }
  }

  async function logout() {
    await authStore.logout();
    goto('/mobile-admin/login');
  }
</script>

<LoadGate {gate} errorTitle={errorTitle} errorBody={errorBody}>
  <div class="df-scroll df-view" data-testid="csettings-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:18px;" slot="loading">
    <SkelCard><Skeleton w="100%" h={100} r={16} /></SkelCard>
    <SkelCard padding={0}><Skeleton w="100%" h={180} r={16} /></SkelCard>
    <SkelCard padding={0}><Skeleton w="100%" h={220} r={16} /></SkelCard>
  </div>

  {#if data}
    {@const p = cInfo ? { name: cInfo.name, initial: cInfo.initial, role: cInfo.role, desc: '', color: 'var(--df-primary)', id: cInfo.id } : { name: '', initial: '?', role: '', desc: '', color: 'var(--df-primary)', id: '' }}
    <HeroHeader role="coach" {p} unread={0} onBell={() => {}} {onRole} greeting="個人設定" sub="個人資料、通知偏好與帳號安全" />

    <div class="df-scroll df-view">
      <div style="padding:16px; display:flex; flex-direction:column; gap:18px; margin-top:-2px;">
      {#if !cInfo}
        <EmptyState icon="user-x" title="找不到教練資料" body="請確認教練帳號設定。" />
      {:else}
        <!-- profile summary -->
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:16px; box-shadow:var(--df-shadow-card); padding:16px;">
          <div style="display:flex; align-items:center; gap:13px;">
            <div style="position:relative; flex:none;">
              <Avatar name={cInfo.initial} size="lg" color="var(--df-primary)" />
              <span style="position:absolute; right:0; bottom:0; width:14px; height:14px; border-radius:999px; background:var(--df-success); border:2.5px solid #fff;"></span>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:7px;"><span style="font-size:18px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{cInfo.full}</span></div>
              <div style="font-size:12px; color:var(--df-primary); margin-top:2px;">{cInfo.role}</div>
            </div>
            <button
              on:click={() => toasts.notify('info', '更換照片', '請上傳正方形大頭照。')}
              class="df-tapscale"
              style="width:40px; height:40px; border-radius:11px; border:1.5px solid var(--df-border); background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
            ><Icon name="camera" size={18} color="var(--df-text-light)" /></button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:15px; border-top:1px solid var(--df-border); padding-top:14px;">
            {#each STATS as [v, l] (l)}
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
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">姓名</div>
              <input bind:value={name} style="width:100%; height:44px; padding:0 13px; border:1.5px solid var(--df-border-strong); border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark); outline:none; box-sizing:border-box;" />
            </div>
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">職稱</div>
              <input value={cInfo.role} disabled style="width:100%; height:44px; padding:0 13px; border:1.5px solid var(--df-border); border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-light); outline:none; box-sizing:border-box; background:var(--df-bg-light);" />
            </div>
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">聯絡電話</div>
              <input bind:value={phone} style="width:100%; height:44px; padding:0 13px; border:1.5px solid var(--df-border-strong); border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark); outline:none; box-sizing:border-box;" />
            </div>
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">Email</div>
              <input value={cInfo.email} disabled style="width:100%; height:44px; padding:0 13px; border:1.5px solid var(--df-border); border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-light); outline:none; box-sizing:border-box; background:var(--df-bg-light);" />
            </div>
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:5px;">教練簡介</div>
              <textarea bind:value={bio} rows={3} style="width:100%; padding:11px 13px; border:1.5px solid var(--df-border-strong); border-radius:9px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark); outline:none; resize:vertical; box-sizing:border-box; line-height:1.6;"></textarea>
            </div>
            <div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-bottom:7px;">專長領域</div>
              <div style="display:flex; gap:7px; flex-wrap:wrap;">
                {#each cInfo.chips as t (t)}
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

        <Button variant="primary" fullWidth disabled={saving} on:click={save}>
          <span style="display:inline-flex; align-items:center; gap:6px; justify-content:center;"><Icon name="check" size={16} color="#fff" />{saving ? '儲存中…' : '儲存變更'}</span>
        </Button>
        <button
          on:click={logout}
          class="df-tapscale"
          style="display:flex; align-items:center; justify-content:center; gap:8px; height:48px; border-radius:12px; border:none; background:#FEF2F2; color:var(--df-error); font-size:14px; font-weight:700; cursor:pointer;"
        >
          <Icon name="log-out" size={17} color="var(--df-error)" /> 登出
        </button>
      {/if}
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
  {/if}
</LoadGate>
