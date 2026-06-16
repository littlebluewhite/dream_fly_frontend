<script lang="ts">
  /* /mobile-admin 索引：依登入狀態導向角色首頁或登入頁。對應 app.jsx 啟動邏輯
   * （authed 空 → 登入；否則進 role 首頁）。SSR 安全：localStorage 只在 onMount 讀。 */
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  onMount(() => {
    if (!browser) return;
    let authed = '';
    let r = 'admin';
    try {
      authed = localStorage.getItem('df_madmin_session') || '';
      r = localStorage.getItem('df_madmin_role') || 'admin';
    } catch (_) {}
    goto(authed ? '/mobile-admin/' + r : '/mobile-admin/login');
  });
</script>

<div class="df-scroll" style="display:flex; align-items:center; justify-content:center; color:var(--df-text-muted); font-size:13px;">
  載入中…
</div>
