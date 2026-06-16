import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PointsScreen from './PointsScreen.svelte';
import { points } from '$lib/mobile/stores';
import { REWARDS } from '$lib/mobile/data';

describe('PointsScreen — reward redemption wiring (codex P2 regression)', () => {
	it('debits the balance by the reward cost when 兌換 is tapped (used to only toast)', async () => {
		// Cover every reward so the first 兌換 button maps to REWARDS[0] (affordable
		// rewards render 兌換; unaffordable ones render 點數不足 and are filtered out).
		const maxCost = Math.max(...REWARDS.map((r) => r.cost));
		points.set(maxCost + 1000);
		const before = get(points);

		const { getAllByText } = render(PointsScreen, { props: { onBack: () => {} } });
		await fireEvent.click(getAllByText('兌換')[0]);

		expect(get(points)).toBe(before - REWARDS[0].cost);
	});
});
