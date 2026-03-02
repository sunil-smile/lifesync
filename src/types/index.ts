// ─── Enums matching Prisma ────────────────────────────────────────────────────

export enum Frequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  CUSTOM = 'CUSTOM',
}

export enum WorkoutType {
  RUNNING = 'RUNNING',
  GYM = 'GYM',
  YOGA = 'YOGA',
  CYCLING = 'CYCLING',
  SWIMMING = 'SWIMMING',
  OTHER = 'OTHER',
}

export enum IntensityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum InvestmentPlatform {
  INDIA_STOCK = 'INDIA_STOCK',
  INDIA_MF = 'INDIA_MF',
  US_STOCK = 'US_STOCK',
  OTHER = 'OTHER',
}

export enum TaskPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum GoalType {
  LIFE = 'LIFE',
  LONG_TERM = 'LONG_TERM',
  SHORT_TERM = 'SHORT_TERM',
  MILESTONE = 'MILESTONE',
}

export enum GoalStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum NoteVisibility {
  PERSONAL = 'PERSONAL',
  SHARED = 'SHARED',
}

export enum ProgressType {
  PERCENTAGE = 'PERCENTAGE',
  MILESTONE_BASED = 'MILESTONE_BASED',
}

// ─── Base Interfaces ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bankName?: string;
  xp: number;
  level: number;
  levelName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: Frequency;
  targetDays: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  completed: boolean;
  createdAt: string;
}

export interface WeekDot {
  date: string;
  completed: boolean;
  isToday: boolean;
  dayLabel: string;
}

export interface HabitWithLogs extends Habit {
  logs: HabitLog[];
  weekDots: WeekDot[];
  currentStreak: number;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  type: WorkoutType;
  durationMinutes: number;
  distanceKm?: number;
  intensityLevel: IntensityLevel;
  caloriesBurned?: number;
  notes?: string;
  loggedAt: string;
  createdAt: string;
}

export interface SleepLog {
  id: string;
  userId: string;
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  qualityRating: number;
  notes?: string;
  loggedAt: string;
  createdAt: string;
}

export interface SleepStats {
  avgHours: number;
  avgQuality: number;
  bestNight: number;
  worstNight: number;
}

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  paidBy: string;
  bankAccount?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Income {
  id: string;
  userId: string;
  amount: number;
  source: string;
  category: string;
  date: string;
  receivedBy: string;
  recurring: boolean;
  notes?: string;
  createdAt: string;
}

export interface BudgetCategory {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  monthlyLimit: number;
  alertAt: number;
  month: number;
  year: number;
}

export interface BudgetCategoryWithSpend extends BudgetCategory {
  spent: number;
  percentage: number;
  status: 'good' | 'warning' | 'danger';
}

export interface Investment {
  id: string;
  userId: string;
  name: string;
  ticker?: string;
  platform: InvestmentPlatform;
  sector: string;
  fundType?: string;
  units?: number;
  buyPrice?: number;
  currentPrice?: number;
  investedAmount?: number;
  currentValue?: number;
  purchaseDate?: string;
  currency: string;
  notes?: string;
}

export interface InvestmentWithReturn extends Investment {
  returnAbsolute: number;
  returnPct: number;
  currentTotal: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  overallReturnPct: number;
  allocationBySector: SectorAllocation[];
}

export interface SectorAllocation {
  name: string;
  value: number;
  pct: number;
  color: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  dueDate?: string;
  priority: TaskPriority;
  assignee: string;
  status: TaskStatus;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  whyMotivation?: string;
  type: GoalType;
  category: string;
  targetDate?: string;
  assignee: string;
  progress: number;
  progressType: ProgressType;
  targetValue?: number;
  targetUnit?: string;
  parentGoalId?: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  createdAt: string;
}

export interface GoalWithChildren extends Goal {
  childGoals: Goal[];
  milestones: Milestone[];
  tasks: Task[];
}

export interface TimeEntry {
  id: string;
  userId: string;
  description: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  category?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  visibility: NoteVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface XpLog {
  id: string;
  userId: string;
  action: string;
  xpEarned: number;
  createdAt: string;
}

export interface Quote {
  id: string;
  text: string;
  author?: string;
  category?: string;
  isFavorite: boolean;
  userId?: string;
}

export interface BankUploadLog {
  id: string;
  userId: string;
  accountType: string;
  uploadedAt: string;
  transactionCount: number;
  dateFrom: string;
  dateTo: string;
}

// ─── Dashboard & Motivation ───────────────────────────────────────────────────

export interface DashboardData {
  user: User;
  todayHabits: {
    habits: HabitWithLogs[];
    completedCount: number;
    totalCount: number;
  };
  financeSnapshot: {
    currentMonthIncome: number;
    currentMonthExpenses: number;
    savings: number;
    savingsRate: number;
    topBudgetWarnings: BudgetCategoryWithSpend[];
  };
  upcomingTasks: Task[];
  motivationSummary: {
    xp: number;
    level: number;
    levelName: string;
    topStreak: { habitName: string; count: number };
    todayQuote: Quote;
  };
  portfolioSummary: PortfolioSummary;
  recentActivity: XpLog[];
}

export interface WeeklyReportCategory {
  score: number;
  grade: string;
  detail: string;
}

export interface WeeklyReport {
  habits: WeeklyReportCategory;
  finance: WeeklyReportCategory;
  tasks: WeeklyReportCategory;
  workouts: WeeklyReportCategory;
  sleep: WeeklyReportCategory;
  overall: { score: number; grade: string };
  xpEarnedThisWeek: number;
  winOfWeek: string;
  improveArea: string;
}

export interface StreakInfo {
  habitId: string;
  habitName: string;
  icon: string;
  currentStreak: number;
  longestStreak: number;
}

export interface XPData {
  xp: number;
  level: number;
  levelName: string;
  nextLevelXP: number;
  progressPct: number;
}

export interface MotivationData {
  streaks: StreakInfo[];
  xpData: XPData;
  weeklyReport: WeeklyReport;
  partnerStats: {
    name: string;
    xp: number;
    level: number;
    levelName: string;
  } | null;
  todayQuote: Quote;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
