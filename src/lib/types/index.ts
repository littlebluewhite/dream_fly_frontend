export interface Notification {
  id: string;
  type: 'reminder' | 'promotion' | 'schedule' | 'announcement';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
