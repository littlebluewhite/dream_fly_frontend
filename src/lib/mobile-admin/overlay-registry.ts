/* mobile-admin surface 的 overlay 註冊表(id → 元件),OverlayHost 與 overlay 單例型別的單一來源。
 * push/sheet 的合法 id 由本檔鍵推出;各 id 可傳的 props 由元件自身 props 推出
 * (見 `createOverlay<PushReg, SheetReg>`)。stores.ts 只可用敘述層級
 * `import type { … } from './overlay-registry'`——值 import 會在執行期把全部 overlay
 * 元件拉進 stores 的載入鏈(元件反過來 import stores,形成循環)。 */
import type { OverlayRegistry } from '$lib/components/mobile/overlay';

import CoachesScreen from './overlays/CoachesScreen.svelte';
import VenuesScreen from './overlays/VenuesScreen.svelte';
import TicketsScreen from './overlays/TicketsScreen.svelte';
import ReportsScreen from './overlays/ReportsScreen.svelte';
import AdminSettingsScreen from './overlays/AdminSettingsScreen.svelte';
import MessageThread from './overlays/MessageThread.svelte';

import MemberSheet from './overlays/MemberSheet.svelte';
import ClassSheet from './overlays/ClassSheet.svelte';
import OrderSheet from './overlays/OrderSheet.svelte';
import MemberForm from './overlays/MemberForm.svelte';
import ClassForm from './overlays/ClassForm.svelte';
import CoachForm from './overlays/CoachForm.svelte';
import NotifSheet from './overlays/NotifSheet.svelte';
import RoleSheet from './overlays/RoleSheet.svelte';
import StudentActionSheet from './overlays/StudentActionSheet.svelte';

export const PUSH = {
	coaches: CoachesScreen,
	venues: VenuesScreen,
	tickets: TicketsScreen,
	reports: ReportsScreen,
	settings: AdminSettingsScreen,
	messageThread: MessageThread
} satisfies OverlayRegistry;

export const SHEETS = {
	member: MemberSheet,
	class: ClassSheet,
	order: OrderSheet,
	memberForm: MemberForm,
	classForm: ClassForm,
	coachForm: CoachForm,
	notif: NotifSheet,
	role: RoleSheet,
	studentAction: StudentActionSheet
} satisfies OverlayRegistry;

export type MobileAdminPushRegistry = typeof PUSH;
export type MobileAdminSheetRegistry = typeof SHEETS;
