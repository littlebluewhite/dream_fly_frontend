<script lang="ts">
  /* 訊息中心 — ported from docs/design/coach/views_messages.jsx (L1-102 recovered;
   * bubble area, composer, info panel reconstructed from spec).
   * Layout: 3-column card grid (320px | 1fr | 300px). No df-view on root. */
  import Icon from '$lib/components/ui/Icon.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import ConversationRow from '$lib/coach/components/ConversationRow.svelte';
  import MessageBubble from '$lib/coach/components/MessageBubble.svelte';
  import MessageComposer from '$lib/coach/components/MessageComposer.svelte';
  import InfoSection from '$lib/coach/components/InfoSection.svelte';
  import { CONVERSATIONS, MSG_DIRECTORY, THREAD, SHARED_FILES } from '$lib/coach/data';
  import type { Conversation, MsgRecipient } from '$lib/coach/data';
  import { toasts, search } from '$lib/coach/stores';

  /* ── state (legacy, no runes) ── */
  let convos: Conversation[] = [...CONVERSATIONS];
  let tab = '全部';
  let sel = 'v1';
  let reply = '';

  /* compose dialog */
  let composeOpen = false;
  let composePick: MsgRecipient | null = null;
  let newSeq = 1;

  const tabs = [
    { k: '全部', label: '全部' },
    { k: '緊急', label: '緊急 2' },
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
  $: showThread = cur.id === 'v1';

  function handleSelect(e: CustomEvent<string>) {
    sel = e.detail;
  }

  function handleSend() {
    toasts.notify('success', '訊息已傳送', '（示範）');
    reply = '';
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
          <div style="font-size:12.5px;color:var(--df-text-light)">{showThread ? '王小明 的家長 · 兒童體操初階班' : cur.kind}</div>
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

      <!-- SLA banner (only for v1 / 王媽媽 緊急對話) -->
      {#if showThread}
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
        {#if showThread}
          {#each THREAD as m}
            <MessageBubble {m} />
          {/each}
        {:else}
          <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--df-text-muted);font-size:13px">選擇對話以檢視訊息</div>
        {/if}
      </div>

      <!-- composer -->
      <MessageComposer bind:value={reply} on:send={handleSend} />
      {/if}
    </div>

    <!-- ══════════════ Col 3: 資訊面板 ══════════════ -->
    <div style="background:#fff;border-left:1px solid var(--df-border);display:flex;flex-direction:column;min-height:0;overflow-y:auto">
      <!-- 學員資訊 -->
      <InfoSection title="學員資訊">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span style="width:38px;height:38px;border-radius:50%;background:{cur.color};color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;flex:none">{cur.initial}</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--df-text-dark)">{showThread ? '王小明' : cur.name}</div>
            <div style="font-size:12px;color:var(--df-text-light)">{showThread ? '兒童體操初階班' : cur.kind}</div>
          </div>
        </div>
        {#if showThread}
          <!-- codex r3 (P2): these stats are 王小明's; show only for the 王媽媽 thread
               rather than the wrong student's numbers on other conversations. -->
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;font-size:12.5px">
              <span style="color:var(--df-text-muted)">出席率</span>
              <span style="color:var(--df-text-dark);font-weight:600">98%</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px">
              <span style="color:var(--df-text-muted)">學習進度</span>
              <span style="color:var(--df-text-dark);font-weight:600">初階</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px">
              <span style="color:var(--df-text-muted)">最近課程</span>
              <span style="color:var(--df-text-dark);font-weight:600">今日 09:00</span>
            </div>
          </div>
        {/if}
      </InfoSection>

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

      <!-- 共用檔案 -->
      <InfoSection title="共用檔案">
        <div style="display:flex;flex-direction:column;gap:8px">
          {#each SHARED_FILES as f}
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:8px;background:var(--df-primary-bg);display:flex;align-items:center;justify-content:center;flex:none">
                <Icon name={f.icon} size={16} color={f.tint} />
              </div>
              <div style="min-width:0">
                <div style="font-size:12.5px;font-weight:600;color:var(--df-text-dark);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{f.name}</div>
                <div style="font-size:11px;color:var(--df-text-muted);margin-top:1px">{f.meta}</div>
              </div>
            </div>
          {/each}
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
