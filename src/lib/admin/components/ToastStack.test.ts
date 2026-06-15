import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import ToastStack, { TONE_ICONS } from './ToastStack.svelte';
import { toasts } from '$lib/admin/stores';

afterEach(() => {
  cleanup();
  // drain the singleton between tests so toasts don't leak across cases
  vi.useRealTimers();
});

describe('admin ToastStack tone → icon map', () => {
  it('maps every tone to its DS icon name', () => {
    expect(TONE_ICONS).toEqual({
      success: 'circle-check',
      info: 'info',
      warning: 'triangle-alert',
      error: 'circle-x'
    });
  });
});

describe('admin ToastStack rendering', () => {
  it('renders the title + body of a toast pushed through the store', async () => {
    vi.useFakeTimers();
    render(ToastStack);
    toasts.notify('success', '已儲存', '課程已更新');
    await tick(); // flush the store-driven {#each} into the DOM
    expect(screen.getByText('已儲存')).toBeInTheDocument();
    expect(screen.getByText('課程已更新')).toBeInTheDocument();
    // clear the auto-dismiss timer so it doesn't bleed into the next test
    vi.runAllTimers();
  });
});
