<script lang="ts">
  /* 身分相依頁面的探針:掛載時以「當下登入身分」打 GET /probe/{id},把回應顯示出來。
   * 用來觀察 layout 的 {#key $lastSessionKey}:換人是否以新身分重掛載、重抓。 */
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { api } from '$lib/api/client';
  import { sessionKey } from '$lib/stores/authStore';

  let data = '';
  onMount(() => {
    void api<string>(`/probe/${get(sessionKey)}`).then((r) => (data = r));
  });
</script>

<p data-testid="probe">{data}</p>
