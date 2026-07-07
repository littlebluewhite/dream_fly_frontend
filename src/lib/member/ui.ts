import { writable } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';

/* ---- Cross-route UI state ---- */
export const checkoutOpen = writable(false);
export const search = writable('');

/* ---- Toasts (member, bottom-right stack, 4000ms — canonical store) ---- */
export const toasts = createToasts();
