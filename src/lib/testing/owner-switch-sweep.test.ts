/* 擁有者換人掃描自證:用一條合成的延後動作(落地後 depth 拍才動手)證明掃描不會假綠——漏比擁有者會紅,
 * 鏈比 K 深也會紅。 */
import { describe, it, expect } from 'vitest';
import { K, microtasks, sweepOwnerSwitch } from './owner-switch-sweep';

/** 落地後 depth 拍才動手的延後動作;checksOwner 為 false 就是動手那一拍漏了擁有者比對。 */
function delayedApply(depth: number, checksOwner: boolean) {
	return async () => {
		let owner = 0;
		let applied = 0;
		return {
			land: () => {
				const departedAs = owner;
				void microtasks(depth).then(() => {
					if (!checksOwner || owner === departedAs) applied++;
				});
			},
			switchOwner: () => {
				owner++;
				applied = 0;
			},
			observe: () => applied
		};
	};
}

describe('擁有者換人掃描自證', () => {
	it('延後動作在 K 拍內收束、動手那一拍有比擁有者 → 過', async () => {
		await sweepOwnerSwitch(0, delayedApply(3, true));
	});

	it('延後動作漏比擁有者 → 紅', async () => {
		await expect(sweepOwnerSwitch(0, delayedApply(3, false))).rejects.toThrow(/k=0/);
	});

	it('延後動作比 K 深 → 紅,即使每一輪換人都過', async () => {
		await expect(sweepOwnerSwitch(0, delayedApply(K + 10, true))).rejects.toThrow(/不夠深/);
	});
});
