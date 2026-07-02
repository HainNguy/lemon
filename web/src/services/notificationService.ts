export async function requestPermission(): Promise<void> {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export function notifyWorkComplete(): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Lemon', { body: 'Work session complete. Time for a break.' });
  }
}

export function notifyBreakComplete(): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Lemon', { body: 'Break complete. Ready to focus again?' });
  }
}
