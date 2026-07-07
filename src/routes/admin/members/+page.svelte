<script lang="ts">
  /* 學員管理 — learner management page (admin.jsx MembersView). A PageHead (進階篩選
   * toggle) over the full MembersTable, which owns its own status tabs / row
   * dialog / 新增學員 button (its PanelHead `right` slot — Task 16) and reads the
   * topbar `search` store. The 進階篩選 button toggles the MemberFilterPanel, whose
   * 套用 commits to the shared memberFilter store that MembersTable folds into its
   * filter call. The shell layout supplies the sidebar + topbar.
   *
   * Task 5: data arrives async via getMembers() (GET /users, admin — see
   * admin/api.ts). onMount loads it into a three-state gate (loading/error/ready),
   * matching how the other admin pages (orders/tickets/classes/coaches, Task 18)
   * hydrate their real seams. MembersTable renders the fetched MemberAccount[] as
   * an honest, slimmed table — no course/campus/coach/attendance/pay/tier columns
   * (P2: no backend data source, see issue #8).
   *
   * Task 16: 新增/編輯 now wired for real — contract §3.2 gained POST /users and
   * PATCH /users/{id}. This page owns the MemberCreateDialog/MemberEditDialog
   * instances and the actual createMember/updateMember calls (same ownership
   * split as classes/venues/coupons +page.svelte use for their own 新增/編輯
   * flows) — MembersTable itself only fires the onNew/onEdit callback props.
   * 409/422 errors surface e.message directly (memberErrorMessage) rather than
   * a custom status→copy mapping table: the backend's own message (e.g. "Email
   * 已被使用", "至少提供一個欄位") is already user-facing 繁中 text. On success the
   * dialog closes and the list is refreshed via a full getMembers() re-fetch
   * (member counts/list are small; simpler and more reliably in sync than
   * hand-merging the single mapped response, same choice coupons/+page.svelte
   * makes) — a refresh failure is best-effort and does not overwrite the
   * success toast that already fired. */
  import { onMount } from 'svelte';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import MembersTable from '$lib/admin/components/MembersTable.svelte';
  import MemberFilterPanel from '$lib/admin/components/MemberFilterPanel.svelte';
  import MemberCreateDialog from '$lib/admin/components/MemberCreateDialog.svelte';
  import MemberEditDialog from '$lib/admin/components/MemberEditDialog.svelte';
  import { Button, Icon, Card, ErrorState, Skeleton, SkelCard, PaginationBar } from '$lib/components/ui';
  import { toasts } from '$lib/admin/stores';
  import type { MemberAccount } from '$lib/admin/data';
  import {
    getMembers,
    createMember,
    updateMember,
    type CreateMemberBody,
    type UpdateMemberBody
  } from '$lib/admin/api';
  import { ApiError } from '$lib/api/client';

  let showFilter = false;

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let members: MemberAccount[] = [];
  // Task 17：admin 列表分頁——page/total/perPage 皆來自 getMembers() 回應；
  // PaginationBar 換頁時呼叫 changePage(newPage) 重新 load() 重抓。
  let page = 1;
  let total = 0;
  let perPage = 20;

  // 複審修復（Finding 3）：page 樂觀更新，寫在 getMembers() 之前——即使這次換頁失敗，
  // page 也已經是使用者實際要求的目標頁，讓下面 <ErrorState onRetry> 的重試能對到正確
  // 頁碼（而非停留在換頁前的舊頁碼）。
  function load(p = page) {
    page = p;
    phase = 'loading';
    getMembers(p)
      .then((d) => {
        members = d.members;
        total = d.total;
        page = d.page;
        perPage = d.perPage;
        phase = 'ready';
      })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  function changePage(p: number) {
    load(p);
  }

  let createOpen = false;
  let editTarget: MemberAccount | null = null;
  let editOpen = false;

  function openEdit(m: MemberAccount) {
    editTarget = m;
    editOpen = true;
  }
  function closeEdit() {
    editOpen = false;
    editTarget = null;
  }

  // 409（email 重複）/ 422（驗證）皆已是後端給的 繁中 使用者可讀文字，直接透傳
  // e.message，不像 courses/coupons 頁那樣另建 status→自訂文案的對照表。
  function memberErrorMessage(e: unknown): string {
    return e instanceof ApiError ? e.message : '連線發生問題，請稍後再試。';
  }

  async function refresh() {
    try {
      const d = await getMembers(page);
      members = d.members;
      total = d.total;
      page = d.page;
      perPage = d.perPage;
    } catch {
      // 最佳努力：新增/編輯已成功，只有刷新列表失敗——不覆蓋剛才的成功 toast。
    }
  }

  async function create(body: CreateMemberBody) {
    try {
      await createMember(body);
    } catch (e) {
      toasts.notify('error', '新增失敗', memberErrorMessage(e));
      return;
    }
    createOpen = false;
    toasts.notify('success', '已新增學員', `「${body.name}」已建立。`);
    await refresh();
  }

  async function saveEdit(id: string, body: UpdateMemberBody) {
    try {
      await updateMember(id, body);
    } catch (e) {
      toasts.notify('error', '儲存失敗', memberErrorMessage(e));
      return;
    }
    closeEdit();
    toasts.notify('success', '已儲存', `${body.name ?? ''} 學員資料已更新。`);
    await refresh();
  }
</script>

{#if phase === 'ready'}
  <div class="df-view" style="display:flex;flex-direction:column;gap:20px">
    <PageHead title="學員管理" sub="管理報名、出席與會員資料">
      <Button
        slot="actions"
        variant="secondary"
        size="sm"
        on:click={() => (showFilter = !showFilter)}
      >
        <Icon name="filter" size={15} />進階篩選
      </Button>
    </PageHead>

    <!-- 複審修復（Finding 1）：topbar 搜尋 + MemberFilterPanel + MembersTable 分頁籤皆為
         純前端記憶體篩選，只作用在目前已載入的這一頁（見上 Task 17 分頁）。per_page=100
         時幾乎無感，改成 20 後若使用者搜尋的學員落在第 2 頁以後，會靜默顯示「找不到」——
         只在還有下一頁時才提示，避免全部資料剛好一頁裝得下時的多餘雜訊。 -->
    {#if total > perPage}
      <p style="margin:0; font-size:13px; color:var(--df-text-light);">
        搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。
      </p>
    {/if}

    <MemberFilterPanel open={showFilter} />

    <MembersTable {members} {total} onNew={() => (createOpen = true)} onEdit={openEdit} />
    <PaginationBar {page} {total} {perPage} onPageChange={changePage} />
  </div>

  <MemberCreateDialog open={createOpen} onClose={() => (createOpen = false)} onSave={create} />
  <MemberEditDialog member={editTarget} open={editOpen} onClose={closeEdit} onSave={saveEdit} />
{:else if phase === 'error'}
  <!-- 複審修復（Finding 3）：onRetry 包一層無參數箭頭函式——ErrorState 內部的 Button 會把
       原生 click 事件轉發給 onRetry，若直接傳 load，p 收到的會是 MouseEvent 而非
       page，讓上面的樂觀賦值失真；包成 () => load() 才能讓 p 正確地退回預設值 page。 -->
  <Card padding={0}><ErrorState onRetry={() => load()} /></Card>
{:else}
  <div class="df-view" style="display:flex;flex-direction:column;gap:20px" data-testid="members-skeleton">
    <Skeleton w={180} h={32} r={8} />
    <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
  </div>
{/if}
