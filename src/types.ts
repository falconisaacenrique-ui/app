export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  notes?: string;
  color: string;
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
}

export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  text: string;
  done: boolean;
  due?: string; // YYYY-MM-DD
  priority: Priority;
  createdAt: number;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  doneDates: string[]; // YYYY-MM-DD
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
}

export type View =
  | 'dashboard'
  | 'calendar'
  | 'tasks'
  | 'notes'
  | 'reminders'
  | 'habits'
  | 'budget';
