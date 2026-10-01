import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { Habit } from '../models/habit.model';
import { toDateKey } from '../utils/date.util';
import { StorageService } from './storage.service';

const CHANNEL = 'habits';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly storage = inject(StorageService);
  private readonly fired = new Set<string>();
  private nativeReady = false;

  constructor() {
    if (!Capacitor.isNativePlatform()) {
      window.setInterval(() => void this.tickWeb(), 20000);
    }
  }

  async refresh(): Promise<void> {
    const habits = this.activeReminders();
    if (Capacitor.isNativePlatform()) {
      await this.syncNative(habits);
      return;
    }
    if (habits.length && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      return;
    }
  }

  async allow(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      const result = await LocalNotifications.requestPermissions();
      const allowed = result.display === 'granted';
      if (allowed) {
        await this.refresh();
      }
      return allowed;
    }
    if (typeof Notification === 'undefined') {
      return false;
    }
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  private activeReminders(): Habit[] {
    const habits = this.storage.get<Habit[]>(STORAGE_KEYS.habits) ?? [];
    return habits.filter((habit) => habit.active !== false && habit.reminderEnabled && habit.reminderTime);
  }

  private async syncNative(habits: Habit[]): Promise<void> {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') {
        return;
      }
      if (!this.nativeReady) {
        await LocalNotifications.createChannel({
          id: CHANNEL,
          name: 'Habit reminders',
          description: 'Daily reminders for your habits',
          importance: 4,
        });
        this.nativeReady = true;
      }
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel(pending);
      }
      if (!habits.length) {
        return;
      }
      await LocalNotifications.schedule({
        notifications: habits.map((habit) => {
          const [hour, minute] = (habit.reminderTime ?? '09:00').split(':').map(Number);
          return {
            id: notificationId(habit.id),
            channelId: CHANNEL,
            title: habit.name,
            body: habit.kind === 'measurable'
              ? `Time to log ${habit.unit || 'your progress'}.`
              : habit.intent === 'quit'
                ? 'Check in and keep the streak.'
                : 'Time to tick this habit.',
            schedule: {
              on: { hour, minute },
              repeats: true,
              allowWhileIdle: true,
            },
          };
        }),
      });
    } catch {
      return;
    }
  }

  private tickWeb(): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = toDateKey(now);
    for (const habit of this.activeReminders()) {
      if (habit.reminderTime !== stamp) {
        continue;
      }
      const key = `${habit.id}:${today}`;
      if (this.fired.has(key)) {
        continue;
      }
      this.fired.add(key);
      new Notification(habit.name, {
        body: habit.kind === 'measurable' ? `Time to log ${habit.unit || 'your progress'}.` : 'Time to tick this habit.',
      });
    }
  }
}

function notificationId(habitId: number): number {
  const id = Math.abs(habitId % 2147483646);
  return id === 0 ? 1 : id;
}
