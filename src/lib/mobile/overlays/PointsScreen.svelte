<script lang="ts">
  /* 會員點數 push screen。account.jsx PointsScreen (112)。
   * 深色漸層 hero（自帶返回鍵）→ 兌換好禮 / 點數明細 切換 tab。
   * REWARDS 兌換卡（點數足夠才可兌換，toast 提示）；POINTS_LEDGER 明細（PT_TYPE tones）。
   * Legacy Svelte（無 runes）。 */
  import PushScreen from '$lib/mobile/components/PushScreen.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { points, toasts, redeemReward } from '$lib/mobile/stores';
  import { REWARDS, POINTS_LEDGER, PT_TYPE } from '$lib/mobile/data';

  export let onBack: () => void;

  let tab: 'rewards' | 'ledger' = 'rewards';
  const TABS: ['rewards' | 'ledger', string][] = [
    ['rewards', '兌換好禮'],
    ['ledger', '點數明細']
  ];
</script>

<PushScreen>
  <div class="m-top-inset" style="flex:none; background:linear-gradient(120deg, #1f2937, var(--df-ink)); color:#fff;">
    <div style="padding:0 14px 8px; display:flex; align-items:center; gap:8px;">
      <button
        aria-label="返回"
        on:click={onBack}
        class="df-tapscale"
        style="width:38px; height:38px; border-radius:11px; border:none; background:rgba(255,255,255,0.16);
          display:flex; align-items:center; justify-content:center; cursor:pointer;"
      >
        <Icon name="chevron-left" size={22} color="#fff" />
      </button>
      <h2 style="margin:0; font-family:var(--df-font-heading); font-size:18px; font-weight:700;">會員點數</h2>
    </div>
    <div style="padding:8px 22px 22px; text-align:center;">
      <div style="font-size:12.5px; opacity:0.8; display:flex; align-items:center; justify-content:center; gap:6px;"><Icon name="star" size={15} color="var(--df-accent)" />目前可用點數</div>
      <div style="font-size:46px; font-weight:800; font-family:var(--df-font-heading); line-height:1.1; margin-top:4px;">{$points.toLocaleString()}</div>
      <div style="font-size:12px; opacity:0.7;">1 點 = NT$1 · 點數有效期 1 年</div>
    </div>
  </div>

  <div style="flex:none; display:flex; background:#fff; border-bottom:1px solid var(--df-border); padding:0 14px;">
    {#each TABS as [k, l] (k)}
      <button
        on:click={() => (tab = k)}
        style="flex:1; padding:13px 0; border:none;
          border-bottom:2.5px solid {tab === k ? 'var(--df-primary)' : 'transparent'};
          background:transparent; color:{tab === k ? 'var(--df-primary)' : 'var(--df-text-light)'};
          font-size:14px; font-weight:{tab === k ? 700 : 500}; cursor:pointer;"
      >{l}</button>
    {/each}
  </div>

  <div class="df-scroll">
    <div style="padding:16px;">
      {#if tab === 'rewards'}
        <div style="display:flex; flex-direction:column; gap:12px;">
          {#each REWARDS as r (r.id)}
            {@const can = $points >= r.cost}
            <div style="display:flex; align-items:center; gap:13px; background:#fff; border:1px solid var(--df-border); border-radius:14px; padding:14px; box-shadow:var(--df-shadow-card);">
              <div style="width:50px; height:50px; border-radius:13px; background:var(--df-accent-bg, #FFF8DB); display:flex; align-items:center; justify-content:center; flex:none;">
                <Icon name={r.icon} size={25} color="var(--df-accent-dark)" />
              </div>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:6px;"><span style="font-size:14.5px; font-weight:700; color:var(--df-ink);">{r.name}</span>{#if r.tag}<Badge tone="accent" solid>{r.tag}</Badge>{/if}</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:3px; line-height:1.5;">{r.desc}</div>
                <div style="font-size:13px; font-weight:800; color:var(--df-accent-dark); margin-top:6px; font-family:var(--df-font-mono); display:flex; align-items:center; gap:4px;"><Icon name="star" size={13} color="var(--df-accent-dark)" />{r.cost} 點</div>
              </div>
              <button
                disabled={!can}
                on:click={() => { redeemReward(r.cost); toasts.notify('success', '兌換成功', r.name); }}
                class="df-tapscale"
                style="flex:none; height:34px; padding:0 15px; border-radius:9px; border:none;
                  background:{can ? 'var(--df-primary)' : 'var(--df-bg-light)'};
                  color:{can ? '#fff' : 'var(--df-text-muted)'}; font-size:13px; font-weight:700;
                  cursor:{can ? 'pointer' : 'not-allowed'};"
              >{can ? '兌換' : '點數不足'}</button>
            </div>
          {/each}
        </div>
      {:else}
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; overflow:hidden;">
          {#each POINTS_LEDGER as p, i (p.id)}
            {@const pos = p.delta > 0}
            <div style="display:flex; align-items:center; gap:12px; padding:13px 14px; border-top:{i ? '1px solid var(--df-border)' : 'none'};">
              <div style="flex:1; min-width:0;">
                <div style="font-size:13.5px; font-weight:600; color:var(--df-ink);">{p.desc}</div>
                <div style="font-size:11.5px; color:var(--df-text-muted); margin-top:2px; font-family:var(--df-font-mono);">{p.date}</div>
              </div>
              <div style="font-size:15px; font-weight:800; font-family:var(--df-font-mono); color:{pos ? 'var(--df-success)' : 'var(--df-text-light)'}; flex:none;">{pos ? '+' : ''}{p.delta}</div>
            </div>
          {/each}
        </div>
      {/if}
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
