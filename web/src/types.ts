export type AuthUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role?: "USER" | "ADMIN";
  status?: UserStatus;
};

export type UserStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

export type AuthResponse = {
  token?: string;
  pending?: boolean;
  message?: string;
  user: AuthUser;
};


export type ScheduleType = "DAILY" | "WEEKLY";
export type TimeOfDay = "ANYTIME" | "MORNING" | "AFTERNOON" | "EVENING";

export type Habit = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  icon: string | null;
  archived: boolean;
  scheduleType: ScheduleType;
  scheduleDays: number[];
  timeOfDay: TimeOfDay;
  streakEnabled: boolean;
  reminderEnabled: boolean;
  reminderTime: string | null;
  /** Todas las horas de aviso (HH:mm). */
  reminderTimes: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  scheduledToday: boolean;
  recentCompletions?: string[];
  /** Solo en el detalle. */
  totalCompletions?: number;
  recentNotes?: { date: string; note: string }[];
};

export type HabitToday = Habit & {
  scheduledForDate: string;
  /** Nota del completado de ese dia. */
  note: string | null;
};

export type HabitAchievementRow = {
  id: string;
  habitId: string;
  milestoneDays: number;
  phraseIndex: number;
  unlockedAt: string;
};

export type UnlockedAchievement = {
  id: string;
  habitId: string;
  milestoneDays: number;
  phraseIndex: number;
  unlockedAt: string;
  habitTitle: string;
  habitColor: string;
  habitIcon: string | null;
  label: string;
};

export type CompleteHabitResponse = {
  habit: Habit;
  unlockedAchievement?: UnlockedAchievement;
};

export type CreateHabitPayload = {
  title: string;
  description?: string;
  color?: string;
  icon?: string | null;
  scheduleType?: ScheduleType;
  scheduleDays?: number[];
  timeOfDay?: TimeOfDay;
  streakEnabled?: boolean;
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderTimes?: string[];
};

export type SpecialAchievement = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  progress: number;
  target: number;
  unlocked: boolean;
  count: number;
  note: string | null;
};

export type AchievementsSummary = {
  totalMilestones: number;
  specials: SpecialAchievement[];
  habits: {
    habit: { id: string; title: string; color: string; icon: string | null; streakEnabled: boolean };
    currentStreak: number;
    longestStreak: number;
    unlocked: { id: string; milestoneDays: number; phraseIndex: number; unlockedAt: string; label: string }[];
    next: { milestoneDays: number; remaining: number; label: string } | null;
  }[];
};


export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type Project = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  openTasks: number;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  project: { id: string; name: string; color: string } | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  reminderEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
  dueToday: boolean;
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  projectId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  reminderEnabled?: boolean;
};

export type CreateProjectPayload = {
  name: string;
  color?: string;
};


export type ReminderItem = {
  id: string;
  sourceType: "HABIT" | "TASK" | "SUMMARY";
  sourceId: string;
  title: string;
  body: string | null;
  triggerAt: string;
  createdAt: string;
};


export type StatsOverview = {
  habits: {
    active: number;
    weekCompletionRate: number;
    daily: { date: string; label: string; scheduled: number; completed: number; rate: number }[];
    topStreaks: { id: string; title: string; color: string; currentStreak: number; longestStreak: number }[];
    /** Dias seguidos con todos los habitos cumplidos (hoy suma solo si ya esta completo). */
    perfectStreak: number;
    todayPerfect: boolean;
    perfectDaysTotal: number;
    level: LevelInfo;
  };
  tasks: {
    open: number;
    completedThisWeek: number;
    daily: { date: string; label: string; completed: number }[];
  };
};

export type HabitStatsDetail = {
  id: string;
  title: string;
  color: string;
  streakEnabled: boolean;
  currentStreak: number;
  longestStreak: number;
  completionRate30d: number;
  calendar: { date: string; scheduled: boolean; completed: boolean }[];
};

export type TaskStatsSummary = {
  byStatus: { todo: number; inProgress: number; done: number };
  byPriorityOpen: { high: number; medium: number; low: number };
  weeklyCompleted: { label: string; completed: number }[];
};


export type ManagedUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: "USER" | "ADMIN";
  status?: UserStatus;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserPayload = {
  email: string;
  username: string;
  fullName: string;
  password: string;
  role?: "USER" | "ADMIN";
};


export type LevelInfo = {
  xp: number;
  todayXp: number;
  level: number;
  title: string;
  levelStartXp: number;
  nextLevelXp: number;
};

export type DayStat = { date: string; scheduled: number; completed: number; rate: number; perfect: boolean };

export type RankingRow = {
  id: string;
  title: string;
  icon: string | null;
  color: string;
  streakEnabled: boolean;
  scheduled: number;
  completed: number;
  rate: number;
  currentStreak: number;
};

export type StatsRange = {
  from: string;
  to: string;
  days: DayStat[];
  byWeekday: { weekday: number; scheduled: number; completed: number; rate: number }[];
  byHour: number[];
  totals: { scheduled: number; completed: number; rate: number; perfectDays: number };
  ranking: RankingRow[];
  mood: { entries: number; average: number | null; highRate: number | null; lowRate: number | null };
  moods: DayMood[];
};

export type DayMood = { date: string; mood: number };
