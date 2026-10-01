import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotificationSchema, LocalNotifications } from '@capacitor/local-notifications';
import { STORAGE_KEYS } from '../constants/habit.constants';
import { Habit, HabitReminder } from '../models/habit.model';
import { toDateKey } from '../utils/date.util';
import { isScheduledOn } from '../utils/stats.util';
import { StorageService } from './storage.service';

const CHANNEL = 'habits';

interface ActiveReminder {
  habit: Habit;
  reminder: HabitReminder;
}

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly storage = inject(StorageService);
  private readonly fired = new Set<string>();
  private nativeReady = false;

  constructor() {
    if (!Capacitor.isNativePlatform()) {
      window.setInterval(() => this.tickWeb(), 20000);
    }
  }

  async refresh(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await this.syncNative(this.activeReminders());
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
    return (await Notification.requestPermission()) === 'granted';
  }

  async permission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    if (Capacitor.isNativePlatform()) {
      const result = await LocalNotifications.checkPermissions();
      return result.display === 'granted' ? 'granted' : result.display === 'denied' ? 'denied' : 'prompt';
    }
    if (typeof Notification === 'undefined') {
      return 'unsupported';
    }
    return Notification.permission === 'default' ? 'prompt' : Notification.permission;
  }

  private activeReminders(): ActiveReminder[] {
    const habits = this.storage.get<Habit[]>(STORAGE_KEYS.habits) ?? [];
    return habits
      .filter((habit) => habit.active !== false)
      .flatMap((habit) => (habit.reminders ?? [])
        .filter((reminder) => reminder.enabled)
        .map((reminder) => ({ habit, reminder })));
  }

  private async syncNative(items: ActiveReminder[]): Promise<void> {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') {
        return;
      }
      if (!this.nativeReady) {
        await LocalNotifications.createChannel({
          id: CHANNEL,
          name: 'Habit reminders',
          description: 'Reminders for your habits',
          importance: 4,
        });
        this.nativeReady = true;
      }
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel(pending);
      }
      let nextId = 1;
      const notifications: LocalNotificationSchema[] = [];
      for (const { habit, reminder } of items) {
        const [hour, minute] = reminder.time.split(':').map(Number);
        for (const on of scheduleSlots(habit, reminder, hour, minute)) {
          notifications.push({
            id: nextId++,
            channelId: CHANNEL,
            title: habit.name,
            body: messageFor(habit, reminder),
            schedule: { on, repeats: true, allowWhileIdle: true },
          });
        }
      }
      if (notifications.length) {
        await LocalNotifications.schedule({ notifications });
      }
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
    for (const { habit, reminder } of this.activeReminders()) {
      if (reminder.time !== stamp) {
        continue;
      }
      if (reminder.repeat === 'scheduled' && !isScheduledOn(habit, now)) {
        continue;
      }
      const key = `${habit.id}:${reminder.id}:${today}`;
      if (this.fired.has(key)) {
        continue;
      }
      this.fired.add(key);
      new Notification(habit.name, { body: messageFor(habit, reminder) });
    }
  }
}

function scheduleSlots(habit: Habit, reminder: HabitReminder, hour: number, minute: number): Array<{ hour: number; minute: number; weekday?: number; day?: number }> {
  if (reminder.repeat === 'scheduled' && habit.frequency === 'CUSTOM' && habit.daysOfWeek?.length) {
    return habit.daysOfWeek.map((day) => ({ weekday: day + 1, hour, minute }));
  }
  if (reminder.repeat === 'scheduled' && habit.frequency === 'MONTHLY') {
    return [{ day: Math.min(28, habit.dayOfMonth ?? 1), hour, minute }];
  }
  return [{ hour, minute }];
}

function messageFor(habit: Habit, reminder: HabitReminder): string {
  if (reminder.message) {
    return reminder.message;
  }
  if (habit.kind === 'measurable') {
    return `Time to log ${habit.unit || 'your progress'}.`;
  }
  return habit.intent === 'quit' ? 'Check in and keep the streak.' : 'Time to tick this habit.';
}
