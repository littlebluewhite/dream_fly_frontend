<script lang="ts">
  /* Google OAuth callback（member 登入）。`+page@.svelte` resets to the ROOT
   * layout — same as ../+page@.svelte — so this renders full-screen without
   * the member sidebar/topbar shell。流程與模板見共用元件
   * $lib/components/GoogleCallbackCard.svelte（C7 塌收；state 消費順序等 P1
   * 契約的完整說明都在那邊）。 */
  import GoogleCallbackCard from '$lib/components/GoogleCallbackCard.svelte';
</script>

<GoogleCallbackCard successPath="/member" loginPath="/member/login" />
