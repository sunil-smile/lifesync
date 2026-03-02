import { clsx, type ClassValue } from 'clsx';
import { format, subDays, startOfWeek, addDays, differenceInDays, isToday as dateFnsIsToday, isPast as dateFnsIsPast, parseISO } from 'date-fns';

// ─── cn ───────────────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// ─── formatCurrency ───────────────────────────────────────────────────────────
export function formatCurrency(amount: number, currency = 'EUR'): string {
  if (currency === 'INR') {
    // Indian numbering system: xx,xx,xxx
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
    return formatted;
  }

  if (currency === 'EUR') {
    return new Intl.NumberFormat('en-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── formatDate ───────────────────────────────────────────────────────────────
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'd MMM yyyy'); // e.g. "28 Feb 2026"
}

// ─── formatDateShort ──────────────────────────────────────────────────────────
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'd MMM'); // e.g. "28 Feb"
}

// ─── formatDateTime ───────────────────────────────────────────────────────────
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'd MMM yyyy, h:mm aa'); // e.g. "28 Feb 2026, 10:30 AM"
}

// ─── calculateReturn ─────────────────────────────────────────────────────────
export function calculateReturn(
  buyPrice: number,
  currentPrice: number,
  units: number
): { absolute: number; percentage: number } {
  const invested = buyPrice * units;
  const current = currentPrice * units;
  const absolute = current - invested;
  const percentage = invested === 0 ? 0 : (absolute / invested) * 100;
  return { absolute, percentage };
}

// ─── getWeekDates ─────────────────────────────────────────────────────────────
export function getWeekDates(): Date[] {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(monday, i));
  }
  return days;
}

// ─── getLast14Days ────────────────────────────────────────────────────────────
export function getLast14Days(): Date[] {
  const today = new Date();
  const days: Date[] = [];
  for (let i = 13; i >= 0; i--) {
    days.push(subDays(today, i));
  }
  return days;
}

// ─── getLast30Days ────────────────────────────────────────────────────────────
export function getLast30Days(): Date[] {
  const today = new Date();
  const days: Date[] = [];
  for (let i = 29; i >= 0; i--) {
    days.push(subDays(today, i));
  }
  return days;
}

// ─── XP Level thresholds ─────────────────────────────────────────────────────
interface LevelInfo {
  level: number;
  name: string;
  minXP: number;
  maxXP: number | null;
}

const LEVELS: LevelInfo[] = [
  { level: 1, name: 'Beginner', minXP: 0, maxXP: 99 },
  { level: 2, name: 'Starter', minXP: 100, maxXP: 249 },
  { level: 3, name: 'Consistent', minXP: 250, maxXP: 499 },
  { level: 4, name: 'Motivated', minXP: 500, maxXP: 899 },
  { level: 5, name: 'Committed', minXP: 900, maxXP: 1399 },
  { level: 6, name: 'Determined', minXP: 1400, maxXP: 2099 },
  { level: 7, name: 'Consistent Achiever', minXP: 2100, maxXP: 2999 },
  { level: 8, name: 'High Performer', minXP: 3000, maxXP: 4199 },
  { level: 9, name: 'Life Champion', minXP: 4200, maxXP: 5999 },
  { level: 10, name: 'Master', minXP: 6000, maxXP: null },
];

function getLevelInfo(xp: number): LevelInfo {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

export function getLevelName(xp: number): string {
  return getLevelInfo(xp).name;
}

export function getLevelNumber(xp: number): number {
  return getLevelInfo(xp).level;
}

export function getNextLevelXP(xp: number): number {
  const info = getLevelInfo(xp);
  if (info.maxXP === null) return info.minXP; // already max level
  return info.maxXP + 1;
}

export function getXPProgress(xp: number): number {
  const info = getLevelInfo(xp);
  if (info.maxXP === null) return 100; // max level
  const range = info.maxXP - info.minXP + 1;
  const progress = xp - info.minXP;
  return Math.min(100, Math.round((progress / range) * 100));
}

// ─── getBudgetStatus ──────────────────────────────────────────────────────────
export function getBudgetStatus(
  spent: number,
  limit: number,
  alertAt = 80
): 'good' | 'warning' | 'danger' {
  if (limit === 0) return 'good';
  const percentage = (spent / limit) * 100;
  if (percentage >= 100) return 'danger';
  if (percentage >= alertAt) return 'warning';
  return 'good';
}

// ─── getStreakCount ───────────────────────────────────────────────────────────
export function getStreakCount(
  logs: Array<{ date: Date; completed: boolean }>
): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort logs by date descending
  const sorted = [...logs].sort((a, b) => {
    const da = new Date(a.date);
    const db = new Date(b.date);
    da.setHours(0, 0, 0, 0);
    db.setHours(0, 0, 0, 0);
    return db.getTime() - da.getTime();
  });

  let streak = 0;
  let checkDate = new Date(today);

  for (let i = 0; i < 365; i++) {
    checkDate.setHours(0, 0, 0, 0);
    const checkTime = checkDate.getTime();

    const logForDay = sorted.find((log) => {
      const d = new Date(log.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === checkTime;
    });

    if (logForDay && logForDay.completed) {
      streak++;
      checkDate = subDays(checkDate, 1);
    } else {
      // If today has no log yet, allow looking at yesterday
      if (i === 0) {
        checkDate = subDays(checkDate, 1);
        continue;
      }
      break;
    }
  }

  return streak;
}

// ─── getGrade ─────────────────────────────────────────────────────────────────
export function getGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 45) return 'D';
  return 'F';
}

// ─── slugify ──────────────────────────────────────────────────────────────────
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── truncate ─────────────────────────────────────────────────────────────────
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + '…';
}

// ─── getInitials ──────────────────────────────────────────────────────────────
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

// ─── isToday ──────────────────────────────────────────────────────────────────
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFnsIsToday(d);
}

// ─── isPast ───────────────────────────────────────────────────────────────────
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFnsIsPast(d) && !dateFnsIsToday(d);
}
