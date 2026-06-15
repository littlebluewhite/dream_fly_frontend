<script lang="ts">
  /* Member-centre sticky top bar: page title, global search, bell + cart with
   * count badges, member avatar. */
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { ME } from '$lib/member/data';
  import { search, unreadCount, cart, checkoutOpen } from '$lib/member/stores';

  export let title = '';
  $: cartCount = $cart.length;
</script>

<div class="topbar">
  <h1>{title}</h1>
  <div class="right">
    <div class="searchbox">
      <Icon name="search" size={16} color="var(--df-text-muted)" />
      <input placeholder="搜尋課程、教練…" bind:value={$search} />
    </div>
    <div class="iconwrap">
      <IconButton aria-label="通知" variant="outline" on:click={() => goto('/member/notifications')}>
        <Icon name="bell" size={19} />
      </IconButton>
      {#if $unreadCount > 0}<span class="dot">{$unreadCount}</span>{/if}
    </div>
    <div class="iconwrap">
      <IconButton aria-label="購物車" variant="outline" on:click={() => checkoutOpen.set(true)}>
        <Icon name="shopping-cart" size={19} />
      </IconButton>
      {#if cartCount > 0}<span class="dot">{cartCount}</span>{/if}
    </div>
    <Avatar name={ME.initial} size="md" color={ME.color} />
  </div>
</div>

<style>
  .topbar {
    height: 72px;
    flex: none;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--df-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 28px;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  h1 {
    margin: 0;
    font-family: var(--df-font-heading);
    font-size: 23px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .right {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .searchbox {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--df-bg-light);
    border: 1px solid var(--df-border);
    border-radius: 9px;
    padding: 0 12px;
    height: 40px;
    width: 250px;
  }
  .searchbox input {
    border: none;
    background: transparent;
    outline: none;
    font-size: 14px;
    width: 100%;
    color: var(--df-text-dark);
    font-family: var(--df-font-body);
  }
  .iconwrap {
    position: relative;
  }
  .dot {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--df-accent);
    color: var(--df-ink);
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  @media (max-width: 720px) {
    .searchbox {
      display: none;
    }
  }
</style>
