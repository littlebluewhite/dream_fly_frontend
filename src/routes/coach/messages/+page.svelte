<script lang="ts">
  /* 訊息中心 — ported from docs/design/coach/views_messages.jsx (L1-102 recovered;
   * bubble area, composer, info panel reconstructed from spec).
   * Layout: 3-column card grid (320px | 1fr | 300px). No df-view on root.
   *
   * Task 12：接真對話 API（$lib/coach/api，見 integration-contract.md §3.21）。
   * - 清單：getConversations()(GET /conversations/me)，onMount 載入，phase 三態閘門，
   *   convos/gate 留頁面(Round 8 C1 判準：清單非「單一對話串」編排的一部分)。
   * - 串的載入(stale-guard)、傳送(樂觀附加)、撰寫新對話三部曲(compose 生命週期、
   *   creating 守衛)已收進 $lib/coach/messages-controller.ts(Round 8 C1，自本頁抽出，
   *   仿 attendance-controller 的單一快照 store + clock-controller 的 outcome 形)——
   *   本頁退化為薄 adapter：解構 controller 快照、事件轉呼 controller 方法、把
   *   outcome 翻成 toast 文案。badge 清零與傳送後的 convos 預覽/時間更新作用在
   *   convos(非 controller 狀態)，故由頁面依 outcome 欄位/呼叫當下捕捉的 id 自行套用。
   * - selectAndSync()：頁面對 ctrl.selectThread() 的統一入口，三個呼叫點共用：
   *   pickSelection reactive（同時扛下初始選取——見 gate onData 附註——與 tab×搜尋
   *   造成的選取回退，兩者本質是同一件事：把 sel 修正成「目前過濾條件下」合法的
   *   對話）、點擊列(handleSelect)、撰寫新對話成功後(handleConfirmCompose)。目標 id
   *   與目前選取相同時不重複觸發(同 Svelte reassignment 對未變值不重新觸發下游
   *   reactive 的語意)。gate onData 刻意不再手動選第一筆（codex R4 P2 回歸修復：
   *   getConversations() 飛行期間使用者已輸入搜尋字時，選未過濾的第一筆會對「其實
   *   已被濾掉」的對話誤發 markRead，見 onData 附註）。
   *   ctrl.selectThread() 回傳 threadReady/badgeCleared 兩條互不等待的 promise(非單一
   *   outcome)——分開掛 .then，任一方卡住或永不落定都不拖住另一方(codex 全輪審查 P2
   *   回歸修復：先前誤用單一 await 合併兩者，markRead 卡住會連帶拖住失敗 toast)。
   * - sharedFiles UI 區塊移除（v1 不支援檔案附件，契約§3.21 明文）。
   * - 撰寫新對話：picker 名冊來自 getStudents()(GET /coaches/me/students，Task 10
   *   已接真)，確認即 createConversation(user_id, name)(POST /conversations，
   *   get-or-create，§3.21)——controller 只回傳建立結果，插入/選取的
   *   applyCreatedConversation() 呼叫留頁面(convos 非 controller 狀態；回傳 id 已在
   *   清單中就選中既有列不重複插入，全新對話插入頂端並選中)。失敗(422「僅支援教練
   *   與會員間的對話」等)以 ApiError.message 繁中 toast 提示，對話框保持開啟供改選。
   * - 過濾清單(tab×搜尋)、選取回退 guard、confirmCompose 的插入/reset 四欄指令邏輯
   *   留在純模組 $lib/coach/conversations-filter.ts(Round 3 K3)不動。 */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import ConversationRow from '$lib/coach/components/ConversationRow.svelte';
  import MessageBubble from '$lib/coach/components/MessageBubble.svelte';
  import MessageComposer from '$lib/coach/components/MessageComposer.svelte';
  import InfoSection from '$lib/coach/components/InfoSection.svelte';
  import type { Conversation, Student, ThreadMsg } from '$lib/coach/data';
  import { filterConversations, pickSelection, applyCreatedConversation } from '$lib/coach/conversations-filter';
  import { createLoadGate } from '$lib/load-gate';
  import { getConversations, getThread, sendMessage, markRead, getStudents, createConversation } from '$lib/coach/api';
  import { createMessagesController } from '$lib/coach/messages-controller';
  import { apiErrorMessage } from '$lib/api/error-text';
  import { toasts, search } from '$lib/coach/stores';
  import type { IconName } from '$lib/icon-registry';

  const ctrl = createMessagesController({ getThread, sendMessage, markRead, getStudents, createConversation });

  /* ── convos 清單 state(legacy, no runes)——非 controller 收編範圍 ── */
  let convos: Conversation[] = [];
  let tab = '全部';
  let reply = '';

  /* ── controller 單一快照 store 解構鏡射(creating 純供內部 guard 用，頁面未渲染，
   *  不落地成頁面變數) ── */
  let sel: string | null = null;
  // null = 該對話串載入中；[] = 已載入但尚無訊息。
  let thread: ThreadMsg[] | null = null;
  let composeOpen = false;
  let composePhase: 'loading' | 'error' | 'ready' = 'loading';
  let recipients: Student[] = [];
  let composePick: Student | null = null;
  $: ({ sel, thread, composeOpen, composePhase, recipients, composePick } = $ctrl);

  const gate = createLoadGate({
    fetch: getConversations,
    onData: (d) => {
      convos = [...d.conversations];
      // 初選刻意不在此手動觸發（codex R4 P2 回歸修復）：若在 getConversations() 飛行
      // 期間使用者已輸入搜尋字，這裡若直接選未過濾的 d.conversations[0]，會在下方
      // reactive pickSelection 區塊來得及以目前的 tab/search 修正選取之前，就先對
      // 「其實已被搜尋字篩掉、使用者根本沒看到」的那筆對話發出 getThread + markRead——
      // markRead 刻意不做 stale-guard（見 selectAndSync 附註），該對話會被永久標記
      // 已讀。全權交給下方 pickSelection reactive 區塊處理（它吃的是已套用 tab/search
      // 的 list，天然不會選到被濾掉的列）。
    }
  });
  onMount(() => {
    gate.load();
  });

  /** ctrl.selectThread() 的頁面統一入口：threadReady→toast(getThread 失敗)、
   *  badgeCleared→convos 徽章清零(convos 非 controller 狀態，副作用留頁面套用)——兩條
   *  各自掛 .then，互不等待(任一方卡住不拖住另一方，見上方檔頭附註)。已選中同一對話
   *  則不重複觸發。四個呼叫點見檔頭附註。 */
  function selectAndSync(id: string): void {
    if (id === $ctrl.sel) return;
    const { threadReady, badgeCleared } = ctrl.selectThread(id);
    threadReady.then((outcome) => {
      if (outcome.kind === 'threadLoadFailed') {
        toasts.notify('error', '載入訊息失敗', '請稍後再試。');
      }
    });
    badgeCleared.then((cleared) => {
      if (cleared) {
        convos = convos.map((c) => (c.id === id ? { ...c, badge: 0 } : c));
      }
    });
  }

  const tabs = [
    { k: '全部', label: '全部' },
    { k: '緊急', label: '緊急' },
    { k: '未讀', label: '未讀' },
    { k: '家長', label: '家長' },
  ];

  // thread header 三顆動作 icon——原模板內聯 each 陣列 hoist 至此並標型別。
  const threadActionIcons: IconName[] = ['phone', 'video', 'more-horizontal'];

  $: list = filterConversations(convos, { tab, query: $search });

  /* selection guard: if current sel falls out of filtered list, auto-select first;
   * 這也是「初始選取」的唯一入口(sel 初始為 null，同樣落在「不合法 → 回退清單首筆」
   * 這條路徑，見 gate onData 附註——刻意不在 onData 另外手動選第一筆，才能保證選取
   * 一律吃到當下的 tab/search 過濾結果，不會誤選被濾掉的列)。pickSelection 是冪等的
   * 回退函式；fallback 與現行 sel 相同時 selectAndSync 內建不重複觸發(同 Svelte
   * legacy 對未變值 reassignment 不重新觸發下游 reactive 的語意)。 */
  $: {
    const fallback = pickSelection(list, sel);
    if (fallback) selectAndSync(fallback);
  }

  $: cur = convos.find((c) => c.id === sel) || convos[0];

  function handleSelect(e: CustomEvent<string>) {
    selectAndSync(e.detail);
  }

  /** conversationId 在送出當下(呼叫瞬間的 $ctrl.sel)被捕捉為區域變數；await 期間
   *  使用者可能已切到另一個對話——thread 附加的過期回應防護已內部化在 controller 的
   *  send()。還原輸入框內容仍需頁面重新比對 $ctrl.sel(reply 非 controller 狀態，避免
   *  覆蓋使用者已切到的另一個對話的輸入框)；convos 的 preview 更新不受此限制——不論
   *  目前選取哪個對話，那筆訊息確實已送達 conversationId 對應的對話。 */
  async function handleSend(e: CustomEvent<string>) {
    const text = e.detail;
    const conversationId = $ctrl.sel;
    const outcome = await ctrl.send(text);
    if (outcome.kind === 'sendFailed') {
      if ($ctrl.sel === conversationId) reply = outcome.text; // 還原輸入框內容，避免使用者遺失已輸入文字
      toasts.notify('error', '傳送失敗', apiErrorMessage(outcome.error));
    } else {
      convos = convos.map((c) => (c.id === conversationId ? { ...c, preview: text, time: outcome.msg.time } : c));
    }
  }

  /** confirmCompose 成功後的插入/選取指令邏輯(applyCreatedConversation，Round 3
   *  K3)——convos 非 controller 狀態，留頁面自行呼叫並觸發 selectAndSync。 */
  async function handleConfirmCompose() {
    const outcome = await ctrl.confirmCompose();
    if (outcome.kind === 'conversationCreated') {
      const result = applyCreatedConversation(convos, outcome.conversation);
      convos = result.convos;
      tab = result.tab;
      search.set(result.search);
      selectAndSync(result.sel);
    } else if (outcome.kind === 'createFailed') {
      toasts.notify('error', '建立對話失敗', apiErrorMessage(outcome.error));
    }
    // alreadyCreating：靜默不做事(creating 守衛或尚未選取收件人)，同 checkout-controller
    // 的 alreadyPaying 先例。
  }
</script>

<LoadGate {gate}>
  <div style="height:calc(100vh - 68px - 52px);min-height:560px;" data-testid="messages-skeleton" slot="loading">
    <div style="display:grid;grid-template-columns:320px 1fr 300px;gap:0;height:100%;background:#fff;border:1px solid var(--df-border);border-radius:14px;overflow:hidden;">
      <div style="padding:16px;"><Skeleton w="100%" h={40} r={8} /></div>
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;"><SkelCard><Skeleton w={280} h={200} r={12} /></SkelCard></div>
      <div style="padding:16px;"><SkelCard><Skeleton w="100%" h={300} r={12} /></SkelCard></div>
    </div>
  </div>

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
            on:click={ctrl.openCompose}
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
        {#each threadActionIcons as ic}
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

<!-- ══════════════ 撰寫 新對話 Dialog（getStudents 名冊選人 → POST /conversations） ══════════════ -->
<Dialog
  open={composeOpen}
  title="撰寫新訊息"
  onClose={ctrl.closeCompose}
  primaryAction={{ label: '建立對話', onClick: handleConfirmCompose }}
  secondaryAction={{ label: '取消', onClick: ctrl.closeCompose }}
>
  {#if composePhase === 'loading'}
    <div style="padding:20px 0;text-align:center;font-size:13px;color:var(--df-text-muted)">載入學員名單中…</div>
  {:else if composePhase === 'error'}
    <div style="padding:20px 0;text-align:center;font-size:13px;color:var(--df-text-muted)">無法載入學員名單，請關閉後重試。</div>
  {:else if recipients.length === 0}
    <div style="padding:20px 0;text-align:center;font-size:13px;color:var(--df-text-muted)">目前沒有學員可發起對話。</div>
  {:else}
    <div style="font-size:13px;color:var(--df-text-light);margin-bottom:10px">選擇收件對象</div>
    <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">
      {#each recipients as r (r.user_id)}
        {@const on = composePick?.user_id === r.user_id}
        <button
          type="button"
          on:click={() => ctrl.pickRecipient(r)}
          style="display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:1.5px solid {on
            ? 'var(--df-primary)'
            : 'var(--df-border)'};background:{on
            ? 'var(--df-primary-bg)'
            : '#fff'};border-radius:10px;padding:10px 12px;cursor:pointer;font-family:var(--df-font-body)"
        >
          <span style="width:36px;height:36px;border-radius:50%;background:{r.color};color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex:none">{r.initial}</span>
          <span style="flex:1;min-width:0">
            <span style="display:block;font-size:13.5px;font-weight:700;color:var(--df-text-dark)">{r.name}</span>
            <span style="display:block;font-size:12px;color:var(--df-text-light)">{r.cls}</span>
          </span>
          {#if on}<Icon name="check" size={16} color="var(--df-primary)" />{/if}
        </button>
      {/each}
    </div>
  {/if}
</Dialog>
</LoadGate>
