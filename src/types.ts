export type Repeat = 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (first occurrence when repeating)
  time?: string; // HH:MM
  notes?: string;
  color: string;
  repeat?: Repeat;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  pinned: boolean;
}

export interface Reminder {
  id: string;
  text: string;
  datetime: string; // ISO local "YYYY-MM-DDTHH:MM"
  done: boolean;
  notified: boolean;
  repeat?: Repeat;
}

export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  text: string;
  done: boolean;
  due?: string; // YYYY-MM-DD
  priority: Priority;
  createdAt: number;
  repeat?: Repeat; // completing a repeating task advances its due date
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  doneDates: string[]; // YYYY-MM-DD
  target?: number; // check-offs per week; 7 or undefined = daily
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
}

export interface Settings {
  currency: string; // ISO 4217 code, e.g. "USD"
}

export type View =
  | 'dashboard'
  | 'calendar'
  | 'tasks'
  | 'notes'
  | 'reminders'
  | 'habits'
  | 'budget'
  | 'search'
  | 'settings';
