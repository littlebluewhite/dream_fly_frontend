<script lang="ts">
  /* Overlay host — 把 overlay store 的 push-stack 頂層 + 當前 sheet 對應到元件並渲染。
   * 對應 app.jsx 的 push-stack（88-94）與 sheets（97-102）區塊。
   * push 一律帶 onBack={overlay.pop}，sheet 一律帶 onClose={overlay.closeSheet}，
   * 其餘 props 由 push/sheet 呼叫端透過 props 傳入並展開。 */
  import { overlay } from '$lib/mobile/stores';

  import MyCourseDetail from '$lib/mobile/overlays/MyCourseDetail.svelte';
  import ScheduleScreen from '$lib/mobile/overlays/ScheduleScreen.svelte';
  import ReportScreen from '$lib/mobile/overlays/ReportScreen.svelte';
  import PointsScreen from '$lib/mobile/overlays/PointsScreen.svelte';
  import OrdersScreen from '$lib/mobile/overlays/OrdersScreen.svelte';
  import SettingsScreen from '$lib/mobile/overlays/SettingsScreen.svelte';
  import TrialScreen from '$lib/mobile/overlays/TrialScreen.svelte';

  import CourseDetailSheet from '$lib/mobile/overlays/CourseDetailSheet.svelte';
  import CartSheet from '$lib/mobile/overlays/CartSheet.svelte';
  import LeaveSheet from '$lib/mobile/overlays/LeaveSheet.svelte';
  import MakeupSheet from '$lib/mobile/overlays/MakeupSheet.svelte';
  import ContactSheet from '$lib/mobile/overlays/ContactSheet.svelte';
  import EditProfileSheet from '$lib/mobile/overlays/EditProfileSheet.svelte';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Comp = any;

  const PUSH: Record<string, Comp> = {
    courseDetail: MyCourseDetail,
    schedule: ScheduleScreen,
    report: ReportScreen,
    points: PointsScreen,
    orders: OrdersScreen,
    settings: SettingsScreen,
    trial: TrialScreen
  };
  const SHEETS: Record<string, Comp> = {
    course: CourseDetailSheet,
    cart: CartSheet,
    leave: LeaveSheet,
    makeup: MakeupSheet,
    contact: ContactSheet,
    editProfile: EditProfileSheet
  };

  $: top = $overlay.stack[$overlay.stack.length - 1];
</script>

{#if top && PUSH[top.id]}
  <svelte:component this={PUSH[top.id]} onBack={overlay.pop} {...top.props} />
{/if}

{#if $overlay.sheet && SHEETS[$overlay.sheet.id]}
  <svelte:component this={SHEETS[$overlay.sheet.id]} onClose={overlay.closeSheet} {...$overlay.sheet.props} />
{/if}
