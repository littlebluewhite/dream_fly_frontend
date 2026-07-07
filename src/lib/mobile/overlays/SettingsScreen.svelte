<script lang="ts">
  /* 帳號設定 push screen。account.jsx SettingsScreen (288)。
   * 頭像 + 編輯個人資料（overlay.sheet）→ 個人資料欄位 → 通知偏好 / 一般（prefs Switch 列）
   * → 儲存變更（toast）→ 登出帳號（authStore.logout() + goto /mobile/login）。
   * Legacy Svelte（無 runes）。Task 19:登出改真 authStore.logout()(清 token,
   * 不再是示範性的 df_mobile_session，同 account/+page.svelte 的 logout()）。
   * 「儲存變更」按鈕與通知偏好本身仍是本地端 prefs store(無對應後端端點,
   * 同 desktop 完全未接的等值狀態,P2)。 */
  import { goto } from '$app/navigation';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import { authStore } from '$lib/stores/authStore';
  import { overlay, prefs, profile, toasts } from '$lib/mobile/stores';
  import type { Prefs } from '$lib/mobile/stores';

  export let onBack: () => void;

  type FieldRow = { icon: string; label: string; value: string; last?: boolean };
  type ToggleRow = { icon: string; label: string; sub?: string; k: keyof Prefs; last?: boolean };

  $: personal = [
    { icon: 'user-round', label: '姓名', value: $profile.name },
    { icon: 'hash', label: '會員編號', value: $profile.id },
    { icon: 'cake', label: '生日', value: $profile.birth },
    { icon: 'phone', label: '聯絡電話', value: $profile.phone, last: true }
  ] as FieldRow[];

  const notifyRows: ToggleRow[] = [
    { icon: 'calendar-clock', label: '課程提醒', sub: '課前一日推播提醒', k: 'classReminder' },
    { icon: 'message-circle', label: '教練訊息', sub: '教練回覆即時通知', k: 'coachMsg' },
    { icon: 'megaphone', label: '活動公告', sub: '新課程與優惠資訊', k: 'promo', last: true }
  ];

  function setPref(k: keyof Prefs, v: boolean) {
    prefs.update((p) => ({ ...p, [k]: v }));
  }

  function logout() {
    authStore.logout();
    goto('/mobile/login');
  }
</script>

<PushScreen>
  <ScreenHeader {onBack} title="帳號設定" />
  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:18px;">
      <div style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:6px 0 2px;">
        <Avatar name={$profile.initial} size="xl" color={$profile.color} />
        <button
          on:click={() => overlay.sheet('editProfile')}
          class="df-tapscale"
          style="border:1px solid var(--df-border-strong); background:#fff; border-radius:999px;
            padding:7px 16px; font-size:12.5px; font-weight:600; color:var(--df-primary); cursor:pointer;
            display:flex; align-items:center; gap:6px;"
        ><Icon name="pencil-line" size={15} color="var(--df-primary)" />編輯個人資料</button>
      </div>

      <div>
        <div style="font-size:12px; font-weight:700; color:var(--df-text-muted); letter-spacing:0.5px; margin:0 4px 8px;">個人資料</div>
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; overflow:hidden;">
          {#each personal as f (f.label)}
            <div style="display:flex; align-items:center; gap:12px; padding:13px 15px; border-bottom:{f.last ? 'none' : '1px solid var(--df-border)'};">
              <Icon name={f.icon} size={18} color="var(--df-text-muted)" />
              <span style="flex:1; font-size:14px; color:var(--df-text-dark);">{f.label}</span>
              <span style="font-size:13.5px; color:var(--df-text-light); font-weight:500;">{f.value}</span>
            </div>
          {/each}
        </div>
      </div>

      <div>
        <div style="font-size:12px; font-weight:700; color:var(--df-text-muted); letter-spacing:0.5px; margin:0 4px 8px;">通知偏好</div>
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; overflow:hidden;">
          {#each notifyRows as t (t.k)}
            <div style="display:flex; align-items:center; gap:12px; padding:12px 15px; border-bottom:{t.last ? 'none' : '1px solid var(--df-border)'};">
              <Icon name={t.icon} size={18} color="var(--df-text-muted)" />
              <div style="flex:1; min-width:0;">
                <div style="font-size:14px; color:var(--df-text-dark);">{t.label}</div>
                {#if t.sub}<div style="font-size:11.5px; color:var(--df-text-muted); margin-top:1px;">{t.sub}</div>{/if}
              </div>
              <Switch checked={$prefs[t.k]} on:change={(e) => setPref(t.k, e.detail)} />
            </div>
          {/each}
        </div>
      </div>

      <div>
        <div style="font-size:12px; font-weight:700; color:var(--df-text-muted); letter-spacing:0.5px; margin:0 4px 8px;">一般</div>
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; overflow:hidden;">
          <div style="display:flex; align-items:center; gap:12px; padding:12px 15px; border-bottom:1px solid var(--df-border);">
            <Icon name="moon" size={18} color="var(--df-text-muted)" />
            <div style="flex:1; min-width:0;"><div style="font-size:14px; color:var(--df-text-dark);">深色模式</div></div>
            <Switch checked={$prefs.dark} on:change={(e) => setPref('dark', e.detail)} />
          </div>
          <div style="display:flex; align-items:center; gap:12px; padding:13px 15px; border-bottom:1px solid var(--df-border);">
            <Icon name="globe" size={18} color="var(--df-text-muted)" />
            <span style="flex:1; font-size:14px; color:var(--df-text-dark);">語言</span>
            <span style="font-size:13.5px; color:var(--df-text-light); font-weight:500;">繁體中文</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px; padding:13px 15px;">
            <Icon name="info" size={18} color="var(--df-text-muted)" />
            <span style="flex:1; font-size:14px; color:var(--df-text-dark);">版本</span>
            <span style="font-size:13.5px; color:var(--df-text-light); font-weight:500;">v2.4.0</span>
          </div>
        </div>
      </div>

      <button
        on:click={() => toasts.notify('success', '設定已儲存')}
        class="df-tapscale"
        style="border:none; background:var(--df-primary); color:#fff; border-radius:12px; padding:14px;
          font-size:15px; font-weight:700; cursor:pointer;"
      >儲存變更</button>
      <button
        on:click={logout}
        class="df-tapscale"
        style="display:flex; align-items:center; justify-content:center; gap:8px; border:1px solid var(--df-border);
          background:#fff; color:var(--df-error); border-radius:12px; padding:13px; font-size:14.5px; font-weight:700; cursor:pointer;"
      ><Icon name="log-out" size={18} color="var(--df-error)" />登出帳號</button>
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
