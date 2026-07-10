<script context="module" lang="ts">
  /* 已讀狀態單例——刻意放在 module context（非元件實例 script），確保「store 活在
   * 模組層」：跨導航（甚至元件重新掛載）持久化已讀狀態，同 C6 計畫核可的行為變更。 */
  import { createReadState } from '$lib/stores/read-state';
  import { NOTIFS } from '$lib/coach/data';

  const notifState = createReadState(NOTIFS);
</script>

<script lang="ts">
  /* 教練端 topbar (shell.jsx:171-199): 68px white sticky bar — breadcrumb + title
   * on the left; right cluster = optional per-view action (only 排課管理 supplies
   * one: 新增課程 → toast), 280px search bound to the shared `search` store, a bell
   * with a NotifMenu popover (rows navigate via coachPath), and a blue avatar.
   *
   * The prototype's single Shell injected `action` into the Topbar by view; as
   * separate routes can't reach into the parent layout, the Topbar detects the
   * schedule route itself (same $page used for the title map). */
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { search, toasts } from '$lib/coach/stores';
  import { COACH } from '$lib/coach/data';
  import { coachPath } from '$lib/coach/nav';
  import { unreadCount } from '$lib/stores/read-state';

  export let crumb: string;
  export let title: string;

  let notif = false;
  $: isSchedule = $page.url.pathname === '/coach/schedule';
  $: unread = unreadCount($notifState);

  function addClass() {
    toasts.notify('info', '新增課程', '建立新的課程時段（示範）。');
  }
  function openNotif(to: string) {
    notif = false;
    goto(coachPath(to));
  }
</script>

<div
  style="height:68px;flex:none;background:#fff;border-bottom:1px solid var(--df-border);display:flex;align-items:center;justify-content:space-between;padding:0 32px;position:sticky;top:0;z-index:20"
>
  <div>
    <div style="font-size:13px;color:var(--df-text-light);font-family:var(--df-font-body)">{crumb}</div>
    <div style="display:flex;align-items:center;gap:10px;min-width:0;margin:2px 0 0">
      <h1
        style="margin:0;font-family:var(--df-font-body);font-size:19px;font-weight:700;color:var(--df-text-dark);line-height:1.2"
      >
        {title}
      </h1>
      <Badge tone="accent" solid>教練</Badge>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:16px">
    {#if isSchedule}
      <Button variant="primary" size="sm" on:click={addClass}>
        <span style="display:inline-flex;align-items:center;gap:8px"><Icon name="plus" size={16} color="#fff" />新增課程</span>
      </Button>
    {/if}
    <div
      style="display:flex;align-items:center;gap:8px;background:var(--df-bg-light);border:1px solid var(--df-border);border-radius:8px;padding:0 14px;height:40px;width:280px"
    >
      <Icon name="search" size={16} color="var(--df-text-light)" />
      <input
        bind:value={$search}
        placeholder="搜尋學員或課程"
        style="border:none;background:transparent;outline:none;font-size:13px;width:100%;color:var(--df-text-dark);font-family:var(--df-font-body)"
      />
    </div>
    <div style="position:relative">
      <button
        on:click={() => (notif = !notif)}
        aria-label="通知"
        style="position:relative;width:40px;height:40px;border-radius:8px;border:none;background:{notif
          ? 'var(--df-primary-bg)'
          : 'var(--df-bg-light)'};display:flex;align-items:center;justify-content:center;cursor:pointer"
      >
        <Icon name="bell" size={18} color={notif ? 'var(--df-primary)' : 'var(--df-text-dark)'} />
        {#if unread > 0}<span style="position:absolute;top:9px;right:10px;width:8px;height:8px;border-radius:999px;background:#dc2626"></span>{/if}
      </button>
      {#if notif}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div style="position:fixed;inset:0;z-index:60" on:click={() => (notif = false)}></div>
        <div
          style="position:absolute;top:50px;right:0;width:360px;background:#fff;border-radius:14px;box-shadow:var(--df-shadow-strong);z-index:70;overflow:hidden;animation:df-fade-up .16s ease both"
        >
          <div
            style="display:flex;justify-content:space-between;align-items:center;padding:15px 18px;border-bottom:1px solid var(--df-border)"
          >
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:15px;font-weight:700;color:var(--df-ink)">通知</span>
              {#if unread > 0}
                <span style="background:var(--df-primary);color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px">
                  {unread} 則未讀
                </span>
              {/if}
            </div>
            <button
              on:click={() => {
                notifState.markAllRead();
                notif = false;
              }}
              style="border:none;background:transparent;color:var(--df-primary);font-weight:600;font-size:12.5px;cursor:pointer;font-family:var(--df-font-body)"
            >
              全部標為已讀
            </button>
          </div>
          <div style="max-height:380px;overflow-y:auto">
            {#each $notifState as n, i (i)}
              {@const rowUnread = !n.read}
              <button
                class="df-rowhover"
                on:click={() => openNotif(n.to)}
                style="display:flex;gap:12px;width:100%;padding:13px 18px;border:none;border-bottom:{i <
                $notifState.length - 1
                  ? '1px solid var(--df-border)'
                  : 'none'};background:{rowUnread ? 'var(--df-primary-bg)' : '#fff'};cursor:pointer;text-align:left;font-family:var(--df-font-body)"
              >
                <span
                  style="width:36px;height:36px;border-radius:9px;background:{n.bg};display:flex;align-items:center;justify-content:center;flex:none"
                >
                  <Icon name={n.icon} size={17} color={n.tone} />
                </span>
                <span style="flex:1;min-width:0">
                  <span style="display:flex;align-items:center;gap:6px">
                    <span
                      style="font-size:13.5px;font-weight:700;color:var(--df-text-dark);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                    >
                      {n.title}
                    </span>
                    {#if rowUnread}
                      <span style="width:8px;height:8px;border-radius:999px;background:var(--df-primary);flex:none"></span>
                    {/if}
                  </span>
                  <span style="display:block;font-size:12.5px;color:var(--df-text-light);margin-top:3px;line-height:1.45">{n.body}</span>
                  <span style="display:block;font-size:11px;color:var(--df-text-muted);margin-top:4px">{n.time}</span>
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    <div
      style="width:36px;height:36px;border-radius:50%;background:var(--df-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14.4px;flex:none;font-family:var(--df-font-body)"
    >
      {COACH.initial}
    </div>
  </div>
</div>
