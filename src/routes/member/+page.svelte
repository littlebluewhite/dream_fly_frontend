<script lang="ts">
  /* Dream Fly — 會員中心 · 總覽 Dashboard. Visual output unchanged from the
   * prototype; the bare consts now load through the async api.ts seam
   * (getDashboard) behind the $lib/load-gate three-state gate, so the
   * loading + error UI is ready for when fetch replaces the mock. */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Badge, Button, ProgressBar, Icon, Skeleton, SkelCard, ErrorState } from '$lib/components/ui';
  import { createLoadGate } from '$lib/load-gate';
  import { getDashboard, type DashboardData } from '$lib/member/api';

  let data: DashboardData | null = null;
  const gate = createLoadGate({
    fetch: getDashboard,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });
</script>

{#if $gate === 'ready' && data}
<div class="df-view" style="display:flex;flex-direction:column;gap:22px">
  <!-- Welcome banner -->
  <div
    style="background:linear-gradient(115deg, var(--df-primary) 0%, var(--df-primary-dark) 100%);border-radius:16px;padding:30px 32px;color:#fff;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:18px"
  >
    <div>
      <div style="font-size:14px;opacity:0.85">歡迎回來，</div>
      <div style="font-family:var(--df-font-heading);font-size:30px;font-weight:800;margin:3px 0 8px">{data.me.name} 👋</div>
      <div style="display:flex;align-items:center;gap:8px;font-size:14.5px;opacity:0.92">
        <Icon name="calendar-clock" size={17} color="#fff" />下一堂課：{data.nextClass}
      </div>
    </div>
    <Button variant="accent" on:click={() => goto('/member/schedule')}>
      <span>查看課表</span> <Icon name="arrow-right" size={16} />
    </Button>
  </div>

  <!-- Stat cards -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">
    {#each data.stats as s, i (i)}
      <Card padding={22}>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:13px;color:var(--df-text-light);margin-bottom:10px">{s.label}</div>
            <div style="font-family:var(--df-font-heading);font-size:32px;font-weight:800;color:var(--df-ink);letter-spacing:-0.5px">{s.value}</div>
          </div>
          <div style="width:44px;height:44px;border-radius:11px;background:{s.tint};display:flex;align-items:center;justify-content:center"><Icon name={s.icon} size={22} color={s.color} /></div>
        </div>
      </Card>
    {/each}
  </div>

  <!-- Upcoming + Skills -->
  <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:18px;align-items:start">
    <Card padding={0} style="overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--df-border)">
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">即將到來的課程</h3>
        <button
          on:click={() => goto('/member/mine')}
          style="border:none;background:transparent;color:var(--df-primary);font-weight:600;font-size:13.5px;cursor:pointer;font-family:var(--df-font-body)"
        >查看我的預約 →</button>
      </div>
      <div style="padding:4px 22px 14px">
        {#each data.upcoming as u, i (i)}
          <div
            class="df-rowhover"
            style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:{i < data.upcoming.length - 1 ? '1px solid var(--df-border)' : 'none'}"
          >
            <div style="flex:1;min-width:0">
              <div style="font-size:14.5px;font-weight:600;color:var(--df-text-dark)">{u.name}</div>
              <div style="font-size:13px;color:var(--df-text-light);margin-top:3px">{u.time}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--df-text-light);width:130px"><Icon name="map-pin" size={15} color="var(--df-text-muted)" />{u.venue}</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--df-text-light);width:96px"><Icon name="user" size={15} color="var(--df-text-muted)" />{u.coach}</div>
            <Badge tone={u.status[0]} dot>{u.status[1]}</Badge>
          </div>
        {/each}
      </div>
    </Card>
    <div style="display:flex;flex-direction:column;gap:18px">
      <Card padding={22}>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">技巧熟練度</h3>
          <Badge tone="primary">{data.track}</Badge>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          {#each data.skills as [n, v], i (i)}
            <ProgressBar value={v} showLabel label={n} height={7} tone={v >= 85 ? 'success' : 'primary'} />
          {/each}
        </div>
      </Card>
    </div>
  </div>

  <!-- Announcements -->
  <Card padding={0} style="overflow:hidden">
    <div style="padding:18px 22px;border-bottom:1px solid var(--df-border)">
      <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">場館公告</h3>
    </div>
    <div style="padding:8px 22px 16px">
      {#each data.announce as a, i (i)}
        <div style="display:flex;gap:13px;padding:13px 0;border-bottom:{i < data.announce.length - 1 ? '1px solid var(--df-border)' : 'none'}">
          <div style="width:38px;height:38px;border-radius:10px;background:{a.bg};display:flex;align-items:center;justify-content:center;flex:none"><Icon name={a.icon} size={18} color={a.tone} /></div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">{a.title}</div>
            <div style="font-size:13px;color:var(--df-text-light);margin-top:2px;line-height:1.5">{a.body}</div>
          </div>
          <div style="font-size:12px;color:var(--df-text-muted);white-space:nowrap">{a.time}</div>
        </div>
      {/each}
    </div>
  </Card>
</div>
{:else if $gate === 'error'}
  <div class="df-view"><Card padding={0}><ErrorState onRetry={gate.refresh} /></Card></div>
{:else}
  <div class="df-view" style="display:flex;flex-direction:column;gap:22px">
    <SkelCard padding={30}><Skeleton w="40%" h={26} /></SkelCard>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">
      {#each [0, 1, 2] as i (i)}<SkelCard><Skeleton w="60%" h={28} /></SkelCard>{/each}
    </div>
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:18px;align-items:start">
      <SkelCard padding={0}>{#each [0, 1, 2] as i (i)}<div style="padding:14px 22px"><Skeleton w="70%" h={16} /></div>{/each}</SkelCard>
      <SkelCard>{#each [0, 1, 2, 3] as i (i)}<Skeleton w="100%" h={14} style="margin-bottom:12px" />{/each}</SkelCard>
    </div>
  </div>
{/if}
