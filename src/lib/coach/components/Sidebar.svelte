<script lang="ts">
  /* 教練端 sidebar (shell.jsx:42-127): 240px navy rail — brand + gold 教練端 pill,
   * 7 flat nav items (active = primary bg + white), and an interactive gold
   * profile card that toggles a ProfileMenu popover (3 navigating rows + a
   * toast-only logout). Active state via nav.ts isActive() so 儀表板 isn't stuck
   * active on deeper routes. */
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import CoachAvatar from './CoachAvatar.svelte';
  import { NAV, coachPath, isActive } from '$lib/coach/nav';
  import { authStore } from '$lib/stores/authStore';
  import { initialOf } from '$lib/api/wire';
  import { toasts } from '$lib/coach/stores';
  import { rememberStaffRole, ROLE_HOME } from '$lib/staff/roles';
  import type { IconName } from '$lib/icon-registry';

  let menu = false;
  $: path = $page.url.pathname;
  $: member = $authStore.member;
  $: coachInitial = member ? initialOf(member.name) : '?';
  $: coachDisplay = member ? `${coachInitial}教練` : '教練';
  $: coachFull = member ? `${member.name} 教練` : '教練';

  const MENU_ROWS: { icon: IconName; label: string; desc: string; to: string }[] = [
    { icon: 'user-cog', label: '個人設定', desc: '編輯個人資料與偏好', to: 'settings' },
    { icon: 'calendar-days', label: '排課管理', desc: '查看本週授課時段', to: 'schedule' },
    { icon: 'shield-check', label: '帳號安全', desc: '密碼、雙重驗證、登入紀錄', to: 'settings' }
  ];

  function go(to: string) {
    menu = false;
    goto(coachPath(to));
  }
  function logout() {
    menu = false;
    toasts.notify('info', '登出', '您已安全登出（示範）。');
  }

  function switchRole() {
    menu = false;
    rememberStaffRole('admin');
    goto(ROLE_HOME.admin);
  }
</script>

<aside
  style="width:240px;flex:none;background:var(--df-bg-dark);display:flex;flex-direction:column;justify-content:space-between;height:100%;position:relative;padding:20px 16px;font-family:var(--df-font-admin)"
>
  <div style="display:flex;flex-direction:column;gap:28px;min-height:0">
    <!-- brand -->
    <div style="display:flex;align-items:center;gap:10px;padding:0 4px">
      <div
        style="width:36px;height:36px;border-radius:50%;background:var(--df-primary);display:flex;align-items:center;justify-content:center;flex:none"
      >
        <span style="color:#fff;font-weight:800;font-size:14px;letter-spacing:0.5px">DF</span>
      </div>
      <span style="color:#fff;font-weight:700;font-size:18px;font-family:var(--df-font-body)">Dream Fly</span>
      <span style="background:var(--df-accent);color:var(--df-ink);font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px">
        教練端
      </span>
    </div>
    <!-- nav -->
    <nav style="display:flex;flex-direction:column;gap:4px;overflow-y:auto">
      {#each NAV as n (n.id)}
        {@const active = isActive(coachPath(n.id), path)}
        <button
          class="df-navbtn"
          on:click={() => goto(coachPath(n.id))}
          style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;border:none;cursor:pointer;width:100%;text-align:left;background-color:{active
            ? 'var(--df-primary)'
            : 'transparent'};color:{active ? '#fff' : '#94A3B8'};font-size:14px;font-weight:{active
            ? 600
            : 500};font-family:var(--df-font-admin)"
        >
          <Icon name={n.icon} size={18} color={active ? '#fff' : '#94A3B8'} />
          <span style="flex:1">{n.label}</span>
          {#if n.badge}
            <span
              style="background:{active
                ? 'rgba(255,255,255,0.25)'
                : '#dc2626'};color:#fff;font-size:11px;font-weight:800;min-width:20px;height:20px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px"
            >
              {n.badge}
            </span>
          {/if}
        </button>
      {/each}
    </nav>
  </div>

  <!-- profile menu (pops above the profile card) -->
  {#if menu}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div style="position:fixed;inset:0;z-index:60" on:click={() => (menu = false)}></div>
    <div
      style="position:absolute;bottom:86px;left:16px;width:256px;background:#fff;border-radius:14px;box-shadow:var(--df-shadow-strong);z-index:70;max-height:calc(100vh - 112px);overflow-x:hidden;overflow-y:auto;animation:df-fade-up .16s ease both"
    >
      <div style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--df-border)">
        <CoachAvatar size={40} online initial={coachInitial} />
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--df-ink)">{coachFull}</div>
        </div>
      </div>
      <!-- 切換至其他身分 (shell.jsx:57-78) -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 18px 6px">
        <span style="font-size:10px;font-weight:700;letter-spacing:1.4px;color:var(--df-text-muted)">切換至其他身分</span>
        <span style="font-size:10px;font-weight:600;color:var(--df-border-strong)">1 個可用</span>
      </div>
      <div style="padding:0 8px 4px">
        <button
          on:click={switchRole}
          style="width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid var(--df-accent);background:#FFFBEB;cursor:pointer;text-align:left"
        >
          <span style="width:38px;height:38px;border-radius:10px;background:var(--df-accent);display:flex;align-items:center;justify-content:center;flex:none">
            <Icon name="shield-check" size={20} color="var(--df-ink)" />
          </span>
          <span style="flex:1;min-width:0">
            <span style="display:flex;align-items:center;gap:6px">
              <span style="font-size:14px;font-weight:700;color:var(--df-text-dark)">管理後台</span>
              <span style="background:var(--df-warning-bg);color:#B45309;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px">管理員</span>
            </span>
            <span style="display:block;font-size:11px;color:var(--df-text-light);margin-top:3px">可存取全平台後台 · 9 個功能模組</span>
          </span>
          <span style="width:28px;height:28px;border-radius:14px;background:var(--df-primary);display:flex;align-items:center;justify-content:center;flex:none">
            <Icon name="arrow-right" size={14} color="#fff" />
          </span>
        </button>
      </div>
      <div style="height:1px;background:#F1F5F9;margin:6px 18px"></div>
      <div style="padding:6px 4px">
        {#each MENU_ROWS as r (r.label + r.to)}
          <button
            class="df-rowhover"
            on:click={() => go(r.to)}
            style="display:flex;align-items:center;gap:12px;padding:9px 14px;width:100%;border:none;background:transparent;cursor:pointer;text-align:left;font-family:var(--df-font-body)"
          >
            <span
              style="width:32px;height:32px;border-radius:8px;background:var(--df-bg-light);display:flex;align-items:center;justify-content:center;flex:none"
            >
              <Icon name={r.icon} size={15} color="var(--df-text-dark)" />
            </span>
            <span style="flex:1;min-width:0">
              <span style="display:block;font-size:13.5px;font-weight:600;color:var(--df-text-dark)">{r.label}</span>
              <span style="display:block;font-size:11.5px;color:var(--df-text-light)">{r.desc}</span>
            </span>
            <Icon name="chevron-right" size={14} color="var(--df-border-strong)" />
          </button>
        {/each}
      </div>
      <div style="padding:4px 8px 12px;border-top:1px solid var(--df-border)">
        <button
          class="df-rowhover"
          on:click={logout}
          style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border-radius:8px;background:#FEF2F2;border:none;cursor:pointer;font-family:var(--df-font-body)"
        >
          <span
            style="width:30px;height:30px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center"
          >
            <Icon name="log-out" size={14} color="#EF4444" />
          </span>
          <span style="font-size:13px;font-weight:700;color:#DC2626">登出目前工作階段</span>
        </button>
      </div>
    </div>
  {/if}

  <!-- profile card -->
  <button
    on:click={() => (menu = !menu)}
    style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;background:{menu
      ? '#243149'
      : 'var(--df-ink-soft)'};border:none;cursor:pointer;text-align:left;width:100%"
  >
    <CoachAvatar size={40} online initial={coachInitial} />
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:600;color:#fff;font-family:var(--df-font-body)">{coachDisplay}</div>
      <div style="font-size:12px;color:#94A3B8;font-family:var(--df-font-body)">教練</div>
    </div>
    <Icon name="log-out" size={18} color="#94A3B8" />
  </button>
</aside>
