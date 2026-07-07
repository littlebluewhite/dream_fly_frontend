<script lang="ts">
  /* 教練 · 我的學員。port coach.jsx CoachStudentsScreen (165-210)。
   * onBell → overlay.sheet('notif')。
   *
   * Task 20：改讀真 getStudents()(coach/api.ts，Task 19：GET /coaches/me/students，
   * 只回這位教練名下的學員)，取代舊 mock 對「全體 MEMBERS 用姓名字串比對 coach
   * 欄位」的克難篩選——真資料本身已是「我的學員」，不需要再篩一次。真實 Student
   * 型別(coach/data.ts)沒有 age/parent/phone 欄位，也沒有可編輯的多技能評量表
   * （後端只有單一 skill/pct，且為 P2 佔位值），故：
   *  1. 卡片頭部拿掉「{age} 歲」（無對應欄位）。
   *  2. 舊「更新評量」(可調整技能分數) 與「聯絡家長」(無 phone 可打) 兩個動作—
   *     前者純本地假調整、後者無資料可用 — 一併移除，換成桌面 StudentCard 真正
   *     提供的兩個動作：寫評語(POST /report-cards)、發證書(POST /certificates)
   *     （Task 13，integration-contract.md §3.22）。原本的 StudentSkillsSheet 改名
   *     為 StudentActionSheet，改渲染這兩個真表單。 */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import SearchField from '$lib/mobile-admin/components/SearchField.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import { overlay, coachNotifs, coachUnreadCount, closeNotifAfterReadAll } from '$lib/mobile-admin/stores';
  import { getStudents, type MStudentsData } from '$lib/mobile-admin/api';
  import { LEVEL_TINT } from '$lib/coach/data';
  import type { Student } from '$lib/coach/data';

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let students: Student[] = [];
  let q = '';

  function load() {
    phase = 'loading';
    getStudents()
      .then((d: MStudentsData) => { students = d.students; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  const onBell = () => overlay.sheet('notif', { notifs: $coachNotifs, onReadAll: () => closeNotifAfterReadAll(coachNotifs.markAllRead) });
  const openReportCard = (student: Student) => overlay.sheet('studentAction', { student, mode: 'reportCard' });
  const openCertificate = (student: Student) => overlay.sheet('studentAction', { student, mode: 'certificate' });

  $: list = q
    ? students.filter((m) => (m.name + m.cls + m.skill).toLowerCase().includes(q.toLowerCase()))
    : students;
</script>

{#if phase === 'ready'}
<ScreenHeader title="我的學員" sub={students.length + ' 位學員'}>
  <HeaderIcon slot="right" icon="bell" badge={$coachUnreadCount} label="通知" onClick={onBell} />
</ScreenHeader>

<div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border);">
  <SearchField value={q} onChange={(v) => (q = v)} placeholder="搜尋學員姓名、班級…" />
</div>

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
    {#if list.length === 0}
      <MEmpty icon="search-x" title="找不到符合的學員" />
    {:else}
      {#each list as m (m.user_id)}
        {@const tint = LEVEL_TINT[m.level]}
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:16px; box-shadow:var(--df-shadow-card); padding:16px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:13px;">
            <Avatar name={m.initial} size="md" color={m.color} />
            <div style="flex:1; min-width:0;">
              <div style="font-size:15.5px; font-weight:700; color:var(--df-ink);">{m.name}</div>
              <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{m.cls}</div>
            </div>
            <span style="background:{tint.bg}; color:{tint.fg}; font-size:12px; font-weight:700; padding:3px 10px; border-radius:999px; flex:none;">{m.level}</span>
          </div>
          <div style="margin-bottom:13px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;"><span style="color:var(--df-text-light);">{m.skill}熟練度</span><span style="font-weight:700; color:var(--df-text-dark);">{m.pct}%</span></div>
            <MiniBar value={m.pct} tone={m.pct >= 85 ? 'success' : 'primary'} height={6} />
          </div>
          <div style="display:flex; align-items:center; gap:7px; margin-bottom:13px; font-size:12px; color:var(--df-text-light);">
            <Icon name="calendar-check" size={14} color={m.att < 75 ? 'var(--df-error)' : 'var(--df-success)'} />
            出席率 <span style="font-weight:700; color:{m.att < 75 ? 'var(--df-error)' : 'var(--df-text-dark)'};">{m.att}%</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button
              on:click={() => openReportCard(m)}
              class="df-tapscale"
              style="flex:1; height:38px; border-radius:10px; border:1.5px solid var(--df-border); background:#fff; color:var(--df-text-dark); font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;"
            ><Icon name="clipboard-list" size={15} color="var(--df-primary)" />寫評語</button>
            <button
              on:click={() => openCertificate(m)}
              class="df-tapscale"
              style="flex:1; height:38px; border-radius:10px; border:1.5px solid var(--df-border); background:#fff; color:var(--df-text-dark); font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;"
            ><Icon name="award" size={15} color="var(--df-primary)" />發證書</button>
          </div>
        </div>
      {/each}
    {/if}
    <div style="height:8px;"></div>
  </div>
</div>
{:else if phase === 'error'}
  <Card padding={0}><ErrorState onRetry={load} /></Card>
{:else}
  <div class="df-scroll df-view" data-testid="students-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:12px;">
    {#each [0, 1, 2] as i (i)}
      <SkelCard><Skeleton w="100%" h={170} r={16} /></SkelCard>
    {/each}
  </div>
{/if}
