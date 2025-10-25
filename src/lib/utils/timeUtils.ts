/**
 * Convert a timestamp to a relative time string in Chinese
 * @param timestamp ISO timestamp string
 * @returns Chinese relative time string
 */
export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '剛剛';
  } else if (minutes < 60) {
    return `${minutes}分鐘前`;
  } else if (hours < 24) {
    return `${hours}小時前`;
  } else if (days === 1) {
    return '昨天';
  } else if (days < 30) {
    return `${days}天前`;
  } else {
    // Format as date if older than 30 days
    const year = past.getFullYear();
    const month = past.getMonth() + 1;
    const day = past.getDate();
    return `${year}/${month}/${day}`;
  }
}
