<script lang="ts">
  /* Google OAuth callback（mobile 登入）。`+page@.svelte` resets to the ROOT
   * layout — same escape as ../+page@.svelte — so this renders full-screen
   * without any /mobile layout chrome。流程與模板見共用元件
   * $lib/components/GoogleCallbackCard.svelte（C7 塌收；state 消費順序等 P1
   * 契約的完整說明都在那邊）。 */
  import GoogleCallbackCard from '$lib/components/GoogleCallbackCard.svelte';
</script>

<GoogleCallbackCard successPath="/mobile" loginPath="/mobile/login" />
