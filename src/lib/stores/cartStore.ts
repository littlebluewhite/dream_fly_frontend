import { writable, derived } from 'svelte/store';
import type { CartItem } from '$lib/types';

const CART_STORAGE_KEY = 'dreamfly_cart';

// Load cart from localStorage
function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load cart from storage:', error);
    return [];
  }
}

// Create the cart store
function createCartStore() {
  const { subscribe, set, update } = writable<CartItem[]>(loadCartFromStorage());

  // Save to localStorage whenever cart changes
  if (typeof window !== 'undefined') {
    subscribe((cart) => {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch (error) {
        console.error('Failed to save cart to storage:', error);
      }
    });
  }

  return {
    subscribe,

    addToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      update((cart) => {
        const existingItemIndex = cart.findIndex((i) => i.id === item.id);

        if (existingItemIndex >= 0) {
          // Item already in cart, increase quantity
          cart[existingItemIndex].quantity += item.quantity || 1;
        } else {
          // Add new item to cart
          cart.push({ ...item, quantity: item.quantity || 1 });
        }

        return cart;
      });
    },

    removeFromCart: (itemId: string) => {
      update((cart) => cart.filter((item) => item.id !== itemId));
    },

    updateQuantity: (itemId: string, quantity: number) => {
      update((cart) => {
        const itemIndex = cart.findIndex((item) => item.id === itemId);

        if (itemIndex >= 0) {
          if (quantity <= 0) {
            // Remove item if quantity is 0 or less
            cart.splice(itemIndex, 1);
          } else {
            cart[itemIndex].quantity = quantity;
          }
        }

        return cart;
      });
    },

    clearCart: () => {
      set([]);
    },

    isInCart: (itemId: string): boolean => {
      let inCart = false;
      subscribe((cart) => {
        inCart = cart.some((item) => item.id === itemId);
      })();
      return inCart;
    }
  };
}

export const cartStore = createCartStore();

// Derived stores
export const totalPrice = derived(cartStore, ($cart) =>
  $cart.reduce((total, item) => total + item.price * item.quantity, 0)
);

export const totalItems = derived(cartStore, ($cart) =>
  $cart.reduce((total, item) => total + item.quantity, 0)
);
