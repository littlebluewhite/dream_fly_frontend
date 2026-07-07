<!--
  測試專用元件 —— 僅供 load-gate.test.ts 驗證「元件卸載時 onDestroy 自動觸發
  gate.destroy()」使用,不是產品程式碼,頁面不應 import。內部建立 gate 並在
  onMount 呼叫 load(),讓測試能用 @testing-library/svelte 的 render/unmount
  模擬頁面卸載時機。不使用 transition(jsdom 無 WAAPI)。
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createLoadGate, type LoadGateOptions } from './load-gate';

	export let options: LoadGateOptions<unknown>;

	const gate = createLoadGate(options);
	onMount(() => {
		gate.load();
	});
</script>

<p>{$gate}</p>
