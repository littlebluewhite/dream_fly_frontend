<script lang="ts">
  /* 管理後台 sticky top bar: page title + sub on the left with a 系統管理員
   * badge, then a global search field, a notification bell and a link across to
   * the 會員中心. Search text and the bell toast use the shared admin stores. */
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { search, toasts } from '$lib/admin/stores';

  export let title = '';
  export let sub = '';
</script>

<div class="topbar">
  <div class="left">
    <div class="heading">
      <h1>{title}</h1>
      {#if sub}<div class="sub">{sub}</div>{/if}
    </div>
    <Badge tone="primary">系統管理員</Badge>
  </div>
  <div class="right">
    <div class="searchbox">
      <Icon name="search" size={16} color="var(--df-text-muted)" />
      <input placeholder="搜尋學員、課程、訂單…" bind:value={$search} />
    </div>
    <IconButton
      aria-label="通知"
      variant="outline"
      on:click={() => toasts.notify('info', '通知中心', '目前有 3 則新通知。')}
    >
      <Icon name="bell" size={18} />
    </IconButton>
    <a class="member-link" href="/member" title="會員中心">
      <Icon name="user-round" size={16} color="var(--df-text-muted)" />
      <span>會員中心</span>
      <Icon name="arrow-up-right" size={13} color="var(--df-text-muted)" />
    </a>
  </div>
</div>

<style>
  .topbar {
    height: 64px;
    flex: none;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--df-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 26px;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .left {
    display: flex;
    align-items: center;
    gap: 13px;
  }
  .heading {
    line-height: 1.2;
  }
  h1 {
    margin: 0;
    font-family: var(--df-font-admin);
    font-size: 20px;
    font-weight: 700;
    color: var(--df-ink);
    line-height: 1.2;
  }
  .sub {
    font-size: 12.5px;
    color: var(--df-text-light);
    margin-top: 1px;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .searchbox {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--df-bg-light);
    border: 1px solid var(--df-border);
    border-radius: 9px;
    padding: 0 12px;
    height: 38px;
    width: 240px;
  }
  .searchbox input {
    border: none;
    background: transparent;
    outline: none;
    font-size: 13.5px;
    width: 100%;
    color: var(--df-text-dark);
    font-family: var(--df-font-body);
  }
  .member-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 38px;
    padding: 0 13px;
    border-radius: 9px;
    border: 1px solid var(--df-border);
    background: var(--df-bg-light);
    color: var(--df-text-light);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--df-font-body);
    white-space: nowrap;
  }
  .member-link:hover {
    border-color: var(--df-border-strong);
  }
  @media (max-width: 720px) {
    .searchbox {
      display: none;
    }
  }
</style>
