<script lang="ts">
  import { onMount } from 'svelte';
  import { Skeleton, SkelCard, ErrorState, LoadGate } from '$lib/components/ui';
  import { createLoadGate } from '$lib/load-gate';
  import { cart, subscriptions } from '$lib/member/stores';
  import { passToCartItem } from '$lib/member/data';
  import { toasts } from '$lib/stores/marketingToasts';
  import { listProducts } from '$lib/public/api';
  import { toPass, type Ticket } from '$lib/public/adapters';

  // Tickets Page - 購票資訊（cart v3：接真 API，uuid string id；mock ticketTypes 的
  // string 價格 / number id 形狀與後端 Ticket 不相容，改走 public seam 取得真資料）。

  let tickets: Ticket[] = [];

  const gate = createLoadGate({
    fetch: listProducts,
    onData: (products) => {
      tickets = products.map(toPass);
    }
  });
  onMount(() => {
    gate.load();
  });

  function addTicketToCart(ticket: Ticket) {
    // Already an active entitlement? Block it — checkout skips owned passes
    // (chargeableLines), so re-adding would only produce a confusing zero-charge line.
    if ($subscriptions.some((s) => s.id === ticket.id)) {
      toasts.notify('info', `您已訂閱「${ticket.name}」，無需重複購買`);
      return;
    }

    const inCart = $cart.some((item) => item.id === ticket.id && item.type === 'pass');

    if (inCart) {
      toasts.notify('info', `${ticket.name} 已在購物車中`);
      return;
    }

    cart.addItem(passToCartItem(ticket));
    toasts.notify('success', `已將 ${ticket.name} 加入購物車`);
  }
</script>

<svelte:head>
  <title>購票資訊 - Dream Fly 體操館</title>
</svelte:head>

<div class="tickets-page">
  <section class="page-header">
    <div class="container">
      <h1>購票資訊</h1>
      <p>多元票券方案，滿足不同需求</p>
    </div>
  </section>

  <section class="tickets-intro">
    <div class="container">
      <div class="intro-card card">
        <h2>票券說明</h2>
        <p>
          Dream Fly 提供多種課程方案，從單堂體驗到月費會員，
          讓您可以根據訓練需求選擇最適合的方案。
          所有方案均可線上報名或現場報名，彈性便利。
        </p>
      </div>
    </div>
  </section>

  <section class="tickets-list">
    <div class="container">
      <LoadGate {gate}>
        <div class="tickets-grid" data-testid="tickets-skeleton" slot="loading">
          {#each [0, 1, 2] as i (i)}
            <SkelCard>
              <Skeleton w="60%" h={24} r={6} style="margin-bottom:14px" />
              <Skeleton w="100%" h={80} r={8} style="margin-bottom:14px" />
              <Skeleton w="100%" h={40} r={8} />
            </SkelCard>
          {/each}
        </div>

        <div class="tickets-grid">
          {#each tickets as ticket (ticket.id)}
            <div class="ticket-card card" class:highlighted={ticket.highlighted}>
              {#if ticket.badge}
                <div class="discount-badge">{ticket.badge}</div>
              {:else if ticket.originalPrice}
                <div class="discount-badge">優惠中</div>
              {/if}

              <div class="ticket-header">
                <h3>{ticket.name}</h3>
                <div class="price-wrapper">
                  {#if ticket.originalPrice}
                    <span class="original-price">NT$ {ticket.originalPrice.toLocaleString()}</span>
                  {/if}
                  <span class="price">NT$ {ticket.price.toLocaleString()}</span>
                </div>
              </div>

              <div class="ticket-body">
                <p class="description">{ticket.desc}</p>
                <ul class="features-list">
                  {#each ticket.features as feature}
                    <li>{feature}</li>
                  {/each}
                </ul>
              </div>

              <div class="ticket-footer">
                {#if $subscriptions.some((s) => s.id === ticket.id)}
                  <button class="btn btn-secondary" disabled>已訂閱</button>
                {:else if $cart.some((item) => item.id === ticket.id && item.type === 'pass')}
                  <button class="btn btn-secondary" disabled>已在購物車</button>
                {:else}
                  <button class="btn btn-primary" on:click={() => addTicketToCart(ticket)}>
                    加入購物車
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <div class="card" style="padding:0" slot="error"><ErrorState onRetry={gate.refresh} /></div>
      </LoadGate>
    </div>
  </section>

  <section class="purchase-info">
    <div class="container">
      <div class="info-grid">
        <div class="info-card card">
          <h2>購票方式</h2>
          <ul>
            <li>線上購買：官方網站或 App</li>
            <li>現場購買：櫃台直接購買</li>
            <li>電話訂購：(02) 2345-6789</li>
            <li>Line 購買：@dreamfly</li>
          </ul>
        </div>

        <div class="info-card card">
          <h2>付款方式</h2>
          <ul>
            <li>現金付款</li>
            <li>信用卡 (VISA、Master、JCB)</li>
            <li>行動支付 (Line Pay、街口支付)</li>
            <li>轉帳匯款</li>
          </ul>
        </div>

        <div class="info-card card">
          <h2>注意事項</h2>
          <ul>
            <li>回數票有效期限內使用完畢</li>
            <li>會員卡不可轉讓他人</li>
            <li>預約後請準時到場，逾時不候</li>
            <li>退票需於使用前 24 小時申請</li>
          </ul>
        </div>

        <div class="info-card card">
          <h2>優惠活動</h2>
          <ul>
            <li>首購享 95 折優惠</li>
            <li>續購回數票享額外贈送</li>
            <li>學生憑證享優惠價</li>
            <li>團體購票另有優惠</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .page-header {
    background: linear-gradient(135deg, var(--df-primary), var(--df-primary-dark));
    color: var(--df-white);
    padding: var(--df-space-8) 0;
    text-align: center;
  }

  .page-header h1 {
    color: var(--df-white);
    font-size: 2.5rem;
    margin-bottom: var(--df-space-4);
  }

  .page-header p {
    font-size: 1.2rem;
    color: var(--df-accent);
  }

  .tickets-intro {
    padding: var(--df-space-8) 0 var(--df-space-6);
  }

  .intro-card h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-5);
  }

  .tickets-list {
    padding-bottom: var(--df-space-8);
  }

  .tickets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--df-space-6);
  }

  .ticket-card {
    display: flex;
    flex-direction: column;
    position: relative;
    transition: transform var(--transition-normal);
  }

  .ticket-card:hover {
    transform: translateY(-4px);
  }

  .ticket-card.highlighted {
    border: 2px solid var(--df-accent);
    box-shadow: var(--df-shadow-card);
  }

  .discount-badge {
    position: absolute;
    top: -10px;
    right: var(--df-space-5);
    background-color: var(--df-error);
    color: var(--df-white);
    padding: 0.4rem 0.8rem;
    border-radius: var(--df-radius-md);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .ticket-header {
    text-align: center;
    margin-bottom: var(--df-space-5);
    padding-bottom: var(--df-space-5);
    border-bottom: 2px solid var(--df-accent);
  }

  .ticket-header h3 {
    color: var(--df-primary);
    font-size: 1.4rem;
    margin-bottom: var(--df-space-4);
  }

  .price-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: var(--df-space-2);
  }

  .original-price {
    text-decoration: line-through;
    color: var(--df-text-light);
    font-size: 0.9rem;
  }

  .price {
    font-size: 2rem;
    font-weight: 700;
    color: var(--df-primary);
  }

  .ticket-body {
    flex: 1;
    margin-bottom: var(--df-space-5);
  }

  .description {
    color: var(--df-text-light);
    text-align: center;
    margin-bottom: var(--df-space-5);
  }

  .features-list {
    list-style: none;
    padding: 0;
  }

  .features-list li {
    padding: var(--df-space-2) 0;
    padding-left: var(--df-space-5);
    position: relative;
    color: var(--df-text-dark);
  }

  .features-list li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--df-accent);
    font-weight: bold;
  }

  .ticket-footer .btn {
    width: 100%;
  }

  .purchase-info {
    background-color: var(--df-bg-light);
    padding: var(--df-space-8) 0;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--df-space-6);
  }

  .info-card h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-5);
    font-size: 1.3rem;
  }

  .info-card ul {
    list-style: none;
    padding: 0;
  }

  .info-card li {
    padding: var(--df-space-2) 0;
    padding-left: var(--df-space-5);
    position: relative;
  }

  .info-card li::before {
    content: '•';
    position: absolute;
    left: 0;
    color: var(--df-accent);
    font-weight: bold;
  }

  @media (max-width: 767px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .tickets-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
