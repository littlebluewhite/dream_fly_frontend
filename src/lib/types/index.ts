export interface CartItem {
  id: string;
  name: string;
  type: 'course' | 'ticket';
  price: number;
  quantity: number;
  duration: string;
  level?: string;
}

export interface Notification {
  id: string;
  type: 'reminder' | 'promotion' | 'schedule' | 'announcement';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
