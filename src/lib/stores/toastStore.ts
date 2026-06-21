/* Dream Fly — public/marketing surface toast store. */

import { writable } from 'svelte/store';
import type { Toast } from '$lib/types';

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  return {
    subscribe,

    showToast: (message: string, type: Toast['type'] = 'info') => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const toast: Toast = { id, message, type };

      update((toasts) => [...toasts, toast]);

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        update((toasts) => toasts.filter((t) => t.id !== id));
      }, 3000);

      return id;
    },

    removeToast: (toastId: string) => {
      update((toasts) => toasts.filter((t) => t.id !== toastId));
    }
  };
}

export const toastStore = createToastStore();
