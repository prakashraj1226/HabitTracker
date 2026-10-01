export type EntryType = 'task' | 'note';

export interface DayEntry {
  id: number;
  date: string;
  time: string;
  title: string;
  type: EntryType;
  done: boolean;
  inList: boolean;
}
