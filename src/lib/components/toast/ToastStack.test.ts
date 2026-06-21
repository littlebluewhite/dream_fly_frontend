import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import ToastStack, { TONE_ICONS } from './ToastStack.svelte';
import { createToasts } from '$lib/stores/toasts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastStack tone → icon map', () => {
  it('maps every tone to its DS icon name', () => {
    expect(TONE_ICONS).toEqual({
      success: 'circle-check',
      info: 'info',
      warning: 'triangle-alert',
      error: 'circle-x',
      accent: 'star'
    });
  });
});

describe('ToastStack rendering', () => {
  it('renders the title + body of a toast pushed through the store', async () => {
    vi.useFakeTimers();
    const toasts = createToasts();
    render(ToastStack, { props: { toasts } });
    toasts.notify('success', '已儲存', '課程已更新');
    await tick(); // flush the store-driven {#each} into the DOM
    expect(screen.getByText('已儲存')).toBeInTheDocument();
    expect(screen.getByText('課程已更新')).toBeInTheDocument();
    // clear the auto-dismiss timer so it doesn't bleed into the next test
    vi.runAllTimers();
  });
});
