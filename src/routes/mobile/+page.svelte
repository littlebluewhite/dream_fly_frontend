<script lang="ts">
  /* 首頁 tab。home.jsx HomeScreen (51-156)。
   * 漸層 hero（問候 + 通知鈴 + 購物車）、下一堂課、免費試上 banner、課程分類、最新公告、熱門課程。
   * setTab(...) → goto 對應路由；nav.sheet('cart') → overlay.sheet；nav.push('trial') → overlay.push；
   * 課程卡 onOpen → overlay.sheet('course',{course})；onAdd → cart.add + toast。
   * 原型 <StatusBar light/> 改為 hero 內 .m-top-inset spacer（比照 HeroHeader 慣例）。
   * Legacy Svelte（無 runes）、繁體中文文案、mock-only。
   *
   * 資料改由 getHome()(mock-API 接縫)非同步取得:onMount 進三態閘門
   * (loading/error/ready);cart/overlay/unread 等既有 store 互動不動。下一堂課
   * 卡的「明日」/「19:00」原是頁面硬編字面,與 myCourses[0].next 描述同一件事
   * 卻各自寫一次,改為拆解 next.next 衍生,不留雙來源。 */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { ErrorState, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import SectionTitle from '$lib/components/mobile/SectionTitle.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import CourseCard from '$lib/mobile/components/CourseCard.svelte';
  import type { Course } from '$lib/mobile/data';
  import { createLoadGate } from '$lib/load-gate';
  import { getHome, type MobileHomeData } from '$lib/mobile/api';
  import { overlay, cart, toasts, unread } from '$lib/mobile/stores';
  import { profile as profileStore } from '$lib/mobile/stores';

  /* category taxonomy — home.jsx CATS (6-13). */
  const CATS: { key: string; label: string; icon: string }[] = [
    { key: '幼兒體操', label: '幼兒', icon: 'baby' },
    { key: '兒童基礎', label: '兒童', icon: 'rotate-cw' },
    { key: '競技啦啦隊', label: '啦啦隊', icon: 'sparkles' },
    { key: '競技體操', label: '競技', icon: 'medal' },
    { key: '成人體操', label: '成人', icon: 'dumbbell' },
    { key: '跑酷', label: '跑酷', icon: 'flame' }
  ];

  let data: MobileHomeData | null = null;
  const gate = createLoadGate({
    fetch: getHome,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  $: profile = $profileStore;
  $: catalog = data?.catalog ?? [];
  $: announce = data?.announce ?? [];
  $: myCourses = data?.myCourses ?? [];
  $: hot = catalog.filter((c) => c.hot).concat(catalog.filter((c) => !c.hot)).slice(0, 4);
  // 下一堂課卡的日期/時間:與 mine 頁課程卡同一欄位(next.next,如「明日 19:00」)
  // 同源拆解,不再各自硬編一次。載入完成前 myCourses 仍是 [],用可選鏈防呆。
  // Task 19:真後端的 EnrolledCourse.next 目前一律是空字串(member/api.ts 的
  // getMine() P2——後端無法誠實推導「下一堂」相對時間,見該檔案註解),空字串
  // split(' ') 只會產生 1 個元素、第二個變數解構成 undefined——這裡多一層「有
  // 值才顯示」的空集合守衛,同整張卡「零報名時不顯示」的既有慣例,避免顯示一個
  // 內容殘缺的日期卡。
  $: next = myCourses[0]?.next ? myCourses[0] : undefined;
  $: [nextDay, nextTime] = next ? next.next.split(' ') : ['', ''];

  function addToCart(c: Course) {
    const r = cart.add(c);
    toasts.notify(
      r === 'waitlisted' ? 'info' : 'success',
      r === 'waitlisted' ? '已加入候補' : '已加入購物車',
      c.name
    );
  }
</script>

<LoadGate {gate}>
  <div class="m-top-inset df-scroll df-view" data-testid="mobile-home-skeleton" style="padding:18px; display:flex; flex-direction:column; gap:18px;" slot="loading">
    <div style="display:flex; align-items:center; gap:12px;">
      <Skeleton w={44} h={44} r={999} />
      <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
        <Skeleton w="40%" h={12} />
        <Skeleton w="60%" h={16} />
      </div>
    </div>
    <SkelCard><Skeleton w="100%" h={72} r={12} /></SkelCard>
    <SkelCard><Skeleton w="100%" h={72} r={12} /></SkelCard>
    <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
      {#each [0, 1, 2, 3, 4, 5] as i (i)}
        <Skeleton w="100%" h={64} r={15} />
      {/each}
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      {#each [0, 1, 2] as i (i)}
        <SkelCard padding={0}>
          <div style="display:flex; align-items:center; gap:13px; padding:13px 14px;">
            <Skeleton w={52} h={52} r={13} />
            <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
              <Skeleton w="60%" h={15} />
              <Skeleton w="40%" h={12} />
            </div>
          </div>
        </SkelCard>
      {/each}
    </div>
  </div>

  <div class="m-top-inset df-scroll df-view" style="padding:16px;" slot="error">
    <Card padding={0}><ErrorState onRetry={gate.refresh} /></Card>
  </div>

  <div style="flex:none; background:linear-gradient(125deg, var(--df-primary), var(--df-primary-dark)); color:#fff;">
    <div class="m-top-inset"></div>
    <div style="padding:2px 18px 18px;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:11px;">
          <Avatar name={profile.initial} size="md" color="rgba(255,255,255,0.22)" />
          <div>
            <div style="font-size:12.5px; opacity:0.85;">早安，歡迎回來 👋</div>
            <div style="font-size:18px; font-weight:800; font-family:var(--df-font-heading);">{profile.name}</div>
          </div>
        </div>
        <div style="display:flex; gap:9px;">
          <HeaderIcon icon="bell" light badge={$unread} label="通知" onClick={() => goto('/mobile/notifications')} />
          <HeaderIcon icon="shopping-cart" light badge={$cart.reduce((s, c) => s + c.qty, 0)} label="購物車" onClick={() => overlay.sheet('cart')} />
        </div>
      </div>
    </div>
  </div>

  <div class="df-scroll df-view">
    <div style="padding:18px; display:flex; flex-direction:column; gap:22px;">
      <!-- next class hero — 空集合守衛:零報名會員(myCourses 空)時 next 為
        undefined,整卡不渲染(mine 頁已有「尚未報名任何課程」MEmpty,首頁不重複)。 -->
      {#if next}
        <button
          on:click={() => goto('/mobile/mine')}
          class="df-tapscale"
          style="text-align:left; border:none; cursor:pointer; border-radius:16px; padding:0; background:transparent; margin-top:-52px;"
        >
          <div style="background:#fff; border-radius:16px; padding:16px; box-shadow:var(--df-shadow-card); border:1px solid var(--df-border);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <span style="font-size:12px; font-weight:700; letter-spacing:1px; color:var(--df-primary);">下一堂課</span>
              <Badge tone="success" dot>可報到</Badge>
            </div>
            <div style="display:flex; align-items:center; gap:13px;">
              <div style="text-align:center; flex:none; background:var(--df-primary-bg); border-radius:12px; padding:9px 13px;">
                <div style="font-size:11px; color:var(--df-primary); font-weight:600;">{nextDay}</div>
                <div style="font-size:19px; font-weight:800; color:var(--df-primary); font-family:var(--df-font-heading);">{nextTime}</div>
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:15.5px; font-weight:700; color:var(--df-ink);">{next.name}</div>
                <div style="font-size:12.5px; color:var(--df-text-light); margin-top:3px; display:flex; align-items:center; gap:5px;">
                  <Icon name="map-pin" size={13} color="var(--df-text-muted)" />{next.room} · {next.coach} 教練
                </div>
              </div>
              <Icon name="chevron-right" size={20} color="var(--df-text-muted)" />
            </div>
          </div>
        </button>
      {/if}

      <!-- free trial banner -->
      <button
        on:click={() => overlay.push('trial')}
        class="df-tapscale"
        style="text-align:left; border:none; cursor:pointer; border-radius:16px; padding:0; background:transparent;"
      >
        <div
          style="position:relative; overflow:hidden; border-radius:16px; padding:16px; color:#fff;
            background:linear-gradient(120deg, var(--df-ink), var(--df-ink-soft)); box-shadow:var(--df-shadow-card);"
        >
          <div style="position:absolute; top:-30px; right:-24px; width:130px; height:130px; border-radius:50%; background:radial-gradient(circle, rgba(255,215,0,.30), transparent 70%);"></div>
          <div style="position:relative; display:flex; align-items:center; gap:14px;">
            <div style="width:50px; height:50px; border-radius:14px; background:var(--df-accent); display:flex; align-items:center; justify-content:center; flex:none;">
              <Icon name="sparkles" size={26} color="var(--df-ink)" />
            </div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:7px;">
                <span style="font-size:16px; font-weight:800; font-family:var(--df-font-heading);">預約免費試上</span><Badge tone="accent" solid>免費</Badge>
              </div>
              <div style="font-size:12.5px; opacity:0.85; margin-top:3px;">15 分鐘評估 + 60 分鐘體驗，先試再決定</div>
            </div>
            <div style="width:34px; height:34px; border-radius:999px; background:rgba(255,255,255,0.14); display:flex; align-items:center; justify-content:center; flex:none;">
              <Icon name="arrow-right" size={18} color="#fff" />
            </div>
          </div>
        </div>
      </button>

      <!-- categories -->
      <div>
        <SectionTitle action="課程介紹" onAction={() => goto('/mobile/courses')}>課程分類</SectionTitle>
        <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
          {#each CATS as cat (cat.key)}
            <button
              on:click={() => goto('/mobile/courses')}
              class="df-tapscale"
              style="display:flex; flex-direction:column; align-items:center; gap:6px; border:none; background:transparent; cursor:pointer; padding:0;"
            >
              <div style="width:50px; height:50px; border-radius:15px; background:var(--df-primary-bg); display:flex; align-items:center; justify-content:center;">
                <Icon name={cat.icon} size={23} color="var(--df-primary)" />
              </div>
              <span style="font-size:11px; color:var(--df-text-dark); font-weight:500;">{cat.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- announcements (horizontal) -->
      <div>
        <SectionTitle>最新公告</SectionTitle>
        <div class="df-hide-scrollbar" style="display:flex; gap:12px; overflow-x:auto; margin:0 -18px; padding:0 18px 4px;">
          {#each announce as a, i (i)}
            <div style="flex:none; width:232px; background:#fff; border:1px solid var(--df-border); border-radius:14px; padding:14px; box-shadow:var(--df-shadow-card);">
              <div style="display:flex; align-items:center; gap:9px; margin-bottom:9px;">
                <div style="width:34px; height:34px; border-radius:10px; background:{a.bg}; display:flex; align-items:center; justify-content:center; flex:none;">
                  <Icon name={a.icon} size={18} color={a.tone} />
                </div>
                <span style="font-size:11.5px; color:var(--df-text-muted);">{a.time}</span>
              </div>
              <div style="font-size:14px; font-weight:700; color:var(--df-ink); margin-bottom:4px;">{a.title}</div>
              <div style="font-size:12.5px; color:var(--df-text-light); line-height:1.55;">{a.body}</div>
            </div>
          {/each}
        </div>
      </div>

      <!-- hot courses -->
      <div>
        <SectionTitle action="看全部" onAction={() => goto('/mobile/courses')}>熱門課程</SectionTitle>
        <div style="display:flex; flex-direction:column; gap:12px;">
          {#each hot as c (c.id)}
            <CourseCard {c} onOpen={() => overlay.sheet('course', { course: c })} onAdd={() => addToCart(c)} />
          {/each}
        </div>
      </div>
      <div style="height:8px;"></div>
    </div>
  </div>
</LoadGate>
