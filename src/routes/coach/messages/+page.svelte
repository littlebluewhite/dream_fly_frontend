<script lang="ts">
  /* 訊息中心 — ported from docs/design/coach/views_messages.jsx (L1-102 recovered;
   * bubble area, composer, info panel reconstructed from spec).
   * Layout: 3-column card grid (320px | 1fr | 300px). No df-view on root.
   *
   * Task 12：接真對話 API（$lib/coach/api，見 integration-contract.md §3.21）。
   * - 清單：getConversations()(GET /conversations/me)，onMount 載入，phase 三態閘門。
   * - 串：選定對話(sel)變動時 loadThread() 呼叫 getThread(id)(GET .../messages) +
   *   markRead(id)(PATCH .../read)——兩者各自 best-effort、互不阻塞；markRead 成功後
   *   本地把該對話 badge 清零(避免已讀後徽章卡在舊數字)。thread=null 代表載入中，
   *   `[]` 代表已載入但無訊息，兩者分開渲染避免誤判空狀態。
   * - 傳送：sendMessage(id, body)(POST .../messages)，回應直接附加到本地 thread(同
   *   saveAttendance 用 mutation 回應同步本地狀態的慣例)，失敗則還原輸入框內容並
   *   toast 錯誤。
   * - sharedFiles UI 區塊移除（v1 不支援檔案附件，契約§3.21 明文）。
   * - 撰寫新對話：MSG_DIRECTORY 維持既有前端本地示範建立對話（未串接 POST
   *   /conversations——不在本任務端點清單內，見 task-12-brief），新建對話 id 固定
   *   'new-' 前綴；loadThread() 對此類本地對話直接顯示空對話串，不呼叫任何端點
   *   （後端不存在對應資料，呼叫必然 404）。 */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import ConversationRow from '$lib/coach/components/ConversationRow.svelte';
  import MessageBubble from '$lib/coach/components/MessageBubble.svelte';
  import MessageComposer from '$lib/coach/components/MessageComposer.svelte';
  import InfoSection from '$lib/coach/components/InfoSection.svelte';
  import type { Conversation, MsgRecipient, ThreadMsg } from '$lib/coach/data';
  import { MSG_DIRECTORY } from '$lib/coach/data';
  import { getConversations, getThread, sendMessage, markRead } from '$lib/coach/api';
  import { ApiError } from '$lib/api/client';
  import { toasts, search } from '$lib/coach/stores';

  let phase: 'loading' | 'error' | 'ready' = 'loading';

  /* ── state (legacy, no runes) ── */
  let convos: Conversation[] = [];
  let tab = '全部';
  let sel: string | null = null;
  let reply = '';
  // null = 該對話串載入中；[] = 已載入但尚無訊息。
  let thread: ThreadMsg[] | null = null;

  function load() {
    phase = 'loading';
    getConversations()
      .then((d) => {
        convos = [...d.conversations];
        sel = d.conversations[0]?.id ?? null;
        phase = 'ready';
      })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  /** 選定對話變動時載入其對話串並標記已讀。本地示範對話('new-' 前綴，見上方撰寫
   *  附註)後端不存在對應資料，直接顯示空對話串，不呼叫任何端點。
   *
   *  `sel === conversationId` 重新檢查：快速連續切換對話時，較舊對話的請求可能比
   *  新選取對話的請求更晚回來(網路先後順序不保證)——套用回應前先確認使用者這時
   *  還停留在同一個對話，避免舊回應蓋掉目前正在看的對話串。 */
  function loadThread(conversationId: string) {
    if (conversationId.startsWith('new-')) {
      thread = [];
      return;
    }
    thread = null;
    getThread(conversationId)
      .then((d) => {
        if (sel === conversationId) thread = d.messages;
      })
      .catch(() => {
        if (sel === conversationId) {
          thread = [];
          toasts.notify('error', '載入訊息失敗', '請稍後再試。');
        }
      });
    markRead(conversationId)
      .then(() => {
        convos = convos.map((c) => (c.id === conversationId ? { ...c, badge: 0 } : c));
      })
      .catch(() => {}); // best-effort：已讀標記失敗不影響訊息顯示(同 auth logout 的 fire-and-forget revoke 慣例)
  }
  $: if (sel) loadThread(sel);

  /* compose dialog */
  let composeOpen = false;
  let composePick: MsgRecipient | null = null;
  let newSeq = 1;

  const tabs = [
    { k: '全部', label: '全部' },
    { k: '緊急', label: '緊急' },
    { k: '未讀', label: '未讀' },
    { k: '家長', label: '家長' },
  ];

  /* wired to topbar search store */
  $: q = $search.trim().toLowerCase();

  $: list = convos.filter((c) => {
    if (tab === '緊急' && !c.urgent) return false;
    if (tab === '未讀' && !c.badge) return false;
    if (tab === '家長' && c.kind !== '家長') return false;
    if (q && !(c.name + c.preview).toLowerCase().includes(q)) return false;
    return true;
  });

  /* selection guard: if current sel falls out of filtered list, auto-select first */
  $: if (list.length && !list.some((c) => c.id === sel)) sel = list[0].id;

  $: cur = convos.find((c) => c.id === sel) || convos[0];

  function handleSelect(e: CustomEvent<string>) {
    sel = e.detail;
  }

  function sendErrorMessage(e: unknown): string {
    if (e instanceof ApiError) return e.message;
    return '連線發生問題，請稍後再試。';
  }

  /** conversationId 在送出當下(sel 目前指向的對話)被捕捉為區域變數；await 期間使用者
   *  可能已切到另一個對話(sel 改變)——套用回應/還原輸入框前皆以 `sel === conversationId`
   *  重新檢查，避免遲來的回應附加到「現在正在看」的另一個對話串，或覆蓋另一個對話
   *  已經在輸入的內容(同 loadThread 的過期回應防護)。convos 的 preview 更新則不受此
   *  限制——不論目前選取哪個對話，那筆訊息確實已送達 conversationId 對應的對話。 */
  async function handleSend(e: CustomEvent<string>) {
    const text = e.detail;
    const conversationId = sel;
    if (!conversationId) return;
    if (conversationId.startsWith('new-')) {
      // 本地示範對話，尚無真實後端對話 id 可送出——同既有 mock 示範行為。
      toasts.notify('success', '訊息已傳送', '（示範）');
      return;
    }
    try {
      const msg = await sendMessage(conversationId, text);
      if (sel === conversationId) thread = [...(thread ?? []), msg];
      convos = convos.map((c) => (c.id === conversationId ? { ...c, preview: text, time: msg.time } : c));
    } catch (err) {
      if (sel === conversationId) reply = text; // 送出失敗，還原輸入框內容，避免使用者遺失已輸入文字
      toasts.notify('error', '傳送失敗', sendErrorMessage(err));
    }
  }

  function openCompose() {
    composePick = null;
    composeOpen = true;
  }

  function createConversation() {
    if (!composePick) return;
    const r = composePick;
    const id = 'new-' + newSeq++;
    const convo: Conversation = {
      id,
      name: r.name,
      initial: r.initial,
      color: r.color,
      kind: r.kind,
      time: '剛剛',
      preview: '尚無訊息',
      sla: '尚未回覆',
      slaTone: 'muted',
    };
    convos = [convo, ...convos];
    // reset the filters so the guard can't re-select the first visible row over us.
    tab = '全部';
    search.set('');
    sel = id;
    composeOpen = false;
    composePick = null;
    toasts.notify('success', '已建立對話', '與 ' + r.name + ' 的新對話已建立。');
  }
</script>

{#if phase === 'ready'}
<div style="height:calc(100vh - 68px - 52px);min-height:560px;padding:0">
  <div style="display:grid;grid-template-columns:320px 1fr 300px;gap:0;height:100%;background:#fff;border:1px solid var(--df-border);border-radius:14px;overflow:hidden;box-shadow:var(--df-shadow-card)">

    <!-- ══════════════ Col 1: 對話列表 ══════════════ -->
    <div style="border-right:1px solid var(--df-border);display:flex;flex-direction:column;min-height:0">
      <!-- header -->
      <div style="padding:16px 16px 10px;border-bottom:1px solid var(--df-border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:17px;font-weight:800;color:var(--df-ink);font-family:var(--df-font-heading)">訊息</span>
          <IconButton
            variant="soft"
            size="sm"
            aria-label="撰寫"
            on:click={openCompose}
          >
            <Icon name="pen-line" size={16} color="var(--df-primary)" />
          </IconButton>
        </div>
        <!-- faux search field (static) -->
        <div style="display:flex;align-items:center;gap:8px;background:var(--df-bg-light);border:1px solid var(--df-border);border-radius:8px;padding:0 12px;height:36px">
          <Icon name="search" size={15} color="var(--df-text-muted)" />
          <span style="font-size:12.5px;color:var(--df-text-muted)">搜尋家長或學員</span>
        </div>
        <!-- filter tabs -->
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
          {#each tabs as t (t.k)}
            {@const on = tab === t.k}
            <button
              on:click={() => (tab = t.k)}
              style="padding:5px 12px;border-radius:999px;border:none;cursor:pointer;font-size:12.5px;font-weight:600;font-family:var(--df-font-body);background:{on ? 'var(--df-primary)' : 'var(--df-bg-light)'};color:{on ? '#fff' : 'var(--df-text-light)'}"
            >{t.label}</button>
          {/each}
        </div>
      </div>

      <!-- conversation list -->
      <div style="flex:1;overflow-y:auto;min-height:0">
        {#if list.length === 0}
          <div style="padding:28px 16px;text-align:center;font-size:13px;color:var(--df-text-muted)">沒有符合的對話</div>
        {/if}
        {#each list as c (c.id)}
          <ConversationRow {c} active={sel === c.id} on:select={handleSelect} />
        {/each}
      </div>
    </div>

    <!-- ══════════════ Col 2: 對話串 ══════════════ -->
    <div style="display:flex;flex-direction:column;min-height:0;background:var(--df-bg-light)">
      {#if list.length === 0}
        <!-- codex r2 (P2): no matches → no active thread/composer -->
        <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--df-text-muted);font-size:13px">沒有符合的對話</div>
      {:else}
      <!-- thread header -->
      <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--df-border);background:#fff">
        <span style="width:40px;height:40px;border-radius:50%;background:{cur.color};color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;flex:none">{cur.initial}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:15.5px;font-weight:700;color:var(--df-ink)">{cur.name}</div>
          <div style="font-size:12.5px;color:var(--df-text-light)">{cur.kind}</div>
        </div>
        {#each ['phone', 'video', 'more-horizontal'] as ic}
          <button
            on:click={() => toasts.notify('info', ic === 'phone' ? '語音通話' : ic === 'video' ? '視訊通話' : '更多', ic === 'more-horizontal' ? '更多對話選項。' : '此原型不含通話功能。')}
            aria-label={ic}
            style="width:36px;height:36px;border-radius:8px;border:1px solid var(--df-border);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"
          >
            <Icon name={ic} size={16} color="var(--df-text-light)" />
          </button>
        {/each}
      </div>

      <!-- SLA banner (only for conversations flagged urgent; 目前後端無回覆時效資料，
           恆為預設值，見 api.ts mapConversation 附註——保留區塊供未來若有此欄位時沿用) -->
      {#if cur.urgent}
        <div style="display:flex;align-items:center;gap:10px;padding:10px 20px;background:var(--df-warning-bg);border-bottom:1px solid var(--df-border)">
          <Icon name="clock" size={15} color="#92400E" />
          <span style="flex:1;font-size:12.5px;color:#92400E;font-weight:500">緊急對話 · 需於 30 分鐘內回覆（回覆 SLA）</span>
          <button
            on:click={() => toasts.notify('success', '已標記', '對話已標記為已處理。')}
            style="border:none;background:#fff;color:#92400E;border-radius:7px;padding:5px 12px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:var(--df-font-body)"
          >標記已處理</button>
        </div>
      {/if}

      <!-- bubble area -->
      <div style="flex:1;overflow-y:auto;min-height:0;padding:20px;display:flex;flex-direction:column;gap:14px">
        {#if thread === null}
          <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--df-text-muted);font-size:13px">載入訊息中…</div>
        {:else if thread.length === 0}
          <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--df-text-muted);font-size:13px">尚無訊息</div>
        {:else}
          {#each thread as m}
            <MessageBubble {m} />
          {/each}
        {/if}
      </div>

      <!-- composer -->
      <MessageComposer bind:value={reply} on:send={handleSend} />
      {/if}
    </div>

    <!-- ══════════════ Col 3: 資訊面板 ══════════════ -->
    <div style="background:#fff;border-left:1px solid var(--df-border);display:flex;flex-direction:column;min-height:0;overflow-y:auto">
      <!-- 學員資訊：cur 在沒有任何對話(convos 為空)時為 undefined，須另外判斷，
           否則沒有符合任何 col2 的 {#if list.length === 0} 保護 -->
      {#if cur}
      <InfoSection title="學員資訊">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span style="width:38px;height:38px;border-radius:50%;background:{cur.color};color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;flex:none">{cur.initial}</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--df-text-dark)">{cur.name}</div>
            <div style="font-size:12px;color:var(--df-text-light)">{cur.kind}</div>
          </div>
        </div>
      </InfoSection>
      {/if}

      <!-- 快捷操作 -->
      <InfoSection title="快捷操作">
        <div style="display:flex;flex-direction:column;gap:8px">
          <button
            on:click={() => toasts.notify('info', '查看學員資料', '（示範）')}
            style="display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--df-border);border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:var(--df-text-dark);font-family:var(--df-font-body)"
          >
            <Icon name="user" size={15} color="var(--df-primary)" />查看學員資料
          </button>
          <button
            on:click={() => toasts.notify('info', '預約補課', '（示範）')}
            style="display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--df-border);border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:var(--df-text-dark);font-family:var(--df-font-body)"
          >
            <Icon name="calendar-plus" size={15} color="var(--df-primary)" />預約補課
          </button>
          <button
            on:click={() => toasts.notify('info', '填寫事故回報', '（示範）')}
            style="display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--df-border);border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:var(--df-text-dark);font-family:var(--df-font-body)"
          >
            <Icon name="file-text" size={15} color="var(--df-primary)" />填寫事故回報
          </button>
        </div>
      </InfoSection>
    </div>

  </div>
</div>

<!-- ══════════════ 撰寫 新對話 Dialog ══════════════ -->
<Dialog
  open={composeOpen}
  title="撰寫新訊息"
  onClose={() => (composeOpen = false)}
  primaryAction={{ label: '建立對話', onClick: createConversation }}
  secondaryAction={{ label: '取消', onClick: () => (composeOpen = false) }}
>
  <div style="font-size:13px;color:var(--df-text-light);margin-bottom:10px">選擇收件對象</div>
  <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">
    {#each MSG_DIRECTORY as r (r.name)}
      {@const on = composePick?.name === r.name}
      <button
        type="button"
        on:click={() => (composePick = r)}
        style="display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:1.5px solid {on
          ? 'var(--df-primary)'
          : 'var(--df-border)'};background:{on
          ? 'var(--df-primary-bg)'
          : '#fff'};border-radius:10px;padding:10px 12px;cursor:pointer;font-family:var(--df-font-body)"
      >
        <span style="width:36px;height:36px;border-radius:50%;background:{r.color};color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex:none">{r.initial}</span>
        <span style="flex:1;min-width:0">
          <span style="display:block;font-size:13.5px;font-weight:700;color:var(--df-text-dark)">{r.name}</span>
          <span style="display:block;font-size:12px;color:var(--df-text-light)">{r.kind}</span>
        </span>
        {#if on}<Icon name="check" size={16} color="var(--df-primary)" />{/if}
      </button>
    {/each}
  </div>
</Dialog>
{:else if phase === 'error'}
  <Card padding={0}><ErrorState onRetry={load} /></Card>
{:else}
  <div style="height:calc(100vh - 68px - 52px);min-height:560px;" data-testid="messages-skeleton">
    <div style="display:grid;grid-template-columns:320px 1fr 300px;gap:0;height:100%;background:#fff;border:1px solid var(--df-border);border-radius:14px;overflow:hidden;">
      <div style="padding:16px;"><Skeleton w="100%" h={40} r={8} /></div>
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;"><SkelCard><Skeleton w={280} h={200} r={12} /></SkelCard></div>
      <div style="padding:16px;"><SkelCard><Skeleton w="100%" h={300} r={12} /></SkelCard></div>
    </div>
  </div>
{/if}
