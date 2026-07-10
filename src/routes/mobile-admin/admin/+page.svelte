<script lang="ts">
  /* 管理員 · 總覽(工作台首頁)。admin.jsx AdminHome (27)。
   * React 的 setTab(id) 路由化為 goto(adminPath('admin', id));
   * onBell/onRole 開 notif/role sheet(於呼叫端帶入所需 props,OverlayHost 僅展開 props)。
   *
   * 資料改由 getAdminHome()(mock-API 接縫)非同步載入,三態閘門(loading/error/
   * ready)。$orders 維持原樣直接讀共享 store(待付款橫幅,與本頁 payload 無關,
   * store 本身已同步 seed)。
   *
   * Task 20：Hero KPI 改讀真 GET /reports/admin(admin/api.ts getReports())——同
   * 桌面 admin/+page.svelte 的裁決 9：原 4 張 KPI 卡中「本週課堂」「出席偏低」在
   * /reports/admin 沒有對應資料源，已隨桌面版一併移除，不留假數字；硬編 hero 日期
   * (dateLabel)同理移除。「新增學員」快速操作改開真表單並接 createMember(同
   * admin/members 頁的寫入邏輯)，不再是本地假寫入。 */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import HeroHeader from '$lib/mobile-admin/components/HeroHeader.svelte';
  import KpiCard from '$lib/mobile-admin/components/KpiCard.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { overlay, role, switchRole, adminNotifs, adminUnreadCount, toasts, orders } from '$lib/mobile-admin/stores';
  import { adminPath } from '$lib/mobile-admin/nav';
  import { createLoadGate } from '$lib/load-gate';
  import { getAdminHome, createMember, type MAdminHomeData, type CreateMemberBody } from '$lib/mobile-admin/api';
  import { apiErrorMessage } from '$lib/api/error-text';

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  let data: MAdminHomeData | null = null;
  const gate = createLoadGate({
    fetch: getAdminHome,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  $: today = data?.today ?? [];
  $: activity = data?.activity ?? [];
  $: pending = $orders.filter((o) => o.status === 'pending').length;
  $: liveNow = today.find((t) => t.label === '進行中');

  const go = (id: string) => goto(adminPath('admin', id));
  function openNotif() {
    overlay.sheet('notif', { notifs: $adminNotifs, onReadAll: () => { adminNotifs.markAllRead(); toasts.notify('success', '已全部標為已讀', ''); overlay.closeSheet(); } });
  }
  const openRole = () => overlay.sheet('role', { role: $role, setRole: (r: typeof $role) => { switchRole(r); goto(adminPath(r, r === 'admin' ? 'home' : 'today')); } });

  // POST /users 的錯誤訊息已是後端給的繁中使用者可讀文字 → apiErrorMessage 直接透傳，
  // 同 members 頁慣例。
  async function quickCreateMember(body: CreateMemberBody) {
    try {
      await createMember(body);
    } catch (e) {
      toasts.notify('error', '新增失敗', apiErrorMessage(e));
      return;
    }
    toasts.notify('success', '已新增學員', `「${body.name}」已建立。`);
  }

  const actions: [string, string, () => void][] = [
    ['plus', '新增課程', () => { go('classes'); toasts.notify('info', '新增課程', '已開啟新班級建立精靈。'); }],
    ['user-plus', '新增學員', () => overlay.sheet('memberForm', { m: null, onSave: (body: CreateMemberBody) => quickCreateMember(body) })],
    ['download', '匯出報表', () => toasts.notify('info', '報表匯出中', '本月營運報表將寄送至您的信箱。')]
  ];
</script>

<LoadGate {gate}>
  <div class="df-scroll df-view" data-testid="madmin-home-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:18px;" slot="loading">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:11px;">
      {#each [0, 1] as i (i)}
        <SkelCard><Skeleton w="100%" h={90} r={14} /></SkelCard>
      {/each}
    </div>
    <SkelCard padding={0}><Skeleton w="100%" h={180} r={16} /></SkelCard>
    <SkelCard padding={0}><Skeleton w="100%" h={180} r={16} /></SkelCard>
  </div>

  {#if data}
    {@const p = data.profiles.admin}
    <HeroHeader role="admin" {p} unread={$adminUnreadCount} onBell={openNotif} onRole={openRole}
      greeting="營運總覽" sub="全館即時概況" />

    <div class="df-scroll df-view">
      <div style="padding:16px; display:flex; flex-direction:column; gap:18px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:11px; margin-top:-2px;">
          <KpiCard icon="users" label="在學學員" value={data.enrolledValue} tint="var(--df-primary-bg)" color="var(--df-primary)" onClick={() => go('members')} />
          <KpiCard icon="receipt" label="本月營收" value={data.revenueMonthValue} tint="#FFF8DB" color="var(--df-accent-dark)" />
        </div>

        <div style="display:flex; gap:9px;">
          {#each actions as [ic, l, fn] (l)}
            <button
              on:click={fn}
              class="df-tapscale"
              style="flex:1; display:flex; flex-direction:column; align-items:center; gap:7px; padding:13px 4px;
                border-radius:13px; border:1px solid var(--df-border); background:#fff; cursor:pointer; box-shadow:var(--df-shadow-card);"
            >
              <div style="width:38px; height:38px; border-radius:11px; background:var(--df-primary-bg); display:flex; align-items:center; justify-content:center;">
                <Icon name={ic} size={19} color="var(--df-primary)" />
              </div>
              <span style="font-size:12px; font-weight:600; color:var(--df-text-dark);">{l}</span>
            </button>
          {/each}
        </div>

        {#if liveNow}
          <button on:click={() => go('classes')} class="df-tapscale" style="border:none; padding:0; background:transparent; cursor:pointer; text-align:left;">
            <div style="display:flex; align-items:center; gap:13px; background:linear-gradient(120deg, var(--df-success-bg), #fff); border:1px solid var(--df-success); border-radius:14px; padding:14px;">
              <div style="width:44px; height:44px; border-radius:12px; background:#fff; display:flex; align-items:center; justify-content:center; flex:none; box-shadow:var(--df-shadow-soft);">
                <Icon name="radio" size={22} color="var(--df-success)" />
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:11.5px; font-weight:700; color:var(--df-success); letter-spacing:0.5px;">● 進行中課堂</div>
                <div style="font-size:14.5px; font-weight:700; color:var(--df-ink); margin-top:2px;">{liveNow.name}</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{liveNow.coach} 教練 · {liveNow.room} · {liveNow.count} 人</div>
              </div>
              <Icon name="chevron-right" size={20} color="var(--df-text-muted)" />
            </div>
          </button>
        {/if}

        <Panel title="今日課表" sub={'全館 ' + today.length + ' 堂課'} action="課程" onAction={() => go('classes')}>
          {#each today as t, i (i)}
            <div
              class="df-rowhover"
              style="display:flex; align-items:center; gap:12px; padding:12px 16px;
                border-bottom:{i < today.length - 1 ? '1px solid var(--df-border)' : 'none'};"
            >
              <div style="font-family:var(--df-font-mono); font-size:14px; font-weight:700; color:var(--df-ink); width:44px; flex:none;">{t.time}</div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:14px; font-weight:600; color:var(--df-text-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{t.name}</div>
                <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">{t.coach} · {t.room} · {t.count} 人</div>
              </div>
              <Badge tone={(t.tone || 'neutral') as Tone} dot>{t.label}</Badge>
            </div>
          {/each}
        </Panel>

        {#if pending > 0}
          <button on:click={() => go('orders')} class="df-tapscale" style="border:none; padding:0; background:transparent; cursor:pointer; text-align:left;">
            <div style="display:flex; align-items:center; gap:12px; background:var(--df-warning-bg); border-radius:14px; padding:13px 15px;">
              <Icon name="clock" size={20} color="var(--df-warning)" />
              <div style="flex:1; font-size:13.5px; color:var(--df-text-dark);"><b>{pending} 筆訂單</b> 待付款,建議追蹤繳費狀態。</div>
              <Icon name="chevron-right" size={18} color="var(--df-warning)" />
            </div>
          </button>
        {/if}

        <Panel title="最新動態">
          {#each activity as a, i (i)}
            <div
              style="display:flex; gap:12px; padding:11px 16px;
                border-bottom:{i < activity.length - 1 ? '1px solid var(--df-border)' : 'none'};"
            >
              <div style="width:34px; height:34px; border-radius:9px; background:{a.bg}; display:flex; align-items:center; justify-content:center; flex:none;">
                <Icon name={a.icon} size={16} color={a.tone} />
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:13px; color:var(--df-text-dark); line-height:1.5;">{a.text}</div>
                <div style="font-size:11px; color:var(--df-text-muted); margin-top:2px;">{a.time}</div>
              </div>
            </div>
          {/each}
        </Panel>
        <div style="height:8px;"></div>
      </div>
    </div>
  {/if}
</LoadGate>
