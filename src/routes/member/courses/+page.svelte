<script lang="ts">
  /* 課程介紹 (Courses) — catalog browse with tab + category filters, search,
   * add-to-cart / waitlist, and a course-detail dialog. Ported from the
   * prototype's Courses + CourseDetail (client/views.jsx). */
  import { onMount } from 'svelte';
  import { Tabs, FilterChip, Card, Badge, Button, Icon, EmptyState, Skeleton, SkelCard, ErrorState, LoadGate } from '$lib/components/ui';
  import CourseDetailDialog from '$lib/member/components/CourseDetailDialog.svelte';
  import { LEVEL_TONE } from '$lib/member/data';
  import type { CatalogCourse } from '$lib/public/adapters';
  import { createLoadGate } from '$lib/load-gate';
  import { getCourses, type CoursesData } from '$lib/member/api';
  import { cart, search, toasts, waitlist, hydrateWaitlist, joinWaitlist, joinWaitlistErrorMessage } from '$lib/member/stores';

  let tab = 'all';
  let filter = '全部';
  let detail: CatalogCourse | null = null;
  let data: CoursesData | null = null;

  const gate = createLoadGate({
    fetch: getCourses,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
    // best-effort：候補狀態只影響「候補」按鈕要不要顯示已候補，失敗就先當作
    // 尚未候補，仍可手動點擊候補（後端 409 會擋掉真的重複）。
    void hydrateWaitlist().catch(() => {});
  });

  $: waitlistedIds = new Set($waitlist.map((w) => w.course_id));

  const cats = ['全部', '幼兒體操', '兒童基礎', '競技啦啦隊', '競技體操', '成人體操', '跑酷'];

  $: tabs = data
    ? [
        { value: 'all', label: '全部課程', count: data.catalog.length },
        { value: 'hot', label: '熱門', count: data.catalog.filter((c) => c.hot).length }
      ]
    : [];

  $: list = data
    ? data.catalog
        .filter((c) => filter === '全部' || c.cat === filter)
        .filter((c) => tab === 'all' || c.hot)
        .filter(
          (c) =>
            !$search ||
            (c.name + c.coach + c.cat).toLowerCase().includes($search.toLowerCase())
        )
    : [];

  async function addToCart(c: CatalogCourse) {
    if (c.spots === 0 && waitlistedIds.has(c.id)) return; // already joined — the button is disabled, but guard here too (belt-and-suspenders against a duplicate POST /waitlist)
    const r = cart.add(c);
    if (r === 'waitlisted') {
      try {
        await joinWaitlist(c.id);
        toasts.notify('info', '已加入候補', c.name + ' — 有名額時將通知您。');
      } catch (err) {
        toasts.notify('error', '加入候補失敗', joinWaitlistErrorMessage(err));
      }
    } else if (r === 'bumped') toasts.notify('info', '已更新數量', c.name + ' 數量 +1。');
    else toasts.notify('success', '已加入購物車', c.name + ' — 前往購物車完成報名。');
  }
</script>

<LoadGate {gate}>
  <div class="df-view" data-testid="courses-skeleton" slot="loading">
    <Skeleton w={320} h={36} r={9} style="margin-bottom:18px" />
    <div style="display:flex; gap:8px; margin-bottom:22px; flex-wrap:wrap">
      {#each [0, 1, 2, 3] as i (i)}
        <Skeleton w={72} h={32} r={16} />
      {/each}
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px,1fr)); gap:18px">
      {#each [0, 1, 2, 3] as i (i)}
        <SkelCard><Skeleton w="100%" h={240} r={12} /></SkelCard>
      {/each}
    </div>
  </div>

  <div class="df-view">
    <Tabs {tabs} bind:value={tab} style="margin-bottom:18px" />
    <div style="display:flex; gap:8px; margin-bottom:22px; flex-wrap:wrap">
      {#each cats as f (f)}
        <FilterChip selected={filter === f} on:click={() => (filter = f)}>{f}</FilterChip>
      {/each}
    </div>

    {#if list.length === 0}
      <Card>
        <EmptyState
          icon="search-x"
          title="找不到符合的課程"
          body={$search
            ? `沒有與「${$search}」相符的課程，試試其他關鍵字或切換分類。`
            : '這個分類目前沒有開放中的課程,看看其他分類吧。'}
        />
      </Card>
    {/if}

    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px,1fr)); gap:18px">
      {#each list as c (c.id)}
        {@const full = c.spots === 0}
        {@const joined = waitlistedIds.has(c.id)}
        <Card padding={0} hoverable style="overflow:hidden; display:flex; flex-direction:column">
          <button
            type="button"
            class="course-head"
            on:click={() => (detail = c)}
            aria-label={`查看 ${c.name} 詳情`}
          >
            <!-- CatalogCourse(public seam)無 icon 欄位(見 $lib/public/adapters 的
                 courseToCartItem 對此的既有處理慣例)，卡頭一律用同一個預設圖示。 -->
            <div class="course-icon"><Icon name="sparkles" size={30} color="var(--df-primary)" /></div>
            {#if c.hot}
              <span style="position:absolute; top:12px; right:12px"><Badge tone="accent" solid>熱門</Badge></span>
            {/if}
            {#if full}
              <span style="position:absolute; top:12px; left:12px"><Badge tone="warning">{joined ? '已候補' : '候補'}</Badge></span>
            {/if}
          </button>
          <div style="padding:18px; flex:1; display:flex; flex-direction:column">
            <div style="display:flex; gap:6px; margin-bottom:10px">
              <Badge tone={LEVEL_TONE[c.level]}>{c.level}</Badge>
              <Badge tone="neutral">{c.age}</Badge>
            </div>
            <h3 style="margin:0 0 8px">
              <button type="button" class="course-title" on:click={() => (detail = c)}>{c.name}</button>
            </h3>
            <div
              style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--df-text-light); margin-bottom:16px"
            >
              <Icon name="calendar-days" size={15} color="var(--df-text-muted)" />{c.days}
            </div>
            <div
              style="margin-top:auto; display:flex; align-items:center; justify-content:space-between"
            >
              <div style="display:flex; align-items:baseline; gap:3px">
                <span style="font-size:13px; color:var(--df-text-light)">NT$</span>
                <span
                  style="font-family:var(--df-font-heading); font-size:22px; font-weight:800; color:var(--df-ink)"
                  >{c.price.toLocaleString()}</span
                >
                <span style="font-size:13px; color:var(--df-text-light)">/季</span>
              </div>
              <Button size="sm" variant={full ? 'secondary' : 'primary'} disabled={full && joined} on:click={() => addToCart(c)}>
                <Icon name={full ? (joined ? 'check' : 'clock') : 'plus'} size={15} />
                {full ? (joined ? '已候補' : '候補') : '加入'}
              </Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>

    <CourseDetailDialog course={detail} onClose={() => (detail = null)} onAdd={addToCart} />
  </div>

  <div class="df-view" slot="error"><Card padding={0}><ErrorState onRetry={gate.refresh} /></Card></div>
</LoadGate>

<style>
  .course-head {
    height: 104px;
    background: linear-gradient(120deg, var(--df-primary-bg), #fff);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    border: none;
    border-bottom: 1px solid var(--df-border);
    cursor: pointer;
    padding: 0;
    width: 100%;
  }
  .course-icon {
    width: 58px;
    height: 58px;
    border-radius: 15px;
    background: #fff;
    box-shadow: var(--df-shadow-soft);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .course-title {
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    font-size: 17px;
    font-weight: 700;
    color: var(--df-ink);
  }
</style>
