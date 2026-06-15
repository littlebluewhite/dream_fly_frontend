import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SettingsRowFixture from './SettingsRow.fixture.svelte';

/* SettingsRow (admin.jsx SettingsView): label + description on the left and a
 * slotted control on the right. Slots can't be passed through bare
 * render(Component, props), so the fixture wraps it with a real Switch. */
describe('SettingsRow', () => {
	it('renders the label and description', () => {
		const { container } = render(SettingsRowFixture, {
			label: '簡訊提醒',
			desc: '課前一日發送簡訊提醒（需加購點數）'
		});
		expect(container.textContent).toContain('簡訊提醒');
		expect(container.textContent).toContain('課前一日發送簡訊提醒（需加購點數）');
	});

	it('renders the slotted control (a Switch)', () => {
		const { getByRole } = render(SettingsRowFixture, { label: 'Email 通知', desc: '說明' });
		expect(getByRole('switch')).toBeTruthy();
	});

	it('renders the label alone when desc is empty', () => {
		const { container } = render(SettingsRowFixture, { label: '只有標題', desc: '' });
		expect(container.textContent).toContain('只有標題');
	});
});
