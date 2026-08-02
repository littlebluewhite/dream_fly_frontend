<script lang="ts">
	/* One status pill for every admin table/card. `kind` picks the frozen status
	 * map; `value` is its key. Resolves [tone, label] and the per-kind dot/solid the
	 * prototype uses, then defers all rendering to the shared Badge.
	 *  - member / order / venue : tint pill + leading dot
	 *  - pay / ticket           : plain tint pill
	 *  - classLevel             : plain pill, the Level string is its own label
	 *  - classStatus            : plain pill, solid only when 額滿 (the ClassStatus
	 *                             string is its own label) */
	import { Badge } from '$lib/components/ui';
	// C4 批4(facade 純轉手退役):MEMBER_STATUS/MEMBER_ACCOUNT_STATUS/VENUE_STATUS/
	// TICKET_TYPE/LEVEL_TONE/STATUS_TONE 六張查表與 Tone/MemberStatus/OrderStatus/
	// VenueStatus/TicketType/Level/ClassStatus 七個型別,改直取對應 $lib/domain 各
	// entity 檔 / $lib/api/wire(原經 $lib/admin/data 純轉手,零附加型別事實)；
	// PAY_STATUS/PayStatus 是 admin/data.ts 本檔真內容(無後端來源的體驗票查表),
	// 續留原處。
	import { MEMBER_STATUS, MEMBER_ACCOUNT_STATUS, type MemberStatus, type MemberAccountStatus } from '$lib/domain/members';
	import { VENUE_STATUS, type VenueStatus } from '$lib/domain/venues';
	import { TICKET_TYPE, type TicketType } from '$lib/domain/tickets';
	import { LEVEL_TONE, type Level } from '$lib/domain/course-level';
	import { STATUS_TONE, type ClassStatus } from '$lib/domain/classes';
	import { ORDER_STATUS, type Tone, type OrderStatus } from '$lib/api/wire';
	import { PAY_STATUS, type PayStatus } from '$lib/admin/data';

	type Kind =
		| 'member'
		| 'memberAccount'
		| 'pay'
		| 'order'
		| 'classLevel'
		| 'classStatus'
		| 'venue'
		| 'ticket';

	export let kind: Kind;
	export let value:
		| MemberStatus
		| MemberAccountStatus
		| PayStatus
		| OrderStatus
		| VenueStatus
		| TicketType
		| Level
		| ClassStatus;

	let tone: Tone;
	let label: string;
	let dot = false;
	let solid = false;

	$: {
		dot = false;
		solid = false;
		switch (kind) {
			case 'member':
				[tone, label] = MEMBER_STATUS[value as MemberStatus];
				dot = true;
				break;
			case 'memberAccount':
				[tone, label] = MEMBER_ACCOUNT_STATUS[value as MemberAccountStatus];
				dot = true;
				break;
			case 'order':
				[tone, label] = ORDER_STATUS[value as OrderStatus];
				dot = true;
				break;
			case 'venue':
				[tone, label] = VENUE_STATUS[value as VenueStatus];
				dot = true;
				break;
			case 'pay':
				[tone, label] = PAY_STATUS[value as PayStatus];
				break;
			case 'ticket':
				// 容錯查表(同 $lib/api/wire.ts orderStatusBadge 慣例)：product_type 契約若
				// 擴出第 4 值(見 admin/api.ts mapProduct 的 as TicketType 註解)，查無 →
				// 中性 tone + 原字串標籤，不會 destructure 到 undefined 而炸掉整頁。
				[tone, label] = TICKET_TYPE[value as TicketType] ?? ['neutral', value];
				break;
			case 'classLevel':
				tone = LEVEL_TONE[value as Level];
				label = value;
				break;
			case 'classStatus':
				tone = STATUS_TONE[value as ClassStatus];
				label = value;
				solid = value === '額滿';
				break;
		}
	}
</script>

<Badge {tone} {dot} {solid}>{label}</Badge>
