<!--
  測試專用元件 —— 僅供 load-gate.test.ts 驗證「元件卸載時 onDestroy 自動觸發
  gate.destroy()」與「掛載時 onMount 自動首載」使用,不是產品程式碼,頁面不應
  import。內部建立 gate(`paged` 為真時建分頁閘門),首載由 gate 自己在掛載時
  觸發,讓測試能用 @testing-library/svelte 的 render/unmount 模擬頁面掛載與卸載
  時機。不使用 transition(jsdom 無 WAAPI)。
-->
<script lang="ts">
	import {
		createLoadGate,
		createPagedLoadGate,
		type LoadGateOptions,
		type PagedLoadGateOptions,
		type PagedResponse
	} from './load-gate';

	export let options: LoadGateOptions<unknown> | PagedLoadGateOptions<PagedResponse>;
	export let paged = false;

	const gate = paged
		? createPagedLoadGate(options as PagedLoadGateOptions<PagedResponse>)
		: createLoadGate(options as LoadGateOptions<unknown>);

	$: phase = typeof $gate === 'string' ? $gate : $gate.phase;
</script>

<p>{phase}</p>
