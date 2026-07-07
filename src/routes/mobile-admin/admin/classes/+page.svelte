<script lang="ts">
  /* 管理員 · 課程管理。admin.jsx ClassesScreen (202)。
   * 清單由 $classes store 提供;tap → sheet('class'),新增 → sheet('classForm',{k:null})。
   *
   * 資料改由 hydrateOps()(mock-API 接縫)非同步水合 $classes store,三態閘門
   * (loading/error/ready);hydrated 守衛防止第二次進頁的 fetch 覆寫 overlay 新增
   * /編輯,refreshOps() 供 ErrorState 重試(不受守衛短路)。unmount 後解析的
   * in-flight fetch 由 createLoadGate($lib/load-gate)內建的 generation/destroy
   * 機制擋下,不再需要頁面自帶的 alive 旗標。 */
  import { onMount } from 'svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import SearchField from '$lib/mobile-admin/components/SearchField.svelte';
  import FilterChips from '$lib/mobile-admin/components/FilterChips.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import LevelBadge from '$lib/mobile-admin/components/LevelBadge.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import { overlay, classes, adminNotifs, adminUnreadCount, toasts, hydrateOps, refreshOps } from '$lib/mobile-admin/stores';
  import { STATUS_TONE } from '$lib/mobile-admin/data';
  import { createLoadGate } from '$lib/load-gate';

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  const gate = createLoadGate({
    fetch: hydrateOps,
    refresh: refreshOps
  });
  onMount(() => {
    gate.load();
  });

  let cat = '全部';
  let q = '';
  const cats = ['全部', '幼兒體操', '兒童基礎', '競技啦啦隊', '競技體操', '成人體操', '跑酷'];

  function openNotif() {
    overlay.sheet('notif', { notifs: $adminNotifs, onReadAll: () => { adminNotifs.markAllRead(); toasts.notify('success', '已全部標為已讀', ''); overlay.closeSheet(); } });
  }

  $: list = $classes
    .filter((k) => cat === '全部' || k.cat === cat)
    .filter((k) => !q || (k.name + k.coach).toLowerCase().includes(q.toLowerCase()));
</script>

{#if $gate === 'ready'}

<ScreenHeader title="課程管理" sub={$classes.length + ' 個開課班級 · 本季招生中'}>
  <div slot="right" style="display:flex; gap:8px;">
    <HeaderIcon icon="plus" label="新增班級" onClick={() => overlay.sheet('classForm', { k: null })} />
    <HeaderIcon icon="bell" badge={$adminUnreadCount} label="通知" onClick={openNotif} />
  </div>
</ScreenHeader>

<div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border); display:flex; flex-direction:column; gap:11px;">
  <SearchField value={q} onChange={(v) => (q = v)} placeholder="搜尋班級、教練…" />
  <FilterChips items={cats} value={cat} onChange={(k) => (cat = k)} />
</div>

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
    {#if list.length === 0}
      <MEmpty icon="search-x" title="找不到符合的課程" />
    {:else}
      {#each list as k (k.id)}
        {@const full = k.enrolled >= k.cap}
        {@const pct = Math.round((k.enrolled / k.cap) * 100)}
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:16px; box-shadow:var(--df-shadow-card); overflow:hidden;">
          <button
            on:click={() => overlay.sheet('class', { k })}
            class="df-tapscale"
            style="display:block; width:100%; border:none; background:transparent; cursor:pointer; text-align:left; padding:15px 16px 13px;"
          >
            <div style="display:flex; align-items:center; gap:7px; margin-bottom:8px;">
              <LevelBadge level={k.level} />
              <Badge tone={(STATUS_TONE[k.status] || 'neutral') as Tone} solid={k.status === '額滿'}>{k.status}</Badge>
            </div>
            <div style="font-size:16.5px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-heading);">{k.name}</div>
            <div style="display:flex; flex-wrap:wrap; gap:5px 14px; margin-top:9px;">
              {#each [['user', k.coach + ' 教練'], ['calendar-days', k.day + ' · ' + k.time], ['map-pin', k.room]] as [ic, txt] (txt)}
                <span style="display:flex; align-items:center; gap:5px; font-size:12.5px; color:var(--df-text-light);">
                  <Icon name={ic} size={13} color="var(--df-text-muted)" />{txt}
                </span>
              {/each}
            </div>
            <div style="margin-top:12px;">
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                <span style="color:var(--df-text-light);">報名人數</span>
                <span style="font-weight:700; color:{full ? 'var(--df-warning)' : 'var(--df-text-dark)'};">{k.enrolled} / {k.cap} 人</span>
              </div>
              <MiniBar value={pct} tone={full ? 'warning' : 'primary'} height={6} />
            </div>
          </button>
          <div style="display:flex; gap:8px; padding:0 16px 14px;">
            <button
              on:click={() => toasts.notify('info', k.name, '顯示班級學員名單(' + k.enrolled + ' 人)。')}
              class="df-tapscale"
              style="flex:1; height:38px; border-radius:10px; border:1.5px solid var(--df-border); background:#fff;
                color:var(--df-text-dark); font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;"
            >
              <Icon name="users" size={15} color="var(--df-text-light)" />學員
            </button>
            <button
              on:click={() => overlay.sheet('classForm', { k })}
              class="df-tapscale"
              style="flex:1; height:38px; border-radius:10px; border:none; background:var(--df-primary); color:#fff;
                font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;"
            >
              <Icon name="pencil-line" size={15} color="#fff" />編輯
            </button>
          </div>
        </div>
      {/each}
    {/if}
    <div style="height:8px;"></div>
  </div>
</div>
{:else if $gate === 'error'}
  <Card padding={0}><ErrorState onRetry={gate.refresh} /></Card>
{:else}
  <div class="df-scroll df-view" data-testid="classes-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:12px;">
    {#each [0, 1, 2] as i (i)}
      <SkelCard><Skeleton w="100%" h={170} r={16} /></SkelCard>
    {/each}
  </div>
{/if}
