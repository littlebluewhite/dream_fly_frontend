<script lang="ts">
  /* Dashboard hero header（navy→blue，role chip + bell）。ui.jsx HeroHeader (19-50).
   * 原型的 <StatusBar light/> 改成 <div class="m-top-inset"/> spacer。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import HeaderIcon from './HeaderIcon.svelte';
  import type { Profile } from '$lib/mobile-admin/data';
  import type { Role } from '$lib/mobile-admin/nav';

  export let role: Role;
  export let p: Profile;
  export let unread = 0;
  export let onBell: (() => void) | undefined = undefined;
  export let onRole: (() => void) | undefined = undefined;
  export let greeting = '';
  export let sub = '';
</script>

<div
  style="flex:none; background:linear-gradient(135deg, var(--df-ink) 0%, var(--df-primary-dark) 62%, var(--df-primary) 130%);
    color:#fff; position:relative; overflow:hidden;"
>
  <div
    style="position:absolute; top:-40px; right:-30px; width:150px; height:150px; border-radius:50%;
      background:radial-gradient(circle, rgba(255,215,0,.16), transparent 70%);"
  ></div>
  <div class="m-top-inset"></div>
  <div style="position:relative; padding:2px 18px 20px;">
    <div style="display:flex; align-items:center; justify-content:space-between;">
      <button
        on:click={onRole}
        class="df-tapscale"
        style="display:flex; align-items:center; gap:11px; border:none; background:transparent;
          cursor:pointer; padding:0; text-align:left;"
      >
        <div
          style="width:44px; height:44px; border-radius:999px; background:rgba(255,255,255,0.16);
            display:flex; align-items:center; justify-content:center; flex:none; color:#fff;
            font-weight:800; font-size:18px; font-family:var(--df-font-heading);"
        >{p.initial}</div>
        <div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:16.5px; font-weight:800; font-family:var(--df-font-heading);">{p.name}</span>
            <span
              style="background:{role === 'admin' ? 'rgba(255,255,255,0.18)' : 'var(--df-accent)'};
                color:{role === 'admin' ? '#fff' : 'var(--df-ink)'}; font-size:10.5px; font-weight:800;
                padding:2px 8px; border-radius:999px; display:inline-flex; align-items:center; gap:3px;"
            >
              {role === 'admin' ? '管理員' : '教練'}
              <Icon name="chevrons-up-down" size={12} color={role === 'admin' ? '#fff' : 'var(--df-ink)'} />
            </span>
          </div>
          <div style="font-size:12px; opacity:0.82; margin-top:2px;">{p.role}</div>
        </div>
      </button>
      <HeaderIcon icon="bell" light badge={unread} label="通知" onClick={onBell} />
    </div>
    {#if greeting}
      <div style="margin-top:16px;">
        <div style="font-size:21px; font-weight:800; font-family:var(--df-font-heading); line-height:1.3;">{greeting}</div>
        {#if sub}
          <div style="font-size:13px; opacity:0.85; margin-top:4px; line-height:1.5;">{sub}</div>
        {/if}
      </div>
    {/if}
  </div>
</div>
