/* mobile surface 的 overlay 註冊表(id → 元件),OverlayHost 與 overlay 單例型別的單一來源。
 * push/sheet 的合法 id 由本檔鍵推出;各 id 可傳的 props 由元件自身 props 推出
 * (見 `createOverlay<PushReg, SheetReg>`)。stores.ts 只可用敘述層級
 * `import type { … } from './overlay-registry'`——值 import 會在執行期把全部 overlay
 * 元件拉進 stores 的載入鏈(元件反過來 import stores,形成循環)。 */
import type { OverlayRegistry } from '$lib/components/mobile/overlay';

import MyCourseDetail from './overlays/MyCourseDetail.svelte';
import ScheduleScreen from './overlays/ScheduleScreen.svelte';
import ReportScreen from './overlays/ReportScreen.svelte';
import PointsScreen from './overlays/PointsScreen.svelte';
import OrdersScreen from './overlays/OrdersScreen.svelte';
import SettingsScreen from './overlays/SettingsScreen.svelte';
import TrialScreen from './overlays/TrialScreen.svelte';

import CourseDetailSheet from './overlays/CourseDetailSheet.svelte';
import CartSheet from './overlays/CartSheet.svelte';
import LeaveSheet from './overlays/LeaveSheet.svelte';
import MakeupSheet from './overlays/MakeupSheet.svelte';
import ContactSheet from './overlays/ContactSheet.svelte';
import EditProfileSheet from './overlays/EditProfileSheet.svelte';

export const PUSH = {
	courseDetail: MyCourseDetail,
	schedule: ScheduleScreen,
	report: ReportScreen,
	points: PointsScreen,
	orders: OrdersScreen,
	settings: SettingsScreen,
	trial: TrialScreen
} satisfies OverlayRegistry;

export const SHEETS = {
	course: CourseDetailSheet,
	cart: CartSheet,
	leave: LeaveSheet,
	makeup: MakeupSheet,
	contact: ContactSheet,
	editProfile: EditProfileSheet
} satisfies OverlayRegistry;

export type MobilePushRegistry = typeof PUSH;
export type MobileSheetRegistry = typeof SHEETS;
