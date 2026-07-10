<script lang="ts">
  /* 票券管理 — faithful port of reports.jsx TicketsView. PageHead + a 3-up KPI
   * row (已售票券 / 票券營收 / 販售方案), then a card grid over the tickets: an icon
   * chip (tinted with the ticket colour) + name + desc + price + type
   * StatusBadge, the 已售/配額 line with a ProgressBar (warning once ≥80% sold),
   * and the 銷售明細/編輯 actions. 編輯 / 新增票券 open the TicketEditDialog. 銷售明細
   * still fires a toast.
   *
   * Data arrives async via getTickets() (admin seam): onMount loads it into a
   * paged three-state gate (loading/error/ready); `tickets` is the local mutable
   * working copy the card grid renders from.
   *
   * Task F1: 新增/編輯 now submit to the real POST /products / PATCH /products/{id}
   * (createProduct/updateProduct, admin/api.ts) instead of only mutating `tickets`
   * locally. buildProductBody() maps the edited Ticket back to the wire body
   * (price→cents via toCents；quota→stock 直接反向映射，同讀側 getTickets() 的鏡射
   * 語意；type 直接對應 product_type，讀寫共用同一組真實三值)。成功後用
   * gate.silentRefresh() 靜默重新整包刷新列表（同 members/coupons 頁的既有慣例，
   * 比手動映射插入更簡單可靠）；失敗則列表不變，顯示繁中錯誤 toast，對話框維持
   * 開啟以便修正重試。 */
  import { onMount } from 'svelte';
  import { Button, Card, Icon, ProgressBar, LoadGate, Skeleton, SkelCard, PaginationBar } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatCard from '$lib/admin/components/StatCard.svelte';
  import StatusBadge from '$lib/admin/components/StatusBadge.svelte';
  import TicketEditDialog from '$lib/admin/components/TicketEditDialog.svelte';
  import { toasts } from '$lib/admin/stores';
  import { createPagedLoadGate } from '$lib/load-gate';
  import { TICKET_TYPES, type Ticket } from '$lib/admin/data';
  import { fmtNT } from '$lib/admin/format';
  import { soldPct, ticketTone } from '$lib/admin/tickets-util';
  import { getTickets, createProduct, updateProduct, type ProductWriteBody } from '$lib/admin/api';
  import { toCents } from '$lib/public/adapters';
  import { ApiError } from '$lib/api/client';

  const notify = toasts.notify;

  // Blank票券 for the 新增 flow (mirrors classes/+page.svelte blankClass).
  const blankTicket = (): Ticket => ({
    id: '',
    name: '',
    type: TICKET_TYPES[0],
    price: 1000,
    sold: 0,
    quota: 100,
    color: 'var(--df-primary)',
    icon: 'ticket',
    desc: ''
  });

  let tickets: Ticket[] = [];
  let edit: Ticket | null = null;
  let editOpen = false;
  let addNew = false;

  const gate = createPagedLoadGate({
    fetch: (page) => getTickets(page),
    onData: (d) => { tickets = d.tickets; }
  });
  onMount(() => {
    gate.load();
  });

  $: totalSold = tickets.reduce((s, t) => s + t.sold, 0);
  $: revenue = tickets.reduce((s, t) => s + t.sold * t.price, 0);

  function openEdit(t: Ticket) {
    addNew = false;
    edit = t;
    editOpen = true;
  }
  function openNew() {
    addNew = true;
    edit = blankTicket();
    editOpen = true;
  }
  function closeEdit() {
    editOpen = false;
    edit = null;
    addNew = false;
  }

  // Ticket（表單/卡片形狀）→ POST/PATCH /products 共用欄位。quota 是 stock 的鏡射
  // （見 admin/api.ts getTickets() 註解），寫入端把表單 quota 原值放進 stock 送出，
  // null（不限）與數字語意跟讀側一致；product_type 讀寫共用同一組真實三值，直接透傳。
  function buildProductBody(t: Ticket): ProductWriteBody {
    return {
      name: t.name,
      description: t.desc,
      product_type: t.type,
      price_cents: toCents(t.price),
      stock: t.quota
    };
  }

  // 422 驗證 / 403 權限 / 409 衝突（如同名方案 slug 撞號）→ 對應的繁中錯誤提示；
  // 其餘（連線問題等）給通用訊息，同 classes/coupons 頁的 ApiError 判斷慣例。
  function productErrorMessage(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 422) return '輸入資料不符規則，請確認後再試。';
      if (e.status === 403) return '沒有權限執行此操作。';
      if (e.status === 409) return '票券名稱或代碼已存在，請調整後再試。';
    }
    return '連線發生問題，請稍後再試。';
  }

  async function save(updated: Ticket) {
    const wasNew = addNew;
    const body = buildProductBody(updated);
    try {
      if (wasNew) {
        await createProduct(body);
      } else {
        await updateProduct(updated.id, body);
      }
    } catch (e) {
      toasts.notify('error', wasNew ? '新增失敗' : '儲存失敗', productErrorMessage(e));
      return;
    }
    closeEdit();
    toasts.notify(
      'success',
      wasNew ? '已新增票券' : '已儲存票券',
      '「' + updated.name + '」已' + (wasNew ? '建立' : '更新') + '。'
    );
    await gate.silentRefresh();
  }
</script>

<LoadGate {gate}>
  <div style="display:flex; flex-direction:column; gap:20px;" data-testid="tickets-skeleton" slot="loading">
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px;">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={70} r={10} /></SkelCard>
      {/each}
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:16px;">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={180} r={12} /></SkelCard>
      {/each}
    </div>
  </div>

  <div style="display:flex; flex-direction:column; gap:20px;">
    <PageHead title="票券管理" sub="月票、體驗券與活動票券">
      <svelte:fragment slot="actions">
        <Button variant="primary" size="sm" on:click={openNew}>
          <Icon name="plus" size={15} style="margin-right:6px;" />新增票券
        </Button>
      </svelte:fragment>
    </PageHead>

    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px;">
      <StatCard icon="ticket" label="已售票券" value={totalSold + ' 張'} tint="#8B5CF614" color="#8B5CF6" />
      <StatCard
        icon="circle-dollar-sign"
        label="票券營收"
        value={fmtNT(revenue)}
        tint="var(--df-success-bg)"
        color="var(--df-success)"
      />
      <StatCard
        icon="layers"
        label="販售方案"
        value={tickets.length + ' 種'}
        tint="var(--df-primary-bg)"
        color="var(--df-primary)"
      />
    </div>

    <!-- G6：五個分頁頁統一範圍提示（原本 tickets 沒有這個提示，見任務簡報「刻意行為
         變更」）——只在還有下一頁時才提示，避免全部資料剛好一頁裝得下時的多餘雜訊。 -->
    {#if $gate.total > $gate.perPage}
      <p style="margin:0; font-size:13px; color:var(--df-text-light);">
        搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。
      </p>
    {/if}

    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:16px;">
      {#each tickets as t (t.id)}
        {@const quota = t.quota}
        {@const pct = soldPct(t.sold, quota)}
        <Card padding={0} hoverable style="overflow:hidden;">
          <div style="display:flex; align-items:flex-start; gap:14px; padding:18px 20px 16px;">
            <div
              style="width:46px; height:46px; border-radius:11px; background:color-mix(in srgb, {t.color} 10%, transparent); display:flex; align-items:center; justify-content:center; flex:none;"
            >
              <Icon name={t.icon} size={22} color={t.color} />
            </div>
            <div style="flex:1; min-width:0;">
              <h3
                style="margin:0; font-size:16px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-heading);"
              >
                {t.name}
              </h3>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-top:4px;">{t.desc}</div>
            </div>
            <div
              style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex:none;"
            >
              <div
                style="font-size:18px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-mono); white-space:nowrap;"
              >
                {fmtNT(t.price)}
              </div>
              <StatusBadge kind="ticket" value={t.type} />
            </div>
          </div>

          <div style="padding:0 20px 16px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:6px;">
              <span style="color:var(--df-text-light);">已售 / 配額</span>
              <span style="font-weight:700; color:var(--df-text-dark); white-space:nowrap;"
                >{t.sold} / {quota == null ? '不限' : quota} 張</span
              >
            </div>
            {#if quota != null}
              <ProgressBar value={t.sold} max={quota} height={7} tone={ticketTone(pct)} />
            {/if}
          </div>

          <div
            style="display:flex; gap:8px; padding:14px 20px 18px; border-top:1px solid var(--df-border);"
          >
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              on:click={() =>
                notify('info', t.name, '已售 ' + t.sold + ' 張 · 營收 ' + fmtNT(t.sold * t.price) + '。')}
            >
              <Icon name="bar-chart-3" size={14} style="margin-right:6px;" />銷售明細
            </Button>
            <Button variant="primary" size="sm" fullWidth on:click={() => openEdit(t)}>
              <Icon name="pencil-line" size={14} style="margin-right:6px;" />編輯
            </Button>
          </div>
        </Card>
      {/each}
    </div>

    <PaginationBar page={$gate.page} total={$gate.total} perPage={$gate.perPage} onPageChange={gate.changePage} />
  </div>

  <TicketEditDialog ticket={edit} open={editOpen} isNew={addNew} onClose={closeEdit} onSave={save} />
</LoadGate>
