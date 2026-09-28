<script lang="ts">
  /* 管理員 · 學員管理。admin.jsx MembersScreen (116) 的行動版接線改版。
   * 清單由 $members store 提供;tap → sheet('member'),新增 → sheet('memberForm',{m:null})。
   *
   * 資料經 opsPageEntry(ops 閘門的頁面進場包,R14 F1)非同步水合 $members store,三態閘門
   * (loading/error/ready);hydrated 守衛防止第二次進頁的 fetch 覆寫 overlay 新增
   * /編輯,ErrorState 重試走 load-gate 的 refresh(不受守衛短路)。寫入由閘門依 load-gate
   * 交來的 isCurrent 把關,卸載後才落地的回應不寫共享 store。
   *
   * Task 20：改讀真 GET /users 形狀(MemberRow 已瘦身，同桌面 admin/data.ts 的
   * MemberAccount)——狀態篩選由舊 3 態(在學中/出席偏低/暫停中，出席率導向)改為
   * 真後端的 is_active 二元旗標(啟用中/已停用)；搜尋拿掉「課程」關鍵字(真資料無
   * 課程欄位)，改為姓名/電話/編號。新增/編輯改接真 POST /users、PATCH /users/{id}
   * （R12 起經 store 的 addMember/saveMember 動詞，內部復用桌面 createMember/
   * updateMember 並在寫入成功後 await refreshOps() 整包重抓），toast 在動詞 resolve
   * 後才出現——和更新後的列表同時。header 顯示後端 total(只抓第 1 頁)，超過一頁時
   * 搜尋區提示搜尋範圍。 */
  import { onMount } from 'svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import SearchField from '$lib/mobile-admin/components/SearchField.svelte';
  import FilterChips from '$lib/mobile-admin/components/FilterChips.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import StatusBadgeM from '$lib/mobile-admin/components/StatusBadgeM.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { overlay, adminUnreadCount, toasts, opsPageEntry, openAdminNotif, addMember, saveMember, opsPages, searchCapHint } from '$lib/mobile-admin/stores';
  import { members } from '$lib/mobile-admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import type { MemberAccount as MemberRow } from '$lib/admin/data';
  import type { CreateMemberBody, UpdateMemberBody } from '$lib/admin/api';
  import { apiErrorMessage } from '$lib/api/error-text';
  import { countByAccountStatus, filterMemberAccounts, type MemberAccountStatusFilter } from '$lib/admin/components/member-account-filter';

  const gate = createLoadGate({ ...opsPageEntry });
  onMount(() => {
    gate.load();
  });

  let tab: MemberAccountStatusFilter = 'all';
  let q = '';

  // 409(email 重複)/422(驗證) 皆已是後端給的繁中使用者可讀文字 → apiErrorMessage
  // 直接透傳 e.message，同桌面 admin/members/+page.svelte 慣例。
  async function createAndRefresh(body: CreateMemberBody) {
    try {
      await addMember(body);
    } catch (e) {
      toasts.notify('error', '新增失敗', apiErrorMessage(e));
      return;
    }
    toasts.notify('success', '已新增學員', `「${body.name}」已建立。`);
  }
  async function updateAndRefresh(id: string, body: UpdateMemberBody) {
    try {
      await saveMember(id, body);
    } catch (e) {
      toasts.notify('error', '儲存失敗', apiErrorMessage(e));
      return;
    }
    toasts.notify('success', '已儲存', `${body.name ?? ''} 學員資料已更新。`);
  }
  function handleSave(body: CreateMemberBody | UpdateMemberBody, isNew: boolean, id?: string): Promise<void> {
    if (isNew) return createAndRefresh(body as CreateMemberBody);
    return id ? updateAndRefresh(id, body as UpdateMemberBody) : Promise.resolve();
  }

  function openNew() {
    overlay.sheet('memberForm', { m: null, onSave: (body: CreateMemberBody | UpdateMemberBody) => handleSave(body, true) });
  }
  function openEdit(m: MemberRow) {
    overlay.sheet('memberForm', { m, onSave: (body: CreateMemberBody | UpdateMemberBody) => handleSave(body, false, m.id) });
  }
  function openDetail(m: MemberRow) {
    overlay.sheet('member', { m, onEdit: openEdit });
  }

  // Round 2 C3:計數/篩選改共用桌面 member-account-filter.ts 純函式(MemberRow 結構
  // 同桌面 MemberAccount,structural typing 直接相容)。
  $: counts = countByAccountStatus($members);
  $: chips = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'active', label: '啟用中', count: counts.active },
    { key: 'inactive', label: '已停用', count: counts.inactive }
  ];
  $: rows = filterMemberAccounts($members, { status: tab, query: q });
  $: capHint = searchCapHint($opsPages.members);
</script>

<LoadGate {gate}>
  <div class="df-scroll df-view" data-testid="members-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:11px;" slot="loading">
    {#each [0, 1, 2, 3] as i (i)}
      <SkelCard><Skeleton w="100%" h={100} r={14} /></SkelCard>
    {/each}
  </div>

  <ScreenHeader title="學員管理" sub={$opsPages.members.total + ' 位學員'}>
    <div slot="right" style="display:flex; gap:8px;">
      <HeaderIcon icon="user-plus" label="新增學員" onClick={openNew} />
      <HeaderIcon icon="bell" badge={$adminUnreadCount} label="通知" onClick={openAdminNotif} />
    </div>
  </ScreenHeader>

  <div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border); display:flex; flex-direction:column; gap:11px;">
    <SearchField value={q} onChange={(v) => (q = v)} placeholder="搜尋學員姓名、電話、編號…" />
    {#if capHint}<div style="font-size:11.5px; color:var(--df-text-muted); margin-top:-4px;">{capHint}</div>{/if}
    <FilterChips items={chips} value={tab} onChange={(k) => (tab = k as MemberAccountStatusFilter)} />
  </div>

  <div class="df-scroll df-view">
    <div style="padding:16px; display:flex; flex-direction:column; gap:11px;">
      {#if rows.length === 0}
        <MEmpty icon="search-x" title="找不到符合的學員" body="換個關鍵字或篩選條件試試。" />
      {:else}
        {#each rows as m (m.id)}
          <button
            on:click={() => openDetail(m)}
            class="df-tapscale"
            style="display:flex; align-items:center; gap:12px; padding:14px; border-radius:14px; border:1px solid var(--df-border);
              background:#fff; box-shadow:var(--df-shadow-card); cursor:pointer; text-align:left; width:100%;"
          >
            <Avatar name={m.initial} size="md" color="var(--df-primary)" />
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
                <span style="font-size:15px; font-weight:700; color:var(--df-ink);">{m.name}</span>
                <span style="font-size:11px; color:var(--df-text-muted); font-family:var(--df-font-mono);">{m.id}</span>
              </div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{m.phone || '—'} · {m.points} 點</div>
              <div style="font-size:11.5px; color:var(--df-text-muted); margin-top:2px;">入會 {m.joined}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex:none;">
              <StatusBadgeM s={m.status} />
              <Icon name="chevron-right" size={18} color="var(--df-text-muted)" />
            </div>
          </button>
        {/each}
      {/if}
      <div style="height:8px;"></div>
    </div>
  </div>
</LoadGate>
