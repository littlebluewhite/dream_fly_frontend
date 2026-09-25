<script lang="ts">
  /* 管理員 · 課程管理。admin.jsx ClassesScreen (202)。
   * 清單由 $classes store 提供;tap → sheet('class'),新增 → sheet('classForm',{k:null})。
   *
   * 資料改由 hydrateOps()(mock-API 接縫)非同步水合 $classes store,三態閘門
   * (loading/error/ready);hydrated 守衛防止第二次進頁的 fetch 覆寫 overlay 新增
   * /編輯,refreshOps() 供 ErrorState 重試(不受守衛短路)。unmount 後解析的
   * in-flight fetch 由 createLoadGate($lib/load-gate)內建的 generation/destroy
   * 機制擋下,不再需要頁面自帶的 alive 旗標。
   *
   * Task 20：新增/編輯改接真 POST /courses、PATCH /courses/{id}（復用桌面
   * createCourse/updateCourse/mapCourse，經 $lib/mobile-admin/api 薄層）——
   * buildCourseBody()（course-request.ts，桌面 Task 8 piece 1 既有的請求體組裝
   * 純函式，兩邊 ClassRow/Coach 形狀相同，直接沿用不重寫）組出共用欄位；openEdit
   * 統一收斂「班級卡編輯鈕」與「班級詳情 sheet 的編輯鈕」兩個入口，兩者都需要真正
   * 呼叫後端，不能其中一條路徑漏接。R12 起寫入經 store 的 addCourse/saveCourse
   * 動詞(內部 buildCourseBody + 寫入成功後 await refreshOps() 整包重抓)，toast 在
   * 動詞 resolve 後才出現。header 顯示後端 total(只抓第 1 頁)，超過一頁時搜尋區
   * 提示搜尋範圍。 */
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
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { overlay, classes, coaches, adminUnreadCount, toasts, hydrateOps, refreshOps, openAdminNotif, addCourse, saveCourse, opsPages, searchCapHint } from '$lib/mobile-admin/stores';
  import { STATUS_TONE } from '$lib/mobile-admin/data';
  import { createLoadGate } from '$lib/load-gate';
  import type { ClassRow } from '$lib/mobile-admin/data';
  import { CATS } from '$lib/admin/data';
  import { filterClasses } from '$lib/admin/components/classes-filter';
  import { apiErrorText } from '$lib/api/error-text';
  import type { IconName } from '$lib/icon-registry';
  import { classFill } from '$lib/domain/class-detail';

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
  const cats = ['全部', ...CATS];

  function openNew() {
    overlay.sheet('classForm', { k: null, coaches: $coaches, onSave: save });
  }
  function openEdit(k: ClassRow) {
    overlay.sheet('classForm', { k, coaches: $coaches, onSave: save });
  }
  function openDetail(k: ClassRow) {
    overlay.sheet('class', { k, onEdit: openEdit });
  }

  // 422 驗證 / 403 權限 / 409 衝突 → 對應的繁中錯誤提示；其餘由 apiErrorText 給通用
  // 訊息（查表引擎共用 $lib/api/error-text，per-entity 文案表留在頁），同桌面
  // classes/+page.svelte 慣例。
  const COURSE_ERROR_TEXT: Record<number, string> = {
    422: '輸入資料不符規則，請確認後再試。',
    403: '沒有權限執行此操作。',
    409: '課程名稱或代碼已存在，請調整後再試。'
  };

  async function save(updated: ClassRow, durationMinutes: number, isNew: boolean) {
    try {
      if (isNew) {
        await addCourse(updated, durationMinutes);
        toasts.notify('success', '已新增班級', `「${updated.name}」已建立。`);
      } else {
        await saveCourse(updated, durationMinutes);
        toasts.notify('success', '已儲存課程', `「${updated.name}」已更新。`);
      }
    } catch (e) {
      toasts.notify('error', isNew ? '新增失敗' : '儲存失敗', apiErrorText(e, COURSE_ERROR_TEXT));
    }
  }

  // Round 2 C3:分類/搜尋改共用桌面 classes-filter.ts 的 filterClasses()(兩邊
  // ClassRow 結構相同)。Task 2:上方 cats chips 改用桌面 admin/data.ts 的 CATS
  // 單一來源(['全部', ...CATS]),分類順序與桌面一致。
  $: list = filterClasses($classes, { cat, query: q });
  $: capHint = searchCapHint($opsPages.classes);

  // 班級卡片的三顆 icon meta rows(教練/日期時段/教室)——原模板內聯 each 陣列
  // hoist 為純函式並標型別(依 k 逐卡片而異，不是單一靜態陣列)。
  function classMetaRows(k: ClassRow): [IconName, string][] {
    return [
      ['user', k.coach + ' 教練'],
      ['calendar-days', k.day + ' · ' + k.time],
      ['map-pin', k.room]
    ];
  }
</script>

<LoadGate {gate}>
  <div class="df-scroll df-view" data-testid="classes-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:12px;" slot="loading">
    {#each [0, 1, 2] as i (i)}
      <SkelCard><Skeleton w="100%" h={170} r={16} /></SkelCard>
    {/each}
  </div>

  <ScreenHeader title="課程管理" sub={$opsPages.classes.total + ' 個開課班級 · 本季招生中'}>
    <div slot="right" style="display:flex; gap:8px;">
      <HeaderIcon icon="plus" label="新增班級" onClick={openNew} />
      <HeaderIcon icon="bell" badge={$adminUnreadCount} label="通知" onClick={openAdminNotif} />
    </div>
  </ScreenHeader>

  <div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border); display:flex; flex-direction:column; gap:11px;">
    <SearchField value={q} onChange={(v) => (q = v)} placeholder="搜尋班級、教練…" />
    {#if capHint}<div style="font-size:11.5px; color:var(--df-text-muted); margin-top:-4px;">{capHint}</div>{/if}
    <FilterChips items={cats} value={cat} onChange={(k) => (cat = k)} />
  </div>

  <div class="df-scroll df-view">
    <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
      {#if list.length === 0}
        <MEmpty icon="search-x" title="找不到符合的課程" />
      {:else}
        {#each list as k (k.id)}
          {@const fill = classFill(k.enrolled, k.cap)}
          <div style="background:#fff; border:1px solid var(--df-border); border-radius:16px; box-shadow:var(--df-shadow-card); overflow:hidden;">
            <button
              on:click={() => openDetail(k)}
              class="df-tapscale"
              style="display:block; width:100%; border:none; background:transparent; cursor:pointer; text-align:left; padding:15px 16px 13px;"
            >
              <div style="display:flex; align-items:center; gap:7px; margin-bottom:8px;">
                <LevelBadge level={k.level} />
                <Badge tone={(STATUS_TONE[k.status] || 'neutral') as Tone} solid={k.status === '額滿'}>{k.status}</Badge>
              </div>
              <div style="font-size:16.5px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-heading);">{k.name}</div>
              <div style="display:flex; flex-wrap:wrap; gap:5px 14px; margin-top:9px;">
                {#each classMetaRows(k) as [ic, txt] (txt)}
                  <span style="display:flex; align-items:center; gap:5px; font-size:12.5px; color:var(--df-text-light);">
                    <Icon name={ic} size={13} color="var(--df-text-muted)" />{txt}
                  </span>
                {/each}
              </div>
              <div style="margin-top:12px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                  <span style="color:var(--df-text-light);">報名人數</span>
                  <span style="font-weight:700; color:{fill.full ? 'var(--df-warning)' : 'var(--df-text-dark)'};">{k.enrolled} / {k.cap} 人</span>
                </div>
                <MiniBar value={fill.pct} tone={fill.full ? 'warning' : 'primary'} height={6} />
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
                on:click={() => openEdit(k)}
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
</LoadGate>
