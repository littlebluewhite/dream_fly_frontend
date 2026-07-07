<script lang="ts">
  /* Member-centre sticky top bar: page title, global search, bell + cart with
   * count badges, member avatar. */
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { search, unreadCount, cartCount, checkoutOpen } from '$lib/member/stores';
  import { authStore, isLoggedIn } from '$lib/stores/authStore';
  import { checkoutTarget } from '$lib/checkout-gate';

  export let title = '';

  // Real identity (Task 11 P2 cleanup — was the mock `ME` constant). A guest
  // render (no SSR route guard on /member) falls back to '?' / brand primary.
  $: member = $authStore.member;

  // Opening the checkout dialog is itself a checkout action, so gate it like the
  // marketing cart surfaces: a guest who reached /member directly (there's no SSR
  // route guard) is bounced through login rather than allowed to complete checkout.
  function openCheckout() {
    if ($isLoggedIn) checkoutOpen.set(true);
    else goto(checkoutTarget(false));
  }
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
      <IconButton aria-label="購物車" variant="outline" on:click={openCheckout}>
        <Icon name="shopping-cart" size={19} />
      </IconButton>
      {#if $cartCount > 0}<span class="dot">{$cartCount}</span>{/if}
    </div>
    <Avatar name={member?.initial ?? '?'} size="md" color={member?.color ?? 'var(--df-primary)'} />
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
